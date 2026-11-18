"use client";

import { useState } from "react";
import { Sheet } from "./VisualSet";
import {
  BRANDS, CHANNELS, NO_SPLURGE, SECONDHAND, SPLURGE, TIERS, toShopping,
  type ChannelId, type SecondhandId, type Shopping, type ShoppingPicks, type TierId,
} from "@/lib/taste/shopping";

// "What kind of shopper are you?" (lib/taste/shopping.ts): one question a screen, taps first, typing
// only for brands. Every screen can be skipped; a single choice moves on by itself. onDone gets the
// structured preferences and a one-line summary for the designer to react to.

type StepId = "tiers" | "channels" | "secondhand" | "splurge" | "brands";
const STEPS: { id: StepId; q: string; sub?: string }[] = [
  { id: "tiers", q: "What kind of shopper are you?", sub: "Pick any that fit." },
  { id: "channels", q: "Where do you usually find things?", sub: "So I build from places you'd actually buy." },
  { id: "secondhand", q: "New, or secondhand?" },
  { id: "splurge", q: "Where would you spend more?", sub: "Up to three. It's where the budget goes first." },
  { id: "brands", q: "Any brands you love, or never want?", sub: "Tap or type. “No IKEA” works too." },
];

export default function ShopperSheet({ prev, onDone, onClose }: { prev?: Shopping; onDone: (s: Shopping, summary: string) => void; onClose: () => void }) {
  const [at, setAt] = useState(0);
  const [p, setP] = useState<ShoppingPicks>(() => ({
    tiers: prev?.tiers ?? [], channels: prev?.channels ?? [], secondhand: prev?.secondhand,
    splurge: prev?.splurge ?? [], brands: prev?.brands_like.filter((b) => (BRANDS as readonly string[]).includes(b)) ?? [], said: prev?.said ?? "",
  }));
  const step = STEPS[at];
  const last = at === STEPS.length - 1;

  const finish = (picks = p) => {
    const s = toShopping(picks);
    const said = [
      s.tiers.length ? `${TIERS.filter((t) => s.tiers.includes(t.id)).map((t) => t.label).join(", ").toLowerCase()}` : "",
      s.channels.length ? `shops ${CHANNELS.filter((c) => s.channels.includes(c.id)).map((c) => c.label).join("; ")}` : "",
      s.secondhand ? SECONDHAND.find((x) => x.id === s.secondhand)!.label.toLowerCase() : "",
      s.splurge.length ? `would splurge on ${s.splurge.join(", ").toLowerCase()}` : picks.splurge.includes(NO_SPLURGE) ? "would spread the budget evenly" : "",
      s.brands_like.length ? `likes ${s.brands_like.join(", ")}` : "",
      s.brands_avoid.length ? `never ${s.brands_avoid.join(", ")}` : "",
    ].filter(Boolean);
    onDone(s, `How they shop: ${said.length ? said.join("; ") : "skipped all of it"}`);
  };
  const next = (picks = p) => (last ? finish(picks) : setAt(at + 1));

  const toggle = <T extends string>(xs: T[], x: T, max = 99): T[] => (xs.includes(x) ? xs.filter((y) => y !== x) : xs.length >= max ? xs : [...xs, x]);
  const chosen =
    step.id === "tiers" ? p.tiers.length : step.id === "channels" ? p.channels.length : step.id === "secondhand" ? Number(!!p.secondhand)
    : step.id === "splurge" ? p.splurge.length : p.brands.length + Number(!!p.said.trim());

  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-clay">How you shop</p>
          <ol className="flex gap-1.5" aria-label={`Question ${at + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => <li key={s.id} className={`h-1.5 w-1.5 rounded-full transition-colors ${i <= at ? "bg-ink" : "bg-line-strong"}`} />)}
          </ol>
        </div>
        <div key={step.id} className="flex flex-col gap-4 animate-rise">
          <div>
            <h2 className="text-title">{step.q}</h2>
            {step.sub && <p className="mt-1.5 text-sm text-ink-soft">{step.sub}</p>}
          </div>

          {step.id === "tiers" && (
            <Chips>
              {TIERS.map((t) => (
                <button key={t.id} aria-pressed={p.tiers.includes(t.id)} className="chip !min-h-11 !px-4 text-[14.5px]"
                  onClick={() => setP({ ...p, tiers: t.id === "mix" ? (p.tiers.includes("mix") ? [] : ["mix"]) : toggle(p.tiers.filter((x) => x !== "mix"), t.id as TierId) })}>
                  {t.label}<span className="text-xs opacity-60">{t.hint}</span>
                </button>
              ))}
            </Chips>
          )}
          {step.id === "channels" && (
            <Chips>
              {CHANNELS.map((c) => (
                <button key={c.id} aria-pressed={p.channels.includes(c.id)} className="chip !min-h-11 !px-4 text-[14.5px]" onClick={() => setP({ ...p, channels: toggle(p.channels, c.id as ChannelId) })}>{c.label}</button>
              ))}
            </Chips>
          )}
          {step.id === "secondhand" && (
            <div className="grid gap-2 sm:grid-cols-3">
              {SECONDHAND.map((x) => (
                <button key={x.id} aria-pressed={p.secondhand === x.id}
                  className={`min-h-14 rounded-2xl border px-4 text-[15px] transition-colors ${p.secondhand === x.id ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface text-ink hover:border-ink-faint"}`}
                  onClick={() => { const n = { ...p, secondhand: x.id as SecondhandId }; setP(n); setTimeout(() => next(n), 220); }}>
                  {x.label}
                </button>
              ))}
            </div>
          )}
          {step.id === "splurge" && (
            <Chips>
              {[...SPLURGE, NO_SPLURGE].map((x) => (
                <button key={x} aria-pressed={p.splurge.includes(x)} className="chip !min-h-11 !px-4 text-[14.5px]"
                  onClick={() => setP({ ...p, splurge: x === NO_SPLURGE ? (p.splurge.includes(x) ? [] : [x]) : toggle(p.splurge.filter((y) => y !== NO_SPLURGE), x, 3) })}>
                  {x}
                </button>
              ))}
            </Chips>
          )}
          {step.id === "brands" && (
            <>
              <Chips>
                {BRANDS.map((b) => (
                  <button key={b} aria-pressed={p.brands.includes(b)} className="chip" onClick={() => setP({ ...p, brands: toggle(p.brands, b) })}>{b}</button>
                ))}
              </Chips>
              <input value={p.said} onChange={(e) => setP({ ...p, said: e.target.value })} onKeyDown={(e) => e.key === "Enter" && finish()}
                aria-label="Other brands, or any to avoid" placeholder="Others, or any to avoid" className="field !rounded-full px-5 text-[15px]" autoComplete="off" />
            </>
          )}
        </div>

        <div className="sticky bottom-0 -mx-5 mt-2 flex gap-3 border-t bg-bg/90 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-9 sm:px-9">
          {at > 0 && <button className="btn btn-quiet" onClick={() => setAt(at - 1)}>Back</button>}
          <button className="btn btn-primary flex-1" onClick={() => next()}>{chosen ? (last ? "Done" : "Next") : last ? "Skip and finish" : "Skip"}</button>
        </div>
      </div>
    </Sheet>
  );
}

function Chips({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}
