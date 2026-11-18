"use client";

import { useState } from "react";
import { Icon } from "./icons";

// Three steps the first time she arrives from her brief (?from=brief), skippable at any point.
const STEPS = [
  { title: "Your room, furnished from your brief", body: "Your designer placed a first proposal around what you're keeping. Every new piece has a reason; tap one to see it." },
  { title: "Tap any piece to react", body: "A quick yes or no teaches it your taste. “Change this” lets you ask for cheaper, warmer, smaller or rounder, or just say what's off." },
  { title: "You decide how far a change goes", body: "“Just this piece” changes only what you touch. “Let the room follow” suggests a few small changes so it all still fits, and you approve them first." },
] as const;

export default function Walkthrough({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="walk-title" className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/30 p-3">
      <div className="w-full max-w-md rounded-3xl bg-surface shadow-[var(--shadow-2)] p-6 animate-[rise_0.25s_ease-out]">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-ink-faint">{i + 1} of {STEPS.length}</p>
          <button onClick={onDone} className="text-sm text-ink-soft hover:text-ink min-h-9 px-2">Skip</button>
        </div>
        <h2 id="walk-title" className="font-display text-[1.6rem] leading-tight mt-2">{s.title}</h2>
        <p className="mt-2 text-ink-soft leading-relaxed">{s.body}</p>
        <div className="mt-6 flex items-center gap-3">
          <div className="flex gap-1.5 mr-auto" aria-hidden>
            {STEPS.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-ink" : "w-1.5 bg-line-strong"}`} />)}
          </div>
          {i > 0 && <button onClick={() => setI(i - 1)} className="btn btn-quiet">Back</button>}
          <button onClick={() => (last ? onDone() : setI(i + 1))} className="btn btn-primary flex items-center gap-1.5">
            {last ? "Start" : "Next"} <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
