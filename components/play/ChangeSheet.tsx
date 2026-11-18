"use client";

import { useMemo, useState } from "react";
import { REAL_CREDIT, priceLabel, type Product } from "@/lib/play/catalog";
import { CHIPS, CHIP_GROUPS, alternativesFor, asksSomething, readWords, type Alt, type Ask, type ChipGroup } from "@/lib/play/change";
import type { RankCtx } from "@/lib/play/rank";
import { Icon } from "./icons";
import { ProductThumb } from "./ProductThumb";
import { useSpeech } from "./useSpeech";

// "Change this": tap what's off (budget, color, style, material, size, shape), say or type anything else, and
// 3–5 alternatives come back. One tap tries one in the room. The ripple toggle decides whether the room follows.

export type RippleMode = "keep" | "ripple";

interface Current {
  id?: string;
  name: string;
  category: Product["category"];
  sub?: string;
  price: number;
  color: string;
  w: number;
  material: string;
  product?: Product;
}

export default function ChangeSheet({ current, ctx, exclude, ripple, onRipple, onPick, onBackToOwn, ownName, onClose, onAskDesigner }: {
  current: Current;
  ctx: RankCtx;
  exclude: Set<string>;
  ripple: RippleMode;
  onRipple: (m: RippleMode) => void;
  onPick: (p: Product, ask: Ask) => void;
  onBackToOwn?: () => void;
  ownName?: string;
  onClose: () => void;
  onAskDesigner: () => void;
}) {
  const [group, setGroup] = useState<ChipGroup | null>(null);
  const [chips, setChips] = useState<Partial<Record<ChipGroup, string>>>({});
  const [text, setText] = useState("");
  const [words, setWords] = useState<{ ask: Ask; heard: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const speech = useSpeech((t, final) => {
    setText(t);
    if (final) void read(t);
  });

  const ask: Ask = useMemo(() => {
    const a: Ask = { ...(words?.ask ?? {}) };
    if (chips.budget) a.budget = chips.budget as Ask["budget"];
    if (chips.color) a.color = chips.color as Ask["color"];
    if (chips.style) a.style = chips.style as Ask["style"];
    if (chips.material) a.material = chips.material;
    if (chips.size) a.size = chips.size as Ask["size"];
    if (chips.shape) a.shape = chips.shape as Ask["shape"];
    return a;
  }, [chips, words]);

  const alts: Alt[] = useMemo(
    () => alternativesFor(current.product ?? { id: current.id, category: current.category, sub: current.sub, price: current.price, color: current.color, w: current.w, material: current.material }, ask, ctx, exclude),
    [current, ask, ctx, exclude],
  );

  // her words: read for free first; only what that can't place goes to the small model route
  async function read(said: string) {
    const t = said.trim();
    if (!t) return setWords(null);
    const local = readWords(t);
    if (asksSomething(local.ask) && !local.rest) return setWords({ ask: local.ask, heard: local.understood.join(", ") });
    setThinking(true);
    try {
      const r = await fetch("/api/play/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, piece: { name: current.name, kind: current.sub ?? current.category, color: current.color, material: current.material } }),
      });
      const body = (await r.json().catch(() => null)) as { t: string; ask?: Ask; heard?: string } | null;
      if (body?.t === "ok" && body.ask) {
        const merged = { ...local.ask, ...Object.fromEntries(Object.entries(body.ask).filter(([, v]) => v !== undefined && v !== null)) } as Ask;
        setWords({ ask: merged, heard: body.heard || local.understood.join(", ") });
      } else {
        setWords({ ask: local.ask, heard: asksSomething(local.ask) ? local.understood.join(", ") : "" });
      }
    } catch {
      setWords({ ask: local.ask, heard: local.understood.join(", ") });
    } finally {
      setThinking(false);
    }
  }

  const toggle = (g: ChipGroup, v: string) => setChips((c) => ({ ...c, [g]: c[g] === v ? undefined : v }));
  const picked = CHIP_GROUPS.filter((g) => chips[g]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 lg:px-4 pt-1 lg:pt-3 pb-2 flex items-center gap-2 shrink-0">
        <button onClick={onClose} aria-label="Back" className="h-9 w-9 -ml-1 grid place-items-center rounded-full text-ink-soft hover:text-ink">
          <Icon name="back" size={18} />
        </button>
        <div className="min-w-0">
          <p className="eyebrow text-ink-faint">Change this</p>
          <p className="font-display text-[1.25rem] leading-tight truncate">{current.name}</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 lg:px-4 pb-3 flex flex-col gap-3">
        {/* what's off: one row of groups, the open group's options under it */}
        <div>
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-1 px-1">
            {CHIP_GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setGroup((x) => (x === g ? null : g))}
                aria-expanded={group === g}
                className={`shrink-0 h-9 px-3.5 rounded-full text-sm border transition-colors ${group === g ? "bg-ink text-bg border-ink" : chips[g] ? "bg-clay-tint border-line-strong" : "border-line hover:border-line-strong"}`}
              >
                {CHIPS[g].label}
                {chips[g] && group !== g ? <span className="text-ink-soft"> · {CHIPS[g].options.find((o) => o.value === chips[g])?.label}</span> : null}
              </button>
            ))}
          </div>
          {group && (
            <div className="mt-2 flex flex-wrap gap-1.5 animate-[rise_0.18s_ease-out]">
              {CHIPS[group].options.map((o) => (
                <button key={o.value} onClick={() => toggle(group, o.value)} aria-pressed={chips[group] === o.value}
                  className={`h-8 px-3 rounded-full text-[13px] ${chips[group] === o.value ? "bg-ink text-bg" : "bg-surface-2 hover:bg-line"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* anything else, said or typed */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void read(text);
          }}
          className="flex items-center gap-1.5 rounded-2xl bg-surface-2 pl-3 pr-1 py-1"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={speech.listening ? "Listening…" : "Or say what's off, in your words"}
            aria-label="What would you change, in your words"
            className="flex-1 min-w-0 bg-transparent text-sm h-9 outline-none placeholder:text-ink-faint"
          />
          {speech.supported && (
            <button type="button" onClick={() => (speech.listening ? speech.stop() : speech.start())} aria-label={speech.listening ? "Stop listening" : "Speak instead"} aria-pressed={speech.listening}
              className={`h-9 w-9 grid place-items-center rounded-full ${speech.listening ? "bg-rust text-white animate-pulse" : "text-ink-soft hover:text-ink"}`}>
              <Icon name="mic" size={18} />
            </button>
          )}
          {text.trim() && (
            <button type="submit" className="h-9 px-3 rounded-full bg-ink text-bg text-sm font-medium" disabled={thinking}>
              {thinking ? "Reading…" : "Show me"}
            </button>
          )}
        </form>
        {words?.heard && <p className="text-xs text-ink-soft -mt-1">Heard: {words.heard}</p>}

        {/* does the room follow? */}
        <div>
          <div role="radiogroup" aria-label="When you change this" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm">
            {([["keep", "Just this piece"], ["ripple", "Let the room follow"]] as const).map(([m, l]) => (
              <button key={m} role="radio" aria-checked={ripple === m} onClick={() => onRipple(m)} className={`h-9 rounded-lg px-2 truncate ${ripple === m ? "bg-segment font-medium shadow-sm" : "text-ink-soft"}`}>{l}</button>
            ))}
          </div>
          <p className="text-[11px] text-ink-faint mt-1 leading-snug">
            {ripple === "ripple" ? "Up to three small pieces may change to keep the room coherent. You'll see them first." : "Only this piece changes. We'll say if it clashes with the rest."}
          </p>
        </div>

        {asksSomething(ask) && alts.length > 0 && alts.every((a) => !a.full) && (
          <p className="text-xs text-amber -mb-1">Nothing in the catalog matches all of that yet. These are the closest; your designer can source further.</p>
        )}
        <ul className="flex flex-col gap-2" aria-live="polite">
          {alts.map(({ product, why, full }) => (
            <li key={product.id}>
              <button onClick={() => onPick(product, ask)} className="w-full text-left flex items-center gap-3 rounded-2xl bg-surface-2 p-2 hover:bg-line transition-colors">
                <ProductThumb product={product} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug line-clamp-2">{product.name}</span>
                  <span className={`block text-[11px] mt-0.5 ${full ? "text-ink-soft" : "text-amber"}`}>{why}</span>
                  {product.real && <span className="block text-[10px] text-ink-faint">{product.real.brand} · {REAL_CREDIT}</span>}
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-sm font-medium tabular-nums">{priceLabel(product, true)}</span>
                  {product.real && <span className="block text-[10px] text-ink-faint">{product.real.estimate ? "estimate" : "on retailer"}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {picked.length > 0 && <button onClick={() => setChips({})} className="text-xs text-ink-soft underline self-start">Clear {picked.length === 1 ? "the filter" : "filters"}</button>}
        {onBackToOwn && (
          <button onClick={onBackToOwn} className="btn btn-quiet w-full text-sm">
            Back to your {ownName ? ownName.charAt(0).toLowerCase() + ownName.slice(1) : "own piece"}
          </button>
        )}
        <button onClick={onAskDesigner} className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink self-start">
          <Icon name="chat" size={16} /> Hard to say? Ask your designer
        </button>
        <p className="text-[11px] text-ink-faint">Real pieces: photos and sizes from {REAL_CREDIT}; prices aren&apos;t in that data, so they&apos;re estimates until checkout looks them up.</p>
      </div>
    </div>
  );
}
