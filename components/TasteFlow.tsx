"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { QUESTIONS, walk, type Answer, type Choice, type Known, type Question as Q } from "@/lib/taste/questions";
import { loadKnown, readSaved, STORE_KEY, type Saved } from "@/lib/taste/saved";

// Taste Builder as screens: one question per screen in the capture flow's look,
// driven by the tree in lib/taste/questions.ts. Kept at /taste?mode=screens to
// compare with the conversation (TasteConversation); both save the same state.
// Skipped questions never show; prefilled ones show already chosen and can be changed.
// The "because" behind a prefill stays backstage.

// Dev-only, so it's its own chunk and never loads in the normal flow
const AssumptionsPanel = dynamic(() => import("@/components/AssumptionsPanel"), { ssr: false });

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

// Rough minutes per answer kind, at the capture flow's pace, for "About N min left"
const MIN: Record<Q["kind"]["type"], number> = { single: 0.2, multi: 0.4, number: 0.25, text: 0.5 };

export default function TasteFlow() {
  const [s, setS] = useState<Saved>(readSaved);
  // ?dev=1 shows "What Homebody assumes"; never in production (same gate as the room page)
  const [dev] = useState(() => process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("dev") === "1");
  // null until the room is read, so prefills don't pop in after the first screen
  const [base, setBase] = useState<Omit<Known, "answers"> | null>(null);
  // straight after "I'm done for now" or "That's enough for now", don't offer the choice they just declined;
  // in memory only, so a later visit can add more
  const [justStopped, setJustStopped] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch {}
  }, [s]);

  useEffect(() => {
    let alive = true;
    loadKnown().then((k) => alive && setBase(k));
    return () => {
      alive = false;
    };
  }, []);

  if (!base) return <div className="max-w-xl mx-auto px-6 pt-6 pb-16 min-h-[70vh]" />;

  const known = (answers: Record<string, Answer>): Known => ({ ...base, answers });
  // The screens for a depth: what's asked or prefilled, plus anything they already answered.
  // Rule skips never show; their answers ride along in walk() for later branches.
  const route = (answers: Record<string, Answer>, depth: Saved["depth"]) =>
    walk(known(answers), depth).filter((st) => st.status === "ask" || st.status === "prefill" || answers[st.id] !== undefined);

  const steps = route(s.answers, s.depth);
  const ids = steps.map((st) => st.id);
  const end = s.depth === "core" ? "deeper" : "done";
  // Resume where they left off; if the tree moved under them, the first open question
  const cur = s.cur === "deeper" || s.cur === "done" || ids.includes(s.cur) ? s.cur : (ids.find((id) => s.answers[id] === undefined) ?? end);
  const idx = ids.indexOf(cur);
  const q = BY_ID.get(cur);
  const step = steps[idx];
  const shown = s.answers[cur] ?? (step?.status === "prefill" ? step.value : undefined);

  const answer = (value: Answer) => {
    const answers = { ...s.answers, [cur]: value };
    // drop answers to questions this one now hides (kids → No hides kid ages)
    for (const st of walk(known(answers), "all")) if (st.status === "hidden") delete answers[st.id];
    const rr = route(answers, s.depth).map((st) => st.id);
    // going deeper walks the optional questions; the core ones are already answered
    const nextId = rr.slice(rr.indexOf(cur) + 1).find((id) => s.depth === "core" || !BY_ID.get(id)!.core || answers[id] === undefined);
    setS((p) => ({ ...p, answers, history: [...p.history, cur], cur: nextId ?? end }));
  };
  const deeper = () => {
    const rr = route(s.answers, "all").map((st) => st.id);
    setS((p) => ({ ...p, depth: "all", history: [...p.history, cur], cur: rr.find((id) => p.answers[id] === undefined) ?? "done" }));
  };
  // Back skips screens a changed answer has since hidden; back on "Want to go deeper?" returns to the core path
  const back = () => {
    const history = [...s.history];
    let to = history.pop();
    // after a reopen, the screen they stopped on is both the last entry and where they are now
    while (to && (to === cur || (to !== "deeper" && to !== "done" && !ids.includes(to)))) to = history.pop();
    if (!to) return;
    setS((p) => ({ ...p, cur: to, history, depth: to === "deeper" ? "core" : p.depth }));
  };

  const left = idx < 0 ? 0 : steps.slice(idx).filter((st) => st.id === cur || s.answers[st.id] === undefined).reduce((t, st) => t + MIN[BY_ID.get(st.id)!.kind.type], 0);
  // answered over all screens, so the bar only moves forward, even as "Go deeper" skips answered core screens
  const progress = cur === "done" ? 1 : steps.filter((st) => s.answers[st.id] !== undefined).length / steps.length;
  const open = route(s.answers, "all").filter((st) => s.answers[st.id] === undefined);
  const moreToAdd = open.length > 0;
  // what "Go deeper" really asks: how many more, and roughly how long
  const moreMin = Math.max(1, Math.round(open.reduce((t, st) => t + MIN[BY_ID.get(st.id)!.kind.type], 0)));
  const moreSub = `About ${open.length} more question${open.length === 1 ? "" : "s"}, roughly ${moreMin} minute${moreMin === 1 ? "" : "s"}. Stop whenever you like.`;
  const finish = () => {
    setJustStopped(true);
    setS((p) => ({ ...p, history: [...p.history, cur], cur: "done" }));
  };

  return (
    <div className="max-w-xl mx-auto px-6 pt-6 pb-16 min-h-[70vh] flex flex-col">
      <div className="flex flex-col gap-2 mb-10">
        <div className="flex items-center justify-between text-xs text-ink-soft">
          <button onClick={back} disabled={!s.history.length} className="-ml-3 h-11 w-11 grid place-items-center text-2xl leading-none text-ink disabled:opacity-20" aria-label="Back">‹</button>
          <span>{idx < 0 ? "Your taste" : left < 1 ? "Less than a minute left" : `About ${Math.round(left)} min left`}</span>
        </div>
        <div className="h-[3px] rounded-full bg-line overflow-hidden">
          <div className="h-full bg-ink transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div key={cur} className="flex-1 flex flex-col gap-5 animate-[rise_.3s_ease]">
        {q && <Ask q={q} known={known(s.answers)} shown={shown} prefilled={step?.status === "prefill" && s.answers[cur] === undefined} onAnswer={answer} onEnough={s.depth === "all" && !q.core ? finish : undefined} />}

        {cur === "deeper" && (
          <Question title="Want to go a little deeper?" sub={moreSub}>
            <div className="flex-1" />
            <button className="btn btn-primary w-full" onClick={deeper}>Go deeper</button>
            <button className="btn btn-quiet w-full" onClick={finish}>I&apos;m done for now</button>
          </Question>
        )}

        {cur === "done" && (
          <Question title="Thank you, that's plenty for now" sub="You can come back anytime to add more.">
            <div className="flex-1" />
            <Link href="/rooms" className="btn btn-primary w-full">See your rooms</Link>
            {moreToAdd && !justStopped && <button className="btn btn-quiet w-full" onClick={deeper}>Add more now</button>}
          </Question>
        )}
      </div>
      {dev && <AssumptionsPanel known={base} answers={s.answers} notes={s.notes} />}
    </div>
  );
}

// One question from the tree, in the answer kind it asks for
// onEnough: on the optional questions, a way out to the finish screen that keeps every answer
function Ask({ q, known, shown, prefilled, onAnswer, onEnough }: { q: Q; known: Known; shown: Answer | undefined; prefilled: boolean; onAnswer: (v: Answer) => void; onEnough?: () => void }) {
  const kind = q.kind;
  const choices: Choice[] = kind.type === "single" || kind.type === "multi" ? [...(q.choicesFrom?.(known) ?? []), ...kind.choices] : [];
  const [picked, setPicked] = useState<string[]>(() => (Array.isArray(shown) ? shown : []));
  const [text, setText] = useState(() => (typeof shown === "string" ? shown : ""));
  const [num, setNum] = useState(() => (typeof shown === "number" ? shown : kind.type === "number" ? kind.min : 0));

  // An exclusive choice ("No pets") clears the others; picking another clears it
  const toggle = (c: Choice) =>
    setPicked((p) =>
      p.includes(c.id) ? p.filter((x) => x !== c.id) : c.exclusive ? [c.id] : [...p.filter((x) => !choices.find((o) => o.id === x)?.exclusive), c.id],
    );

  // a prefill says where it came from in plain words, and what to do with it; the "because" stays backstage
  const sub = prefilled
    ? `${fromRoom(q, known, shown) ? "From your room." : "From what you told us."} ${kind.type === "multi" ? "Keep these or change them, then continue." : "Tap to keep it, or pick another."}`
    : undefined;

  return (
    <Question title={q.prompt} sub={sub}>
      {kind.type === "single" &&
        choices.map((c) => (
          <Option key={c.id} on={shown === c.id} onClick={() => onAnswer(c.id)}>{c.label}</Option>
        ))}

      {kind.type === "multi" && (
        <>
          {choices.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button key={c.id} onClick={() => toggle(c)} className={`text-left rounded-lg border px-4 py-3.5 flex items-center gap-3 ${on ? "border-ink bg-surface" : "hover:border-line-strong"}`}>
                <span className={`h-5 w-5 rounded border grid place-items-center text-xs ${on ? "bg-ink text-bg border-ink" : ""}`}>{on ? "✓" : ""}</span>
                <span className="font-medium">{c.label}</span>
              </button>
            );
          })}
        </>
      )}

      {kind.type === "text" && (
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && text.trim() && onAnswer(text.trim())} placeholder={kind.placeholder} className="w-full rounded-lg border bg-surface px-4 py-3" />
      )}

      {kind.type === "number" && (
        <div className="flex items-center gap-4">
          <button onClick={() => setNum((n) => Math.max(n - 1, kind.min))} className="h-11 w-11 rounded-lg border text-xl grid place-items-center disabled:opacity-30" disabled={num <= kind.min} aria-label="Fewer">−</button>
          <span className="font-display text-4xl w-12 text-center tabular-nums" aria-live="polite">{num}</span>
          <button onClick={() => setNum((n) => Math.min(n + 1, kind.max))} className="h-11 w-11 rounded-lg border text-xl grid place-items-center disabled:opacity-30" disabled={num >= kind.max} aria-label="More">+</button>
        </div>
      )}

      <div className="flex-1" />
      {/* Voice later: the microphone button goes here, above Continue, and speaks
          the same prompt and choices. Nothing records yet. */}
      {kind.type === "multi" && <button className="btn btn-primary w-full" disabled={!picked.length} onClick={() => onAnswer(picked)}>Continue</button>}
      {kind.type === "number" && <button className="btn btn-primary w-full" onClick={() => onAnswer(num)}>Continue</button>}
      {kind.type === "text" && (
        <>
          <button className="btn btn-primary w-full" disabled={!text.trim()} onClick={() => onAnswer(text.trim())}>Continue</button>
          <button className="text-center text-sm text-ink-soft underline min-h-11" onClick={() => onAnswer("")}>Nothing comes to mind</button>
        </>
      )}
      {onEnough && <button className="text-center text-sm text-ink-soft underline min-h-11" onClick={onEnough}>That&apos;s enough for now</button>}
    </Question>
  );
}

// Whether a prefill rests on the scan or the sort ("your room"), or only on what they said.
// A question that reads no scan or sort source is intake-only; for mixed ones, re-run its
// rule with the scan and sort left out: if it still lands on the same answer, they told us.
const ROOM_SOURCE = /^(scan|sort)\./;
function fromRoom(q: Q, known: Known, value: Answer | undefined): boolean {
  if (!q.from.some((src) => ROOM_SOURCE.test(src))) return false;
  const r = q.known?.({ intake: known.intake, answers: known.answers });
  return !(r && "prefill" in r && JSON.stringify(r.prefill) === JSON.stringify(value));
}

function Question({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col gap-5">
      <div>
        <h1 className="text-[2rem] leading-[1.15]">{title}</h1>
        {sub && <p className="mt-3 text-ink-soft">{sub}</p>}
      </div>
      <div className="flex-1 flex flex-col gap-3">{children}</div>
    </div>
  );
}

// A single-choice answer: one tap answers and moves on. A prefilled or earlier
// answer shows already chosen; tapping it again confirms it.
function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`text-left rounded-lg border px-4 py-3.5 transition-colors ${on ? "border-ink bg-surface" : "bg-bg hover:border-ink"}`}>
      <span className="block font-medium">{children}</span>
    </button>
  );
}
