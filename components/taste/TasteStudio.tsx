"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Dossier, { type Entry } from "./Dossier";
import ReadBack from "./ReadBack";
import VisualSet from "./VisualSet";
import { useMic } from "./useMic";
import { TEST_PERSONAS } from "@/lib/taste/agent";
import { deFluff } from "@/lib/taste/craft";
import { pageFacts } from "@/lib/taste/dossier";
import { offlineTurn } from "@/lib/taste/offline";
import type { Known } from "@/lib/taste/questions";
import { loadKnown, readSaved, STORE_KEY, type Saved } from "@/lib/taste/saved";
import { askedLength, FINISH, KEEP_GOING, LENGTH_IDS, LENGTHS, newPace, nextSection, remaining, type Length, type Pace, type SectionKey } from "@/lib/taste/pace";
import { applyTaste, applyTurn, migrateConvo, newConvo, norm, normalizeTurn, ORDER, unescape, SECTIONS, TurnSchema, type Concept, type State, type Turn } from "@/lib/taste/session";
import { describeTaste, EMPTY_TASTE, blend, FAMILIES, MATERIAL, PALETTE, PATTERN, type SetId, type TasteState } from "@/lib/taste/visual";
import { speak } from "@/lib/taste/voice";

// Taste Builder as a designer's intake interview (Maeve, 2026-10-27): three sections people
// can see, an open conversation inside each with the live designer (/api/taste/turn), visual
// choices for taste, and a dossier that draws itself as they talk, ending in "here's what I
// heard". Voice first (Lily via lib/taste/voice.ts, the browser's recognizer listening),
// typing one tap away. With no key or on any error it carries on with the free interpreter.

const AssumptionsPanel = dynamic(() => import("@/components/AssumptionsPanel"), { ssr: false });

type Full = Saved & { taste: TasteState; convo: NonNullable<Saved["convo"]> };
function load(): Full {
  const s = readSaved();
  // older saved conversations (life / taste / story, no pace) read as the new sections
  return { ...s, taste: s.taste ?? EMPTY_TASTE, convo: s.convo ? migrateConvo(s.convo) : newConvo() };
}

export default function TasteStudio() {
  const [saved, setSaved] = useState<Full>(load);
  const [base, setBase] = useState<Omit<Known, "answers"> | null>(null);
  // coming back to a finished brief opens on the brief, not the intro
  const [mode, setMode] = useState<"intro" | "talk" | "type">(() => (saved.convo.concept && (saved.convo.section === "readback" || saved.convo.section === "done") ? "type" : "intro"));
  const [busy, setBusy] = useState(false);
  // the designer has been thinking a while
  const [slow, setSlow] = useState(false);
  // dev builds show when a turn came from the free interpreter, so a broken live designer can't hide
  const [wasOffline, setWasOffline] = useState(false);
  const [live, setLive] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [draft, setDraft] = useState("");
  // the tree question the offline interpreter last asked, so it knows what an answer is for
  const [cur, setCur] = useState<string | null>(null);
  // a set they closed without finishing, kept a tap away
  const [parked, setParked] = useState<SetId | null>(null);
  const [dev] = useState(() => process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("dev") === "1");
  const [usage, setUsage] = useState<{ input: number; output: number; cached: number; offline?: boolean }[]>([]);
  const [persona, setPersona] = useState({ id: TEST_PERSONAS[0].id, turn: 0 });
  // the length shown selected on the intro: what they start with counts as their choice, even the
  // default they didn't touch (the critic, 2026-10-29: a visibly chosen Standard was being overridden)
  const [pick, setPick] = useState<Length>(() => saved.convo.pace?.length ?? "standard");
  const mic = useMic();
  const latest = useRef(saved);
  const modeRef = useRef(mode);
  const hush = useRef<() => void>(() => {});
  const dossierRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    latest.current = saved;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    } catch {}
  }, [saved]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    let alive = true;
    loadKnown().then((k) => alive && setBase(k));
    return () => {
      alive = false;
    };
  }, []);

  const c = saved.convo;
  const notes = saved.notes ?? [];
  const factList = base ? pageFacts(base, saved.answers, notes, saved.taste, c) : [];
  // draw the newest line into view on a phone, where the page scrolls under the conversation
  // the read-back opens at its top: the pictures first
  const atReadback = c.section === "readback" || c.section === "done";
  useEffect(() => {
    const t = setTimeout(() => {
      if (atReadback) return dossierRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      const el = dossierRef.current?.querySelector(`[data-at="${c.turns}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 200);
    return () => clearTimeout(t);
  }, [c.turns, atReadback]);

  if (!base) return <div className="min-h-[100dvh] bg-bg" />;

  // an empty room name from the capture counts as missing
  const room = base.intake?.room?.trim().toLowerCase() || "room";
  const state = (s: Full): State => ({ answers: s.answers, notes: s.notes ?? [], taste: s.taste, convo: s.convo });
  const entries: Entry[] = [
    ...factList.map((f) => ({ ...f, id: `f-${f.key}`, at: c.factsAt?.[f.key] ?? c.turns, crossed: c.crossedFacts?.includes(`${f.key}::${norm(f.text)}`) })),
    ...c.dossier.map((d) => ({ ...d, text: unescape(d.text), because: d.because && unescape(d.because) })),
  ].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));

  const commit = (s: State, extra: Partial<Saved> = {}) => {
    // note when each plain fact first shows, so it draws in once
    const factsAt = { ...(s.convo.factsAt ?? {}) };
    for (const f of pageFacts(base, s.answers, s.notes, s.taste, s.convo)) factsAt[f.key] ??= s.convo.turns;
    const next: Full = { ...latest.current, ...extra, answers: s.answers, notes: s.notes, taste: s.taste, convo: { ...s.convo, factsAt } };
    latest.current = next;
    setSaved(next);
    return next;
  };

  const listenNext = () => {
    if (modeRef.current !== "talk" || mic.broken) return;
    const cv = latest.current.convo;
    if (cv.showing || cv.confirmed) return;
    mic.listen((t) => send(t));
  };

  const say = (text: string) => {
    hush.current();
    mic.stop();
    if (modeRef.current !== "talk") return;
    setSpeaking(true);
    hush.current = speak(text, () => {
      setSpeaking(false);
      listenNext();
    });
  };

  // offline: this turn came from the free interpreter; stay: and so do the rest (no key, or the turn cap)
  const land = (s: State, turn: Turn & { cur?: string | null }, offline: boolean, stay = offline) => {
    // what's already drawn: the plain facts and the visual picks (their names, all together too)
    const picks = [
      ...s.taste.materials.liked.map((id) => MATERIAL.get(id)?.label ?? ""),
      ...s.taste.palettes.liked.map((id) => PALETTE.get(id)?.name ?? ""),
      ...s.taste.patterns.liked.map((id) => PATTERN.get(id)?.label ?? ""),
    ];
    const onPage = pageFacts(base, s.answers, s.notes, s.taste, s.convo);
    const shown = [...onPage.flatMap((f) => [f.text, f.because ?? ""]), ...picks, picks.join(" ")];
    const { state: next } = applyTurn(base, s, turn, shown, onPage.map((f) => ({ id: `f-${f.key}`, text: f.text })), unconfirmed(base, s).patterns);
    if (offline) setCur(turn.cur ?? null);
    commit({ ...next, convo: { ...next.convo, offline: next.convo.offline || stay } });
    setBusy(false);
    setSlow(false);
    setWasOffline(offline);
    setLive("");
    // the line as kept (filler cut, the stopping point if it was due), not the raw one
    say(next.convo.transcript.at(-1)?.text ?? turn.say);
  };

  // One turn: the live designer, streaming its line as it writes; the free interpreter if that fails
  const run = async (s: State, text: string | null, event: boolean, finished = false) => {
    setBusy(true);
    setLive("");
    // a finished section carries no answer: the interpreter just opens the next one
    if (s.convo.offline) return land(s, offlineTurn(base, s, finished ? null : text, finished ? null : cur, event), true);
    // "Still thinking…" after about 12 s; at 25 s this turn is answered offline instead
    const abort = new AbortController();
    const slowTimer = setTimeout(() => setSlow(true), 12000);
    const giveUp = setTimeout(() => abort.abort(), 25000);
    try {
      const res = await fetch("/api/taste/turn", {
        signal: abort.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          convo: s.convo.id, turns: s.convo.turns, section: s.convo.section, known: base, answers: s.answers, notes: s.notes,
          taste: describeTaste(s.taste), shown: s.taste.shown, unconfirmed: unconfirmed(base, s).lines, page: [
            ...pageFacts(base, s.answers, s.notes, s.taste, { ...s.convo, offline: false }).map((f) => ({ id: `f-${f.key}`, zone: f.zone, text: f.because ? `${f.text} (because: ${f.because})` : f.text, sure: f.sure, crossed: s.convo.crossedFacts?.includes(`${f.key}::${norm(f.text)}`) })),
            ...s.convo.dossier.map((e) => ({ id: e.id, zone: e.zone, text: e.because ? `${e.text} (because: ${e.because})` : e.text, sure: e.sure, crossed: e.crossed })),
          ], moods: s.convo.moods,
          transcript: s.convo.transcript,
          pace: s.convo.pace, finished, brief: s.convo.concept,
        }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 503 || res.status === 429 ? "stay offline" : String(res.status));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let turn: Turn | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const m = JSON.parse(line);
          if (m.t === "unavailable") throw new Error("stay offline");
          if (m.t === "say") setLive(deFluff(m.text, true));
          else if (m.t === "error") throw new Error(m.message);
          else if (m.t === "done") {
            const parsed = TurnSchema.safeParse(m.turn);
            if (!parsed.success) throw new Error("bad turn");
            turn = normalizeTurn(parsed.data, s.convo.section);
            if (dev) setUsage((u) => [...u, m.usage]);
          }
        }
      }
      if (!turn) throw new Error("no turn");
      clearTimeout(slowTimer);
      clearTimeout(giveUp);
      land(s, turn, false);
    } catch (e) {
      clearTimeout(slowTimer);
      clearTimeout(giveUp);
      // a passing error answers this one turn offline; the next tries the designer again
      if (dev) setUsage((u) => [...u, { input: 0, output: 0, cached: 0, offline: true }]);
      land(s, offlineTurn(base, s, finished ? null : text, s.convo.transcript.length > 1 && !finished ? cur : null, event), true, e instanceof Error && e.message === "stay offline");
    }
  };

  const send = (text: string, event = false) => {
    const t = text.trim();
    if (!t || busy) return;
    // in the read-back, her "that's it" is the confirm: no second button to press
    const cv = latest.current.convo;
    if (!event && cv.concept && cv.section === "readback" && !cv.confirmed && t.length < 60 && CONFIRM.test(t)) return confirm(t);
    hush.current();
    setSpeaking(false);
    mic.stop();
    const s = state(latest.current);
    const sec = s.convo.section;
    let pace: Pace = s.convo.pace ?? newPace();
    // "I'm finished with this section" (or "Move on" after the stopping point): on to the next one now
    const finishing = !event && !s.convo.concept && SECTIONS.some((x) => x.id === sec) && FINISH.test(t);
    // every reply counts toward its section's length, except the "keep going" after a stopping point
    if (!finishing && SECTIONS.some((x) => x.id === sec) && !KEEP_GOING.test(t)) pace = { ...pace, replies: { ...pace.replies, [sec]: (pace.replies[sec as SectionKey] ?? 0) + 1 } };
    // "let's wrap up", "I've got more time": the length they asked for
    const asked = event ? null : askedLength(t, pace.length);
    if (asked) pace = { ...pace, length: asked, chosen: true };
    const section = finishing ? nextSection(sec) : sec;
    const next = { ...s, convo: { ...s.convo, section, pace, showing: finishing ? undefined : s.convo.showing, transcript: [...s.convo.transcript, { who: "you" as const, text: t, ...(event ? { event: true } : {}) }], suggestions: [] } };
    if (finishing) setParked(null);
    commit(next);
    void run(next, t, event, finishing);
  };
  const finishSection = () => send("I'm finished with this section.");
  const setLength = (length: Length) => {
    const s = state(latest.current);
    commit({ ...s, convo: { ...s.convo, pace: { ...(s.convo.pace ?? newPace()), length, chosen: true } } });
  };

  const begin = (m: "talk" | "type") => {
    setMode(m);
    modeRef.current = m;
    let s = state(latest.current);
    // the length picked on the intro, before the first line
    if (!s.convo.transcript.length && pick) s = state(commit({ ...s, convo: { ...s.convo, pace: { ...(s.convo.pace ?? newPace()), length: pick, chosen: true } } }));
    if (!s.convo.transcript.length) void run(s, null, false);
    else if (m === "talk") say(s.convo.transcript.filter((l) => l.who === "agent").at(-1)?.text ?? "");
  };

  const pickedSet = (set: SetId, t: TasteState, summary: string) => {
    setParked(null);
    const s = applyTaste(base, state(latest.current), t);
    commit({ ...s, convo: { ...s.convo, showing: undefined } });
    send(summary, true);
    void set;
  };

  const confirm = (said = "Yes, this is it") => {
    const s = state(latest.current);
    const line = `Thank you. That's the brief. I'll start on ideas for your ${room}, and you can add more anytime.`;
    commit({ ...s, convo: { ...s.convo, confirmed: true, section: "done", transcript: [...s.convo.transcript, { who: "you", text: said }, { who: "agent", text: line }] } }, { cur: "done" });
    say(line);
  };
  const editConcept = (concept: Concept) => {
    const s = state(latest.current);
    commit({ ...s, convo: { ...s.convo, concept } });
  };
  const startOver = () => {
    hush.current();
    mic.stop();
    const next: Full = { ...load(), cur: "", history: [], answers: {}, notes: [], depth: "core", taste: EMPTY_TASTE, convo: newConvo() };
    latest.current = next;
    setSaved(next);
    setCur(null);
    setPick("standard");
    setMode("intro");
  };

  const agentLines = c.transcript.filter((l) => l.who === "agent");
  const line = busy ? live : agentLines.at(-1)?.text ?? "";
  const lastYou = [...c.transcript].reverse().find((l) => l.who === "you");
  const sectionIdx = ORDER.indexOf(c.section);
  const readback = (c.section === "readback" || c.section === "done") && c.concept;
  const showing = c.showing && !busy ? c.showing : null;
  const persona0 = TEST_PERSONAS.find((p) => p.id === persona.id)!;
  const pace = c.pace ?? newPace();
  const inSection = SECTIONS.some((x) => x.id === c.section) && !c.confirmed;
  const left = remaining(pace, c.section, { answers: saved.answers, shown: saved.taste.shown, practical: c.dossier.filter((d) => d.zone === "practical" && !d.crossed).map((d) => d.text) });

  if (mode === "intro") {
    const resuming = c.transcript.length > 0;
    return (
      <div className="min-h-[100dvh] bg-bg">
        <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:pb-12 sm:pt-8">
          <p className="wordmark text-[1.75rem] mt-1">homebody</p>
          <div className="flex flex-1 flex-col justify-center gap-6 py-8 animate-rise">
            <p className="eyebrow text-clay">Meet your designer</p>
            <h1 className="text-title sm:text-[2.75rem]">{c.confirmed ? "Your brief is ready." : resuming ? "Welcome back. Let's pick up where we left off." : "Before I design anything, I'd love to get to know you."}</h1>
            <p className="text-[1.0625rem] leading-relaxed text-ink-soft">
              Three short sections. The more you share, the better I&apos;ll know your style, but you can say &ldquo;I&apos;m finished with this section&rdquo; anytime and we&apos;ll move on. You can always come back and add more.
            </p>
            <ol className="flex flex-col border-y">
              {SECTIONS.map((s, i) => (
                <li key={s.id} className="grid grid-cols-[1.75rem_1fr] items-baseline gap-x-2 border-t py-3 first:border-t-0 settle" style={{ ["--delay" as string]: `${0.15 + i * 0.1}s` }}>
                  <span className="text-xs num font-semibold text-clay">0{i + 1}</span>
                  <span>
                    <span className="font-medium text-ink">{s.label}</span>
                    <span className="block text-sm text-ink-soft">{s.about}</span>
                  </span>
                </li>
              ))}
            </ol>
            {!c.confirmed && !c.concept && (
              <fieldset>
                <legend className="mb-2.5 text-sm font-medium text-ink">How much time do you have?</legend>
                <div className="grid grid-cols-3 gap-2">
                  {LENGTH_IDS.map((id) => {
                    const on = (pick ?? c.pace?.length ?? "standard") === id;
                    return (
                      <label key={id} className={`flex min-h-16 cursor-pointer flex-col justify-center rounded-2xl border px-3 py-2.5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-clay ${on ? "border-clay bg-clay-tint text-ink" : "bg-surface text-ink-soft hover:border-line-strong"}`}>
                        <input type="radio" name="length" value={id} checked={on} onChange={() => setPick(id)} className="sr-only" />
                        <span className={`text-[14.5px] ${on ? "font-medium" : ""}`}>{LENGTHS[id].label}</span>
                        <span className="text-xs num text-ink-faint">{LENGTHS[id].time}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>
          {c.confirmed ? (
            <button className="btn btn-primary w-full" onClick={() => begin("type")}>See your brief</button>
          ) : (
          <div className="flex flex-col gap-3">
            <button className="btn btn-primary w-full" onClick={() => begin("talk")}>
              <MicIcon className="h-5 w-5" /> {resuming ? "Carry on talking" : "Start talking"}
            </button>
            <button className="link link-quiet self-center min-h-11 px-3 text-[15px]" onClick={() => begin("type")}>I&apos;d rather type</button>
          </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-bg lg:grid lg:grid-cols-[minmax(380px,0.85fr)_minmax(0,1.15fr)]">
      {/* the conversation: a dock under the page on a phone, the left column on a desktop */}
      <aside className="order-2 flex shrink-0 flex-col border-t bg-bg px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-3.5 shadow-[0_-12px_32px_-24px_rgb(0_0_0/0.25)] lg:order-1 lg:h-[100dvh] lg:border-r lg:border-t-0 lg:px-12 lg:pb-10 lg:pt-9 lg:shadow-none">
        <div className="hidden lg:flex lg:items-center lg:justify-between">
          <p className="wordmark text-[1.5rem] text-ink">homebody</p>
          <Sections idx={sectionIdx} />
        </div>

        <div className="lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:max-w-[34rem]">
          {lastYou && !lastYou.event && <p className="mb-4 hidden border-l-2 border-line pl-3 text-sm text-ink-soft lg:block"><span className="eyebrow mb-0.5 block text-ink-faint">You said</span>{lastYou.text}</p>}
          <div className="flex items-start gap-3">
            <Presence speaking={speaking} thinking={busy && !live} listening={mic.listening} />
            <p aria-live="polite" className={`min-h-[2.6em] font-display text-[1.25rem] leading-[1.3] text-ink lg:text-[2.125rem] lg:leading-[1.16] lg:tracking-[-0.015em] ${busy && !live ? "text-ink-faint" : ""}`}>
              {line || (busy ? (slow ? "Still thinking…" : "…") : "")}
            </p>
          </div>
        </div>

        {/* how much is left, the length, and the way out of this section */}
        {inSection && (
          <div className="mt-3 flex items-center justify-between gap-x-2 whitespace-nowrap text-xs text-ink-faint lg:mt-6 lg:border-t lg:pt-3">
            <span className="flex min-w-0 items-center gap-1.5">
              {/* dev builds only: this turn (or the rest) came from the free interpreter */}
              {process.env.NODE_ENV !== "production" && (c.offline || wasOffline) && <span className="rounded-full bg-amber-tint px-1.5 text-2xs text-amber" title="Answered by the free interpreter">offline</span>}
              <span aria-live="polite" className="num">{left <= 1 ? "Nearly done" : `About ${left} left`}</span>
              <span aria-hidden>·</span>
              <select value={pace.length} onChange={(e) => setLength(e.target.value as Length)} aria-label="Conversation length" className="link link-quiet min-h-8 appearance-none bg-transparent">
                {LENGTH_IDS.map((id) => <option key={id} value={id}>{LENGTHS[id].label}</option>)}
              </select>
            </span>
            <button onClick={finishSection} disabled={busy} className="link link-quiet min-h-8">
              I&apos;m finished with this section
            </button>
          </div>
        )}

        {/* quick replies, a parked set, and the end */}
        <div className="mt-3 flex flex-wrap gap-1.5 empty:hidden">
          {!busy && !readback && (c.suggestions ?? []).map((x) => (
            <button key={x} onClick={() => send(x)} className="chip animate-rise">{x}</button>
          ))}
          {!busy && parked && !c.showing && (
            <button onClick={() => { const s = state(latest.current); commit({ ...s, convo: { ...s.convo, showing: parked } }); setParked(null); }} aria-pressed="true" className="chip">Show me the pictures</button>
          )}
        </div>

        {c.confirmed ? (
          <div className="mt-3 flex gap-3">
            <Link href="/rooms" className="btn btn-primary flex-1">See your rooms</Link>
          </div>
        ) : (
          <Composer
            mode={mode === "talk" && !mic.broken ? "talk" : "type"}
            busy={busy}
            mic={mic}
            speaking={speaking}
            draft={draft}
            setDraft={setDraft}
            onSend={(t) => { send(t); setDraft(""); }}
            onTalk={() => { if (speaking) { hush.current(); setSpeaking(false); } if (mic.listening) mic.finish(); else mic.listen((t) => send(t)); }}
            onSwitch={(m) => { setMode(m); modeRef.current = m; if (m === "type") { mic.stop(); } }}
          />
        )}

        {dev && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-amber">
            <select value={persona.id} onChange={(e) => setPersona({ id: e.target.value, turn: 0 })} aria-label="Test persona" className="rounded border border-amber-soft bg-amber-tint px-2 min-h-8">
              {TEST_PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="rounded border border-amber-soft bg-amber-tint px-2.5 min-h-8 disabled:opacity-40" disabled={busy || persona.turn >= persona0.turns.length} onClick={() => { send(persona0.turns[persona.turn]); setPersona((p) => ({ ...p, turn: p.turn + 1 })); }}>
              Say next line ({persona.turn}/{persona0.turns.length})
            </button>
            <button className="rounded border border-amber-soft bg-amber-tint px-2.5 min-h-8" onClick={startOver}>Start over</button>
            <span>{c.offline ? "offline interpreter" : "live designer"} · turn {c.turns} · {usage.reduce((n, u) => n + u.input + u.output, 0)} tok</span>
          </div>
        )}
      </aside>

      {/* their page */}
      <main ref={dossierRef} className="order-1 min-h-0 flex-1 overflow-y-auto lg:order-2 lg:h-[100dvh] lg:bg-surface-2">
        <div className="glass sticky top-0 z-20 flex items-center justify-between border-b border-line/70 px-4 pb-2.5 pt-3 lg:hidden">
          <p className="wordmark text-[1.375rem] text-ink">homebody</p>
          <Sections idx={sectionIdx} />
        </div>
        <div className="mx-auto max-w-[780px] px-3 pb-8 pt-1 sm:px-6 lg:px-10 lg:pb-16 lg:pt-12">
          {readback ? (
            <ReadBack concept={c.concept!} taste={saved.taste} entries={entries} confirmed={!!c.confirmed} room={room} offline={!!c.offline} onEdit={editConcept} onConfirm={() => confirm()} />
          ) : (
            <Dossier room={room} moods={c.moods} entries={entries} taste={saved.taste} section={c.section} />
          )}
        </div>
      </main>

      {showing && (
        <VisualSet
          said={c.transcript.filter((l) => l.who === "you" && !l.event).map((l) => l.text).join(" ")}
          key={showing}
          set={showing}
          taste={saved.taste}
          onDone={(t, summary) => pickedSet(showing, t, summary)}
          onClose={() => { setParked(showing); const s = state(latest.current); commit({ ...s, convo: { ...s.convo, showing: undefined } }); }}
          onFinish={finishSection}
        />
      )}

      {dev && (
        <AssumptionsPanel
          known={base}
          answers={saved.answers}
          notes={notes}
          extra={[
            ...Object.entries(c.buckets).map(([k, v]) => ({ group: "Live designer (dev)", label: `Persona: ${k}`, value: `${Math.round((v?.weight ?? 0) * 100)}%`, because: v?.because ?? "" })),
            ...blend(saved.taste).map((x) => ({ group: "Live designer (dev)", label: "Style blend", value: `${x.pct}% ${x.label}`, because: "From room, palette, material and pattern picks, chips, pairs and their words" })),
            ...c.inferred.slice(-6).map((x) => ({ group: "Live designer (dev)", label: `Words → ${FAMILIES[x.family as keyof typeof FAMILIES] ?? x.family}`, value: x.weight > 0 ? "toward" : "away", because: x.because })),
            ...c.moods.map((m) => ({ group: "Live designer (dev)", label: "Mood word", value: m, because: "Said in conversation" })),
          ]}
        />
      )}
    </div>
  );
}

const CONFIRM = /^(that'?s it|this is it|that'?s everything|yes|yep|yeah|yup|perfect|looks? (good|right|great)|sounds (good|right)|all good|correct|that'?s right|love it|spot on)\b/i;

// What she never said or confirmed: the pencil lines on her page and an anchor she didn't name.
// lines go to the designer ("never in the statement or rows"); patterns let the page check the statement.
const CLAIM: Record<string, RegExp> = {
  "use-relax": /\bunwind\w*|\brelax\w*|\blounging\b/i, "use-tv": /\bfilms?\b|\bmovies?\b|\btv\b|\bwatching\b/i,
  "use-reading": /\bread(ing|s)?\b|\bbooks?\b/i, "use-hosting": /\bfriends\b|\bguests?\b|\bhost\w*/i,
  "use-eating": /\bmeals?\b|\bdinners?\b|\beat(ing)?\b/i, "use-working": /\bwork(ing|s)?\b|\bdesk\b/i,
  "use-sleeping": /\bsleep\w*/i, "use-play": /\bplay\w*/i, wfh: /\bdesk\b/i, host: /\bdinner party|\bhosting\b/i,
};
function unconfirmed(base: Omit<Known, "answers">, s: State): { lines: string[]; patterns: RegExp[] } {
  const pencil = pageFacts(base, s.answers, s.notes, s.taste, s.convo).filter((f) => !f.sure);
  const lines = pencil.map((f) => f.text);
  const patterns = pencil.map((f) => CLAIM[f.key]).filter(Boolean) as RegExp[];
  const anchor = s.answers.anchor;
  if (typeof anchor !== "string" || anchor === "none" || s.convo.designerSet?.includes("anchor")) {
    const names = (base.scan?.items ?? []).map((i) => i.name.toLowerCase().split(" ").pop()!).filter((n) => n.length > 2);
    if (names.length) {
      lines.push(`that the room "starts from" any of their pieces (they named no anchor)`);
      patterns.push(new RegExp(`starts? from[^,.;:]*\\b(${names.join("|")})`, "i"));
    }
  }
  return { lines, patterns };
}

function Sections({ idx }: { idx: number }) {
  return (
    <ol className="flex items-center gap-3 sm:gap-4" aria-label="Sections">
      {SECTIONS.map((s, i) => {
        const done = idx > i;
        const now = idx === i;
        return (
          <li key={s.id} aria-current={now ? "step" : undefined} className="flex flex-col items-start gap-1">
            <span className={`flex items-center gap-1 text-[11.5px] sm:text-xs transition-colors ${now ? "text-ink font-medium" : done ? "text-ink-soft" : "text-ink-faint"}`}>
              {done && <svg className="text-clay" width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              <span className="sm:hidden">{s.short}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </span>
            <span className={`h-[2px] w-full rounded-full transition-colors duration-500 ${now ? "bg-clay" : done ? "bg-clay-soft" : "bg-line"}`} />
          </li>
        );
      })}
    </ol>
  );
}

// Who has the floor: a slow swell while the designer speaks, a quicker one while it listens
function Presence({ speaking, thinking, listening }: { speaking: boolean; thinking: boolean; listening: boolean }) {
  return (
    <span className="relative mt-1.5 grid h-5 w-5 shrink-0 place-items-center lg:mt-3" aria-hidden>
      <span className={`absolute inset-0 rounded-full bg-clay-tint ${speaking ? "animate-[breathe_2.4s_ease-in-out_infinite]" : listening ? "animate-[breathe_1.1s_ease-in-out_infinite]" : ""}`} />
      <span className={`relative h-2.5 w-2.5 rounded-full ${thinking ? "bg-clay-soft animate-pulse" : "bg-clay"}`} />
    </span>
  );
}

function Composer({ mode, busy, mic, speaking, draft, setDraft, onSend, onTalk, onSwitch }: {
  mode: "talk" | "type";
  busy: boolean;
  mic: ReturnType<typeof useMic>;
  speaking: boolean;
  draft: string;
  setDraft: (s: string) => void;
  onSend: (t: string) => void;
  onTalk: () => void;
  onSwitch: (m: "talk" | "type") => void;
}) {
  if (mode === "talk")
    return (
      <div className="mt-3 flex items-center gap-3">
        <button onClick={onTalk} disabled={busy} aria-label={mic.listening ? "Done talking" : "Talk"} className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-full transition-[background-color,transform] active:scale-95 disabled:opacity-50 ${mic.listening ? "bg-clay text-on-clay" : "bg-clay-tint text-clay hover:bg-clay-soft"}`}>
          {mic.listening && <span className="absolute inset-0 rounded-full bg-clay/25 animate-[breathe_1.1s_ease-in-out_infinite]" aria-hidden />}
          <MicIcon className="relative h-6 w-6" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm text-ink-soft" aria-live="polite">
          {mic.listening ? mic.heard || "Listening…" : speaking ? "Tap the mic to jump in" : busy ? "Thinking…" : mic.hint || "Tap to talk"}
        </p>
        <button onClick={() => onSwitch("type")} className="grid h-11 w-11 place-items-center rounded-full border border-line-strong text-ink-soft transition-colors hover:text-ink hover:border-ink-faint" aria-label="Type instead">
          <KeyboardIcon className="h-5 w-5" />
        </button>
      </div>
    );
  return (
    <form className="mt-3 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) onSend(draft); }}>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Your answer" placeholder={busy ? "One moment…" : "Type your answer…"} className="field min-w-0 flex-1 !rounded-full px-5 text-[15px]" autoComplete="off" />
      <button type="submit" disabled={!draft.trim() || busy} aria-label="Send" className="btn btn-primary !h-12 !w-12 !min-h-0 shrink-0 !rounded-full !p-0">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
      {!mic.broken && (
        <button type="button" onClick={() => onSwitch("talk")} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line-strong text-ink-soft transition-colors hover:text-ink hover:border-ink-faint" aria-label="Talk instead">
          <MicIcon className="h-5 w-5" />
        </button>
      )}
    </form>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </svg>
  );
}
