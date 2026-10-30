"use client";

import Image from "next/image";
import { useState } from "react";
import Explore, { type ExploreResult } from "./Explore";
import { MaterialFace, PaletteStrip, PatternFace } from "./Swatches";
import {
  MATERIAL, MATERIALS, PALETTE, PALETTES, PATTERN, PATTERNS, ROOM, roomGrid, roomSrc,
  scoreChips, scorePicks, SETS, type SetId, type TasteState,
} from "@/lib/taste/visual";

// One visual choice, the way designers show rather than ask: first "which could you live
// with" (multi-select), each pick followed by "what is it about this one?" chips, then
// "and any you'd never…". "I'm not sure" opens the this-or-that exploration instead.
// onDone gets the scored taste and a one-line summary for the designer to react to.

type Step = "like" | "never" | "explore";

const nameOf = (set: SetId, id: string) =>
  set === "rooms" ? ROOM.get(id)?.alt : set === "palettes" ? PALETTE.get(id)?.name : set === "materials" ? MATERIAL.get(id)?.label : PATTERN.get(id)?.label;

// said: what they've told the designer so far, so the room grid leads with what echoes it
// onFinish: "I'm finished with this section", kept reachable while the sheet covers the conversation
export default function VisualSet({ set, taste, said = "", onDone, onClose, onFinish }: { set: SetId; taste: TasteState; said?: string; onDone: (t: TasteState, summary: string) => void; onClose: () => void; onFinish?: () => void }) {
  const info = SETS[set];
  const [step, setStep] = useState<Step>("like");
  const [liked, setLiked] = useState<string[]>([]);
  const [never, setNever] = useState<string[]>([]);
  const [chips, setChips] = useState<Record<string, string[]>>({});
  // the last pick, whose "what is it about this one?" chips show
  const [focus, setFocus] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [rooms] = useState(() => roomGrid(taste, said));

  const items: string[] =
    set === "rooms" ? [...rooms.grid, ...(more ? rooms.more : [])]
    : set === "palettes" ? PALETTES.filter((p) => more || !p.more).map((p) => p.id)
    : set === "materials" ? MATERIALS.map((m) => m.id)
    : PATTERNS.map((p) => p.id);
  const hasMore = set === "rooms" || set === "palettes";
  const shown = step === "never" ? items.filter((id) => !liked.includes(id)) : items;

  const tap = (id: string) => {
    if (step === "like") {
      const on = liked.includes(id);
      setLiked(on ? liked.filter((x) => x !== id) : [...liked, id]);
      setFocus(on ? null : id);
    } else setNever(never.includes(id) ? never.filter((x) => x !== id) : [...never, id]);
  };

  const finish = (nv = never) => {
    let t = scorePicks(taste, set, { liked, never: nv });
    for (const [item, c] of Object.entries(chips)) if (liked.includes(item)) t = scoreChips(t, set, item, c);
    const why = Object.entries(chips).filter(([id, c]) => liked.includes(id) && c.length).map(([id, c]) => `${c.join(" and ").toLowerCase()} in ${nameOf(set, id)}`);
    const summary = [
      `${info.title}: ${liked.length ? `liked ${liked.map((id) => nameOf(set, id)).join("; ")}` : "liked none of them"}`,
      nv.length ? `never ${nv.map((id) => nameOf(set, id)).join("; ")}` : "",
      why.length ? `what drew them: ${why.join("; ")}` : "",
    ].filter(Boolean).join(". ");
    onDone(t, summary);
  };

  // what the exploration found; an undecided set records nothing
  const explored = (r: ExploreResult) => {
    const shown = [...new Set([...taste.shown, set])];
    const undecided = r.undecided ? [...new Set([...(taste.undecided ?? []), set])] : (taste.undecided ?? []).filter((x) => x !== set);
    let t: TasteState;
    if (set === "rooms") t = { ...r.taste, rooms: { liked: r.liked, never: [] }, shown, undecided };
    else t = r.undecided ? { ...taste, shown, undecided } : { ...scorePicks(taste, set, { liked: r.liked, never: [] }), undecided };
    const names = r.liked.map((id) => nameOf(set, id)).filter(Boolean).join("; ");
    onDone(t, r.undecided
      ? `${info.title}: wasn't sure, tried ${r.pairs} this-or-thats and still chose none. Undecided: don't record a ${info.title.toLowerCase()} preference.`
      : `${info.title}: wasn't sure, so tried ${r.pairs} this-or-thats; kept choosing ${names}`);
  };

  if (step === "explore")
    return (
      <Sheet onClose={onClose}>
        <Explore set={set} taste={taste} render={(id) => <Card set={set} id={id} />} name={(id) => nameOf(set, id)} onCancel={() => setStep("like")} onDone={explored} />
      </Sheet>
    );

  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="eyebrow text-clay">Your taste · {info.title}</p>
        <h2 key={step} className="text-title animate-rise">{step === "like" ? info.like : info.never}</h2>
        {step === "never" && <p className="-mt-2 text-sm text-ink-soft">Hard nos are as useful to me as loves.</p>}

        <ul className={`grid gap-2.5 sm:gap-3 ${set === "palettes" ? "grid-cols-1 sm:grid-cols-2" : set === "rooms" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4"}`}>
          {shown.map((id, i) => {
            const on = step === "like" ? liked.includes(id) : never.includes(id);
            return (
              <li key={id} className="settle" style={{ ["--delay" as string]: `${Math.min(i, 10) * 0.04}s` }}>
                <button
                  onClick={() => tap(id)}
                  aria-pressed={on}
                  aria-label={nameOf(set, id)}
                  className={`group relative block w-full overflow-hidden rounded-xl text-left outline-offset-2 transition-[box-shadow,transform] duration-200 active:scale-[0.985] ${on ? (step === "like" ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : "ring-2 ring-rust ring-offset-2 ring-offset-bg") : "ring-1 ring-line hover:ring-line-strong hover:shadow-[var(--shadow-2)]"}`}
                >
                  <Card set={set} id={id} />
                  {on && (
                    <span className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-white shadow-[0_2px_6px_rgb(0_0_0/0.25)] ${step === "like" ? "bg-[#1d1d1f]" : "bg-[#b0473a]"} animate-rise`} aria-hidden>
                      {step === "like" ? (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      )}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {hasMore && !more && step === "like" && (
          <button className="self-center link link-quiet text-sm min-h-11" onClick={() => setMore(true)}>Show me more</button>
        )}
        {/* the ways out, under the pictures rather than above the question */}
        <span className="flex flex-wrap items-baseline justify-center gap-x-5">
          <button className="link link-quiet text-sm min-h-11" onClick={() => setStep("explore")}>I&apos;m not sure</button>
          {onFinish && <button className="link link-quiet text-sm min-h-11" onClick={onFinish}>I&apos;m finished with this section</button>}
        </span>

        {/* the last pick's "what is it about this one?": one compact row, so it never hides the grid */}
        {step === "like" && focus && (
          <div key={focus} className="sticky bottom-[84px] z-10 -mx-1 rounded-2xl border bg-surface/95 px-3 py-2.5 shadow-[var(--shadow-2)] backdrop-blur animate-rise">
            <p className="text-xs font-medium text-ink-soft">What is it about this one?</p>
            <div className="mt-1.5 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
              {info.chips.map((c) => {
                const on = chips[focus]?.includes(c);
                return (
                  <button key={c} aria-pressed={on} onClick={() => setChips((p) => ({ ...p, [focus]: on ? p[focus].filter((x) => x !== c) : [...(p[focus] ?? []), c] }))}
                    className="chip shrink-0 !min-h-8 !px-3 !text-[12.5px]">
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="sticky bottom-0 -mx-5 mt-2 flex gap-3 border-t bg-bg/90 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-9 sm:px-9">
          {step === "like" ? (
            <>
              {!liked.length && <button className="btn btn-quiet" onClick={() => setStep("never")}>None of these</button>}
              <button className="btn btn-primary flex-1" disabled={!liked.length} onClick={() => { setFocus(null); setStep("never"); }}>
                {liked.length ? `That's it${liked.length > 1 ? ` (${liked.length})` : ""}` : "Pick any that feel right"}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-quiet" onClick={() => setStep("like")}>Back</button>
              <button className="btn btn-primary flex-1" onClick={() => finish()}>{never.length ? "Done" : "None are a hard no"}</button>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function Card({ set, id }: { set: SetId; id: string }) {
  if (set === "rooms")
    return <Image src={roomSrc(id)} alt="" width={640} height={480} sizes="(min-width: 640px) 30vw, 48vw" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />;
  if (set === "palettes") {
    const p = PALETTE.get(id)!;
    return (
      <span className="block bg-surface p-3">
        <PaletteStrip p={p} className="h-14 rounded-md" />
        <span className="mt-2.5 block text-sm font-medium text-ink">{p.name}</span>
        {/* every palette names its colors, wrapped rather than cut off, so a pair compares like for like */}
        {p.names && <span className="block min-h-[2.5em] text-xs leading-[1.25] text-ink-faint">{p.names.join(" · ")}</span>}
      </span>
    );
  }
  if (set === "materials") {
    const m = MATERIAL.get(id)!;
    return (
      <span className="block bg-surface">
        <MaterialFace m={m} className="aspect-square w-full" />
        <span className="block px-2.5 py-2 text-[13px] leading-tight text-ink">{m.label}</span>
      </span>
    );
  }
  const p = PATTERN.get(id)!;
  return (
    <span className="block bg-surface">
      <PatternFace p={p} className="aspect-square w-full" />
      <span className="block px-2.5 py-2 text-[13px] leading-tight text-ink">{p.label}</span>
    </span>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(10_14_12/0.38)] backdrop-blur-[2px] sm:items-center sm:p-6 animate-[fade_.2s_ease]" onClick={onClose}>
      <div className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] border-t bg-bg px-5 pt-4 shadow-[0_-20px_60px_-30px_rgb(0_0_0/0.5)] sm:rounded-[28px] sm:border sm:px-9 sm:pt-8 animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line-strong sm:hidden" aria-hidden />
        {children}
        <div className="h-4" />
      </div>
    </div>
  );
}
