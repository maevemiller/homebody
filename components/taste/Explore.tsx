"use client";

import Image from "next/image";
import { useState } from "react";
import {
  blend, blendName, challenger, exploreDone, EXPLORE_MAX, firstInSet, nextPair, ROOM, roomSrc, scorePair, SET_EXPLORE_MAX, winnerOf,
  type Family, type Pair, type SetId, type TasteState,
} from "@/lib/taste/visual";

// "I'm not sure" (learning-taste-from-images.md §3, §6.3), inside the set they were on.
// Rooms: adaptive pairs chosen to split the current top two families, 6–12, stopping early.
// Palettes, materials, patterns: a this-or-that among that set's own items; the one they keep
// choosing stays and each challenger is the least like it. "Both" and "neither" keep forced
// choices from adding noise. If they never choose, nothing is recorded: being unsure isn't
// a preference.

type Pick = "a" | "b" | "both" | "neither";

export interface ExploreResult {
  taste: TasteState;
  liked: string[];
  // they explored and still chose nothing
  undecided: boolean;
  pairs: number;
}

export default function Explore({ set, taste, render, name, onDone, onCancel }: {
  set: SetId;
  taste: TasteState;
  render: (id: string) => React.ReactNode;
  name: (id: string) => string | undefined;
  onDone: (r: ExploreResult) => void;
  onCancel: () => void;
}) {
  return set === "rooms" ? <RoomPairs taste={taste} onDone={onDone} onCancel={onCancel} /> : <SetPairs set={set} taste={taste} render={render} name={name} onDone={onDone} onCancel={onCancel} />;
}

const QUESTION: Record<Exclude<SetId, "rooms">, string> = {
  palettes: "Which would you rather live with?",
  materials: "Which would you rather have around?",
  patterns: "Which would you rather have on a pillow?",
};

function SetPairs({ set, taste, render, name, onDone, onCancel }: { set: Exclude<SetId, "rooms">; taste: TasteState; render: (id: string) => React.ReactNode; name: (id: string) => string | undefined; onDone: (r: ExploreResult) => void; onCancel: () => void }) {
  const [pair, setPair] = useState<[string, string]>(() => firstInSet(taste, set));
  const [seen, setSeen] = useState<string[]>(() => firstInSet(taste, set));
  const [liked, setLiked] = useState<string[]>([]);
  // rounds the current one has held
  const [held, setHeld] = useState(0);
  const [rounds, setRounds] = useState(0);

  const end = (l: string[]) => onDone({ taste, liked: [...new Set(l)], undecided: l.length === 0, pairs: rounds + 1 });

  const choose = (pick: Pick) => {
    const [a, b] = pair;
    const winner = pick === "a" ? a : pick === "b" ? b : null;
    const nl = pick === "both" ? [...liked, a, b] : winner ? [...liked.filter((x) => x !== a && x !== b), winner] : liked;
    // the one they keep: the winner, or the current one on "both"; "neither" starts fresh
    const champ = winner ?? (pick === "both" ? a : null);
    const nh = champ && champ === a ? held + 1 : champ ? 1 : 0;
    const r = rounds + 1;
    setLiked(nl);
    setHeld(nh);
    setRounds(r);
    if (nh >= 3 || r >= SET_EXPLORE_MAX) return end(nl);
    const base = champ ?? challenger(set, b, seen, taste);
    const next = base ? challenger(set, base, [...seen, base], taste) : null;
    if (!base || !next) return end(nl);
    setSeen([...seen, base, next]);
    setPair([base, next]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow text-clay">This or that</p>
        <button className="link link-quiet text-sm min-h-11" onClick={onCancel}>Back</button>
      </div>
      <h2 className="text-title">{QUESTION[set]}</h2>
      <div key={pair.join("-")} className="grid grid-cols-2 gap-2.5 sm:gap-4 animate-rise">
        {pair.map((id, i) => (
          <button key={id} onClick={() => choose(i === 0 ? "a" : "b")} aria-label={name(id)} className="overflow-hidden rounded-xl text-left ring-1 ring-line transition-[box-shadow,transform] hover:ring-line-strong hover:shadow-[var(--shadow-2)] active:scale-[0.985]">
            {render(id)}
          </button>
        ))}
      </div>
      <PairFooter onBoth={() => choose("both")} onNeither={() => choose("neither")} done={rounds} max={SET_EXPLORE_MAX} note={liked.length ? `Leaning ${name(liked[liked.length - 1])?.toLowerCase()}` : "Go with your gut"} onStop={rounds >= 2 ? () => end(liked) : undefined} />
    </div>
  );
}

function RoomPairs({ taste, onDone, onCancel }: { taste: TasteState; onDone: (r: ExploreResult) => void; onCancel: () => void }) {
  const [t, setT] = useState(taste);
  const [asked, setAsked] = useState<Pair[]>(() => {
    const first = nextPair(taste, []);
    return first ? [first] : [];
  });
  const [answers, setAnswers] = useState<{ pick: Pick; winner?: Family }[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const pair = asked[asked.length - 1];
  const b = blend(t);
  const finish = () => onDone({ taste: t, liked: [...new Set(liked)], undecided: liked.length === 0, pairs: answers.length });

  const choose = (pick: Pick) => {
    if (!pair) return;
    const nt = scorePair(t, pair, pick);
    const na = [...answers, { pick, winner: winnerOf(pair, pick) }];
    const nl = pick === "a" ? [...liked, pair.a] : pick === "b" ? [...liked, pair.b] : pick === "both" ? [...liked, pair.a, pair.b] : liked;
    setT(nt);
    setAnswers(na);
    setLiked(nl);
    const next = nextPair(nt, asked);
    if (exploreDone(nt, na) || !next) setDone(true);
    else setAsked([...asked, next]);
  };

  if (done)
    return (
      <div className="flex flex-col gap-5 animate-rise">
        <p className="eyebrow text-clay">Here&apos;s what I&apos;m seeing</p>
        <h2 className="text-title">{b.length && liked.length ? `${blendName(b)}.` : "A real mix. That's a finding too."}</h2>
        <p className="text-ink-soft">{b.length && liked.length ? `Mostly ${b.map((x) => `${x.label} (${x.pct}%)`).join(", ")}. I'll keep refining as we go.` : "You like a lot of different things; I'll find the thread that ties them together."}</p>
        <div className="flex gap-3">
          <button className="btn btn-primary flex-1" onClick={finish}>Sounds right</button>
          <button className="btn btn-quiet" onClick={() => { const next = nextPair(t, asked); if (next) { setDone(false); setAsked([...asked, next]); } else finish(); }}>Keep going</button>
        </div>
      </div>
    );

  if (!pair) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow text-clay">This or that</p>
        <button className="link link-quiet text-sm min-h-11" onClick={onCancel}>Back</button>
      </div>
      <h2 key={pair.axis} className="text-title animate-rise">{pair.axis}?</h2>
      <div key={`${pair.a}-${pair.b}`} className="grid grid-cols-2 gap-2.5 sm:gap-4 animate-rise">
        {(["a", "b"] as const).map((side) => {
          const id = pair[side];
          return (
            <button key={id} onClick={() => choose(side)} className="group relative overflow-hidden rounded-xl bg-surface-2 transition-transform active:scale-[0.985]" aria-label={ROOM.get(id)?.alt}>
              <Image src={roomSrc(id)} alt="" width={640} height={800} className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" priority />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-3 pb-2.5 pt-8 text-left text-[13px] leading-snug text-white">{ROOM.get(id)?.alt}</span>
            </button>
          );
        })}
      </div>
      <PairFooter onBoth={() => choose("both")} onNeither={() => choose("neither")} done={answers.length} max={EXPLORE_MAX} note={b.length && answers.length >= 2 ? `Leaning ${b[0].label}` : "Go with your gut"} />
    </div>
  );
}

function PairFooter({ onBoth, onNeither, done, max, note, onStop }: { onBoth: () => void; onNeither: () => void; done: number; max: number; note: string; onStop?: () => void }) {
  return (
    <>
      <div className="flex items-center justify-center gap-2">
        <button className="chip !min-h-11 !px-6" onClick={onBoth}>Both</button>
        <button className="chip !min-h-11 !px-6" onClick={onNeither}>Neither</button>
      </div>
      {/* the choice forming is the progress, not "question 7 of 12" */}
      <div className="flex items-center gap-3 text-xs text-ink-faint" aria-live="polite">
        <span className="flex gap-1" aria-hidden>
          {Array.from({ length: Math.min(max, Math.max(6, done + 1)) }, (_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < done ? "bg-clay" : "bg-line"}`} />)}
        </span>
        <span className="truncate">{note}</span>
        {onStop && <button className="link link-quiet ml-auto min-h-9" onClick={onStop}>That&apos;s enough</button>}
      </div>
    </>
  );
}
