"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Chip from "@/components/Chip";
import { QUESTIONS, walk, type Answer, type Known, type Question as Q } from "@/lib/taste/questions";
import { loadKnown, readSaved, STORE_KEY, type Saved } from "@/lib/taste/saved";
import { acknowledge, asked, choicesOf, interpret, keepGoingLine, noteDetail, opening, recap, recordAll, spokenLine, TEST_PERSONAS, welcomeBack } from "@/lib/taste/agent";
import { prefetch, speak, watchVoice } from "@/lib/taste/voice";

// Taste Builder as a conversation (docs/voice-plan.md): the agent asks one thing
// at a time in its own words, hears a full answer, says back what it heard and
// records whatever that answer covers, so one reply can fill several questions.
// Voice is the default, typing the alternative, and the chips under each
// question answer the same way.
//
// Phase 0: no AI and no real voice yet. The agent's turns are scripted from the
// tree (lib/taste/agent.ts), replies go through its free keyword interpreter,
// the agent speaks through speak() in lib/taste/voice.ts, and the mic uses the
// browser's own Web Speech API where it exists, or a sheet to type what you'd
// say. Phase 1 swaps in the live agent and a neural voice.

// Dev-only, so it's its own chunk and never loads in the normal flow
const AssumptionsPanel = dynamic(() => import("@/components/AssumptionsPanel"), { ssr: false });

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

// Rough minutes per answer kind, at the capture flow's pace, for "About N min left" (as TasteFlow)
const MIN: Record<Q["kind"]["type"], number> = { single: 0.2, multi: 0.4, number: 0.25, text: 0.5 };

// Said when nothing was understood, each once before any repeats
const SORRY = ["Sorry, I didn't quite catch that. You can also tap an answer.", "Sorry, could you say that another way?", "I missed that, sorry. Tapping works too."];

interface Line {
  who: "agent" | "you";
  text: string;
}

// The Web Speech API's recognizer, typed just enough. Built into Chrome and Safari, free,
// no package; Firefox has none, so the mic falls back to the typing sheet there.
interface Recognizer {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognizerCtor = new () => Recognizer;
const speechIn = (): RecognizerCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export default function TasteConversation() {
  const [s, setS] = useState<Saved>(readSaved);
  // ?dev=1 shows "What Homebody assumes", the test personas and the voice in use; never in production
  const [dev] = useState(() => process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("dev") === "1");
  // null until the room is read, so prefills don't pop in after the first line
  const [base, setBase] = useState<Omit<Known, "answers"> | null>(null);
  // straight after stopping, don't offer the more they just declined; in memory only, so a later visit can add more
  const [justStopped, setJustStopped] = useState(false);
  const [mode, setMode] = useState<"intro" | "talk" | "type">("intro");
  // the captions so far, oldest first; the agent's current line isn't in it yet
  const [said, setSaid] = useState<Line[]>([]);
  // the agent's reply to their last turn (or its hello), said before the next question
  const [lead, setLead] = useState("");
  // prefills they said no to this visit: asked again as an open question
  const [declined, setDeclined] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  // they tapped End: the call stops in silence, and the recap is only shown
  const [hungUp, setHungUp] = useState(false);
  const [persona, setPersona] = useState({ id: TEST_PERSONAS[0].id, turn: 0 });

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
  const k = known(s.answers);
  const notes = s.notes ?? [];
  // What's asked or prefilled at a depth, plus anything already answered (as TasteFlow)
  const route = (answers: Record<string, Answer>, depth: Saved["depth"]) =>
    walk(known(answers), depth).filter((st) => st.status === "ask" || st.status === "prefill" || answers[st.id] !== undefined);
  // The agent always asks the first open question: answered ones, in or out of order, are never asked again
  const firstOpen = (answers: Record<string, Answer>, depth: Saved["depth"]) =>
    route(answers, depth).find((st) => answers[st.id] === undefined)?.id ?? (depth === "core" ? "deeper" : "done");

  const steps = route(s.answers, s.depth);
  const cur = s.cur === "deeper" || s.cur === "done" ? s.cur : firstOpen(s.answers, s.depth);
  const q = BY_ID.get(cur);
  // a guess resting on evidence they've since overruled is asked plainly, as is one they said no to
  const step = steps.find((st) => st.id === cur);
  const st = step && asked(step, k);
  const prefill = st?.status === "prefill" && !declined.includes(cur) ? st.value : undefined;

  const open = route(s.answers, "all").filter((x) => s.answers[x.id] === undefined);
  const moreToAdd = open.length > 0;
  // what keeping going really asks: how many more, and roughly how long
  const moreMin = Math.max(1, Math.round(open.reduce((t, x) => t + MIN[BY_ID.get(x.id)!.kind.type], 0)));
  const left = q ? steps.filter((x) => s.answers[x.id] === undefined).reduce((t, x) => t + MIN[BY_ID.get(x.id)!.kind.type], 0) : 0;
  // answered over all questions at this depth, so the bar only moves forward, even when one reply answers three
  const progress = cur === "done" ? 1 : steps.length ? steps.filter((x) => s.answers[x.id] !== undefined).length / steps.length : 1;

  const question = q
    ? spokenLine(q, prefill !== undefined ? st : { id: cur, status: "ask" }, k)
    : cur === "deeper"
      ? keepGoingLine(moreMin)
      : recap(k, notes);
  const line = [lead, question].filter(Boolean).join(" ");
  // the question most likely said next, fetched ahead while they answer so the neural voice has no gap
  const after = q ? steps.find((x) => s.answers[x.id] === undefined && x.id !== cur) : undefined;
  const upNext = after ? spokenLine(BY_ID.get(after.id)!, after, k) : q && s.depth === "core" ? keepGoingLine(moreMin) : "";
  // everything the agent has said, so no acknowledgement repeats
  const used = [...said.filter((l) => l.who === "agent").map((l) => l.text), line];
  const fresh = (pool: string[]) => pool.find((x) => !used.some((u) => u.includes(x))) ?? pool[0];

  // Starting the call: a hello and one line about the room, or a line of recap on a return
  const begin = (m: "talk" | "type") => {
    setMode(m);
    if (!said.length) setLead(Object.keys(s.answers).length ? welcomeBack(k, notes) : opening(k));
  };
  const deeper = (reply = "Let's keep going.") => {
    setHungUp(false);
    setLead(reply);
    setS((p) => ({ ...p, depth: "all", history: [...p.history, cur], cur: firstOpen(p.answers, "all") }));
  };
  const finish = (reply = "") => {
    setJustStopped(true);
    setLead(reply);
    setS((p) => ({ ...p, history: [...p.history, cur], cur: "done" }));
  };

  // One turn: what they said (typed, spoken or tapped) and whatever it records.
  // A tap passes its answer as found; words go through the interpreter.
  const turn = (text: string, found?: { id: string; value: Answer }[]) => {
    setSaid((p) => [...p, { who: "agent", text: line }, { who: "you", text }]);
    const heard = found ? { answers: found, notes: [], intent: null, years: undefined } : interpret(text, k, q ? { id: cur, prefill } : undefined);
    if (heard.intent === "stop") return finish("Of course.");
    if (cur === "deeper") {
      if (heard.intent === "yes") return deeper();
      if (heard.intent === "no") return finish("Of course.");
      return setLead(fresh(SORRY));
    }
    if (!q) return;

    const all = heard.notes.reduce(noteDetail, notes);
    const added = all.slice(notes.length);
    const { answers, recorded } = recordAll(k, heard.answers);
    const nope = !recorded.includes(cur) && heard.intent === "no" && prefill !== undefined;
    if (nope) setDeclined((d) => [...d, cur]);
    setLead(
      nope ? fresh(["No problem.", "Okay, let me ask it another way."])
      : recorded.length || added.length ? acknowledge({ k: known(answers), cur, recorded, prefill, years: heard.years, notes: added, used })
      : fresh(SORRY),
    );
    setS((p) => ({ ...p, answers, notes: all, history: recorded.length ? [...p.history, cur] : p.history, cur: firstOpen(answers, p.depth) }));
  };

  const say = (text: string) => {
    const t = text.trim();
    if (t) turn(t);
  };

  if (mode === "intro") {
    const resuming = Object.keys(s.answers).length > 0;
    return (
      <div className="max-w-xl mx-auto px-6 pt-6 pb-10 min-h-[100dvh] flex flex-col">
        <div className="flex-1 flex flex-col justify-center gap-4 animate-[rise_.3s_ease]">
          <p className="eyebrow text-clay">Your taste</p>
          <h1 className="text-[2rem] leading-[1.15]">{resuming ? "Welcome back. Let's pick up where we left off." : "Now, a quick conversation about you and how you live."}</h1>
          <p className="text-ink-soft">A few minutes, like talking to a designer. Say it out loud or type it, whichever feels easier. Stop whenever you like; everything is saved as you go.</p>
        </div>
        <div className="flex flex-col gap-3">
          <button className="btn btn-primary w-full" onClick={() => begin("talk")}>
            <MicIcon className="h-5 w-5" /> Talk
          </button>
          <button className="btn btn-quiet w-full" onClick={() => begin("type")}>I&apos;d rather type</button>
        </div>
      </div>
    );
  }

  const persona0 = TEST_PERSONAS.find((p) => p.id === persona.id)!;

  return (
    // in dev, room at the bottom so the "What Homebody assumes" pill never covers the persona controls
    <div className={`max-w-xl mx-auto px-6 pt-6 min-h-[100dvh] flex flex-col ${dev ? "pb-24" : "pb-8"}`}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-ink-soft">
          {cur !== "done" ? (
            <button onClick={() => setMode(mode === "talk" ? "type" : "talk")} className="-ml-1 min-h-11 px-1 underline underline-offset-2">
              {mode === "talk" ? "Switch to typing" : "Switch to talking"}
            </button>
          ) : (
            <span className="min-h-11" />
          )}
          <span>{!q ? "Your taste" : left < 1 ? "Less than a minute left" : `About ${Math.round(left)} min left`}</span>
        </div>
        <div className="h-[3px] rounded-full bg-line overflow-hidden">
          <div className="h-full bg-ink transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {mode === "talk" && <Call
          parts={[lead, question]}
          upNext={upNext}
          listen={cur !== "done"}
          hungUp={hungUp}
          onSay={say}
          onEnd={() => {
            setHungUp(true);
            finish("");
          }}
          dev={dev}
        />}

      <div className="flex-1 flex flex-col justify-end gap-6 pt-8">
        {/* the last few turns, fading as they get older */}
        {said.length > 0 && (
          <ol aria-label="Conversation so far" className="flex flex-col gap-2 text-sm">
            {said.slice(-4).map((l, n, all) => (
              <li key={said.length - all.length + n} style={{ opacity: 0.35 + (0.4 * (n + 1)) / all.length }} className={l.who === "you" ? "text-ink-soft" : "text-ink-faint"}>
                {l.who === "you" && <span className="eyebrow mr-2 text-[10px]">You</span>}
                {l.text}
              </li>
            ))}
          </ol>
        )}

        <h1 key={`${said.length}-${cur}`} aria-live="polite" className={`${line.length > 150 ? "text-[1.5rem]" : "text-[1.75rem]"} leading-[1.2] animate-[rise_.3s_ease]`}>{line}</h1>

        {q && <Choices key={`${cur}-${prefill !== undefined}`} q={q} known={k} prefill={prefill} onPick={(label, value) => turn(label, [{ id: cur, value }])} onEnough={s.depth === "all" && !q.core ? () => turn("That's enough for now") : undefined} />}

        {cur === "deeper" && (
          <div className="flex flex-wrap gap-2">
            <Chip active={false} onClick={() => turn("Keep going")}>Keep going</Chip>
            <Chip active={false} onClick={() => turn("Stop here")}>Stop here</Chip>
          </div>
        )}

        {cur === "done" && (
          <div className="flex flex-col gap-3">
            <Link href="/rooms" className="btn btn-primary w-full">See your rooms</Link>
            {moreToAdd && !justStopped && <button className="btn btn-quiet w-full" onClick={() => deeper()}>Add more now</button>}
          </div>
        )}
      </div>

      {cur !== "done" && (
        <div className="mt-8">
          {mode === "type" && (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                say(draft);
                setDraft("");
              }}
            >
              <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Your answer" placeholder="Type your answer…" className="flex-1 min-w-0 rounded-lg border bg-surface px-4 py-3" />
              <button type="submit" disabled={!draft.trim()} aria-label="Send" className="h-12 w-12 shrink-0 rounded-full bg-clay text-bg grid place-items-center disabled:opacity-40">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </button>
            </form>
          )}

          {/* Dev only: play a scripted test persona one reply at a time, as the critic will */}
          {dev && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber">
              <select value={persona.id} onChange={(e) => setPersona({ id: e.target.value, turn: 0 })} aria-label="Test persona" className="rounded border border-amber-soft bg-amber-tint px-2 min-h-9">
                {TEST_PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button
                className="rounded border border-amber-soft bg-amber-tint px-3 min-h-9 disabled:opacity-40"
                disabled={persona.turn >= persona0.turns.length}
                onClick={() => {
                  say(persona0.turns[persona.turn]);
                  setPersona((p) => ({ ...p, turn: p.turn + 1 }));
                }}
              >
                Say next line ({persona.turn}/{persona0.turns.length})
              </button>
            </div>
          )}
        </div>
      )}
      {dev && <AssumptionsPanel known={base} answers={s.answers} notes={notes} />}
    </div>
  );
}

// The current question's choices as chips: a tap answers, the same as saying it.
// A prefill shows already chosen; tapping it confirms it.
function Choices({ q, known, prefill, onPick, onEnough }: { q: Q; known: Known; prefill: Answer | undefined; onPick: (label: string, value: Answer) => void; onEnough?: () => void }) {
  const kind = q.kind;
  const choices = choicesOf(q, known);
  const [picked, setPicked] = useState<string[]>(() => (Array.isArray(prefill) ? prefill : []));
  const label = (ids: string[]) => ids.map((id) => choices.find((c) => c.id === id)?.label ?? id).join(", ");

  return (
    <div className="flex flex-col gap-4">
      {/* numbers sit four to a row, so none is left alone on a line */}
      <div className={kind.type === "number" ? "grid grid-cols-4 gap-2 max-w-xs" : "flex flex-wrap gap-2"}>
        {kind.type === "single" && choices.map((c) => <Chip key={c.id} active={prefill === c.id} onClick={() => onPick(c.label, c.id)}>{c.label}</Chip>)}
        {kind.type === "multi" &&
          choices.map((c) => (
            <Chip
              key={c.id}
              active={picked.includes(c.id)}
              // an exclusive choice ("No pets") clears the others; picking another clears it
              onClick={() => setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : c.exclusive ? [c.id] : [...p.filter((x) => !choices.find((o) => o.id === x)?.exclusive), c.id]))}
            >
              {c.label}
            </Chip>
          ))}
        {kind.type === "number" &&
          Array.from({ length: Math.min(kind.max, 8) - kind.min + 1 }, (_, n) => n + kind.min).map((n) => (
            <Chip key={n} active={prefill === n} onClick={() => onPick(String(n), n)}>{n}</Chip>
          ))}
        {kind.type === "text" && <Chip active={false} onClick={() => onPick("Nothing comes to mind", "")}>Nothing comes to mind</Chip>}
      </div>
      {kind.type === "multi" && (
        <button className="btn btn-quiet self-start px-5 py-2.5" disabled={!picked.length} onClick={() => onPick(label(picked), picked)}>
          That&apos;s it
        </button>
      )}
      {onEnough && <button className="self-start text-sm text-ink-soft underline min-h-11" onClick={onEnough}>That&apos;s enough for now</button>}
    </div>
  );
}

type Phase = "speaking" | "listening" | "thinking" | "idle" | "ended";

// Talk mode as a call: the agent says its line, then the mic opens by itself, the way
// a person would wait for an answer. A calm presence shows who has the floor, with
// Mute and End below it. Phase 0: the browser's own recognizer listens where there is
// one; otherwise, or if it fails, a sheet opens to type what you'd say.
// parts: the acknowledgement, then the question, said in that order (the question may already be fetched).
// listen is false once the conversation is done: the recap is said, then the call ends. hungUp: they
// tapped End, so nothing more is said.
function Call({ parts, upNext, listen: canListen, hungUp, onSay, onEnd, dev }: { parts: string[]; upNext: string; listen: boolean; hungUp: boolean; onSay: (text: string) => void; onEnd: () => void; dev: boolean }) {
  const line = parts.filter(Boolean).join(" ");
  // the phase belongs to a line: a new line starts "thinking" until its sound actually begins,
  // so a neural voice still fetching never shows as a silent "Speaking"
  const [ph, setPh] = useState<{ line: string; phase: Phase }>({ line, phase: "thinking" });
  const phase = ph.line === line ? ph.phase : "thinking";
  // words heard so far, shown as they come
  const [heard, setHeard] = useState("");
  const [hint, setHint] = useState("");
  const [muted, setMuted] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState("");
  const [voice, setVoice] = useState<string | null>(null);
  const rec = useRef<Recognizer | null>(null);
  const quiet = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hush = useRef<() => void>(() => {});
  // read from callbacks that outlive a render
  const live = useRef<{ muted: boolean; canListen: boolean; hungUp: boolean; upNext: string; parts: string[]; listen: (forLine: string) => void }>({ muted, canListen, hungUp, upNext, parts, listen: () => {} });
  // once the recognizer fails (mic denied, offline), the sheet stands in for it
  const broken = useRef(false);

  const stopListening = () => {
    clearTimeout(quiet.current);
    const r = rec.current;
    rec.current = null;
    r?.abort();
  };

  const listen = (forLine: string) => {
    const set = (phase: Phase) => setPh({ line: forLine, phase });
    if (live.current.muted || !live.current.canListen) return set("idle");
    const Ctor = speechIn();
    if (!Ctor || broken.current) {
      set("idle");
      return setSheet(true);
    }
    stopListening();
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    let final = "";
    // some browsers never fire an error with no mic or no sound, so give up gently after a quiet spell
    const wait = (ms: number, then: () => void) => {
      clearTimeout(quiet.current);
      quiet.current = setTimeout(then, ms);
    };
    wait(10000, () => {
      setHint("I didn't hear anything. Tap the circle to try again.");
      r.abort();
    });
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setHeard(final + interim);
      wait(10000, () => r.stop());
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      if (e.error === "no-speech") return setHint("I didn't hear anything. Tap the circle to try again.");
      broken.current = true;
      setHint("The microphone isn't available here, so type what you'd say.");
      setSheet(true);
    };
    r.onend = () => {
      clearTimeout(quiet.current);
      // stopped by us for a new line or End: nothing to hand on
      if (rec.current !== r) return;
      rec.current = null;
      setHeard("");
      if (!final.trim()) return set("idle");
      set("thinking");
      setTimeout(() => onSay(final.trim()), 400);
    };
    rec.current = r;
    setHint("");
    set("listening");
    try {
      r.start();
    } catch {
      rec.current = null;
      broken.current = true;
      set("idle");
      setSheet(true);
    }
  };

  useEffect(() => {
    live.current = { muted, canListen, hungUp, upNext, parts, listen };
  });

  // which voice the browser gave us; dev shows it, so Maeve can tell whether it's a Premium one
  useEffect(() => watchVoice(setVoice), []);

  // each new line: say it, then open the mic; the last line (the recap) is said, then the call ends.
  // After End, nothing more is said.
  useEffect(() => {
    if (live.current.hungUp) return;
    const stop = speak(
      live.current.parts,
      () => (live.current.canListen ? live.current.listen(line) : setPh({ line, phase: "ended" })),
      () => {
        setPh({ line, phase: "speaking" });
        // the fetches for this line are done; fetch what's likely next while it plays
        if (live.current.upNext) prefetch(live.current.upNext);
      },
    );
    hush.current = stop;
    return () => {
      stop();
      clearTimeout(quiet.current);
      const r = rec.current;
      rec.current = null;
      r?.abort();
    };
  }, [line]);

  // tap the presence: while it speaks, skip ahead to your turn; while it listens, you're done; otherwise listen again
  const tap = () => {
    if (muted || !canListen) return;
    if (phase === "listening") return rec.current?.stop();
    hush.current();
    listen(line);
  };
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    live.current.muted = m;
    if (m) {
      stopListening();
      if (phase === "listening") setPh({ line, phase: "idle" });
    } else if (phase === "idle") listen(line);
  };
  const end = () => {
    hush.current();
    stopListening();
    onEnd();
  };

  const status = muted ? "Muted" : phase === "speaking" ? "Speaking" : phase === "listening" ? heard || "Listening…" : phase === "thinking" ? "Thinking…" : hint || "Tap to talk";

  // the call is over only once the recap has been said, or they hung up: the presence stills
  // and says so, with nothing left to press. Until then it keeps speaking.
  if (hungUp || (!canListen && phase === "ended"))
    return (
      <div className="flex flex-col items-center gap-3 pt-8">
        <span className="h-10 w-10 rounded-full bg-line" aria-hidden />
        <p className="text-sm text-ink-soft" aria-live="polite">Call ended</p>
        {dev && <p className="text-xs text-amber">Voice: {voice ?? "none available"}</p>}
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-3 pt-8">
      <button onClick={tap} aria-label={phase === "listening" ? "Done talking" : "Talk"} className="relative h-28 w-28 grid place-items-center">
        <span
          className={`absolute inset-0 rounded-full bg-clay-tint transition-transform duration-500 ${
            muted ? "" : phase === "speaking" ? "animate-[breathe_2.4s_ease-in-out_infinite]" : phase === "listening" ? "animate-[breathe_1.2s_ease-in-out_infinite]" : ""
          }`}
        />
        <span className={`relative h-16 w-16 rounded-full grid place-items-center transition-colors ${muted ? "bg-line" : phase === "listening" ? "bg-clay" : "bg-clay-soft"}`}>
          {phase === "thinking" && !muted && (
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-clay animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
            </span>
          )}
        </span>
      </button>
      <p className="text-sm text-ink-soft min-h-5 text-center max-w-xs" aria-live="polite">{status}</p>
      {canListen && (
        <div className="flex items-center gap-8">
          <button onClick={toggleMute} aria-pressed={muted} className="flex flex-col items-center gap-1 text-xs text-ink-soft">
            <span className={`h-11 w-11 rounded-full border grid place-items-center ${muted ? "border-ink bg-ink text-bg" : ""}`}>
              <MicIcon className="h-5 w-5" off={muted} />
            </span>
            {muted ? "Unmute" : "Mute"}
          </button>
          <button onClick={end} className="flex flex-col items-center gap-1 text-xs text-ink-soft">
            <span className="h-11 w-11 rounded-full border border-rust-soft text-rust grid place-items-center">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </span>
            End
          </button>
        </div>
      )}
      {dev && <p className="text-xs text-amber">Voice: {voice ?? "none available"}</p>}

      {sheet && (
        <div role="dialog" aria-label="Type what you'd say" className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-surface shadow-[0_-8px_24px_rgba(0,0,0,0.08)] animate-[rise_.2s_ease]">
          <form
            className="max-w-xl mx-auto px-6 pt-5 pb-8 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              onSay(draft);
              setDraft("");
              setSheet(false);
            }}
          >
            <p className="text-sm text-ink-soft">{hint.startsWith("The microphone") ? hint : "The mic isn't connected yet in this preview. Type what you'd say and it's heard the same way."}</p>
            <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Say it the way you'd say it…" className="w-full rounded-lg border bg-bg px-4 py-3 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="flex gap-3">
              <button type="button" className="btn btn-quiet flex-1" onClick={() => setSheet(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary flex-1" disabled={!draft.trim()}>Say it</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function MicIcon({ className, off }: { className?: string; off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}
