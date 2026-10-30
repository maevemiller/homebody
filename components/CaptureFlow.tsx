"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import MorePhotos from "@/components/MorePhotos";
import RoomSort, { useBins } from "@/components/RoomSort";
import { PathStage } from "@/components/path/PathOverview";
import { waitLine } from "@/lib/scan/waitLine";
import type { RoomSpec } from "@/lib/scan/spec";
import type { BuildInfo, RoomStatus } from "@/lib/scan/store";

const GlbViewer = dynamic(() => import("@/components/GlbViewer"), { ssr: false });

// The Space Capture flow from the agreed prototype: one question per screen,
// a progress bar across Space · Capture · Inventory · Review, and time left.
// The capture steps run the real pipeline (Claude reads photos, Blender builds).

interface Answers {
  scope?: "room" | "apartment" | "house";
  room: string;
  access?: "yes" | "no";
  have: string[];
  // the room's size in meters: undefined until asked, null for "I don't know"
  length?: number | null;
  width?: number | null;
  unit?: "ft" | "m";
  // what was sent to the build, written from length and width
  measurement: string;
  bringing?: "yes" | "no";
  brought: string[];
  // older runs asked for a wishlist here; Taste Builder will take it over
  wish?: "yes" | "no";
  wishUrl?: string;
}

interface Saved {
  cur: string;
  history: string[];
  answers: Answers;
  roomId?: string;
  // detected items the owner said aren't actually in the room
  absent?: string[];
  // back on the sort screen from the review ("Change something"): done sorting returns to the review
  revise?: boolean;
}

// Items Claude was less sure of, and that were left on Keep, get a quick "is this really here?" before the review
const UNSURE = 0.65;

const START: Saved = { cur: "welcome", history: [], answers: { room: "", have: [], measurement: "", brought: [] } };
const STORE_KEY = "homebody-capture";

const SECTIONS = ["Space", "Capture", "Inventory", "Review"];
const SEC: Record<string, number> = {
  scope: 0, whichroom: 0, access: 0,
  have: 1, tips: 1, upload: 1, length: 1, width: 1, build: 1,
  sort: 2, confirm: 2, bringing: 2, brought: 2,
  review: 3, handoff: 3,
};
// Rough minutes per screen, for "About N min left"
const MIN: Record<string, number> = {
  welcome: 0, scope: 0.2, whichroom: 0.2, access: 0.2, have: 0.3, tips: 0.5, upload: 2, length: 0.3, width: 0.3,
  build: 4, sort: 1.5, confirm: 0.3, bringing: 0.2, brought: 0.5, review: 0.5, handoff: 0,
};

const ftIn = (m: number) => {
  const inches = Math.round(m * 39.37);
  return `${Math.floor(inches / 12)}′${inches % 12 ? ` ${inches % 12}″` : ""}`;
};

// The room they named, if they named one. "One room" never asks, so it stays "your room".
const named = (a: Answers) => (a.scope && a.scope !== "room" && a.room ? a.room : "");
const measurementsOnly = (a: Answers) => a.access === "no" && a.have.length === 1 && a.have[0] === "dims";

// Plausible room sides, the same range the measurements-only build accepts
const MIN_SIDE = 1.5;
const MAX_SIDE = 40;
const FT = 0.3048;
const IN = 0.0254;

/** "14′ 2″" or "4.25 m" */
const side = (m: number, unit: "ft" | "m" = "ft") => (unit === "m" ? `${Number(m.toFixed(2))} m` : ftIn(m));

/** What the build reads, from whatever sides are known. Both sides read as "L × W ft|m" so the box-room parser takes it too. */
function measurementText(a: Answers): string {
  const unit = a.unit ?? "ft";
  const L = a.length ?? null;
  const W = a.width ?? null;
  const n = (m: number) => Number((m / (unit === "m" ? 1 : FT)).toFixed(2));
  if (L && W) return `${n(L)} × ${n(W)} ${unit}: the room is about ${side(L, unit)} long and ${side(W, unit)} wide`;
  if (L) return `The room is about ${side(L, unit)} long; the width isn't known`;
  if (W) return `The room is about ${side(W, unit)} wide; the length isn't known`;
  return "";
}

// The sort screen keeps its choices in this browser; read them fresh so the last look sees the latest
function readBins(roomId?: string): Record<string, string | undefined> {
  if (!roomId) return {};
  try {
    return JSON.parse(localStorage.getItem(`homebody-bins-${roomId}`) ?? "{}");
  } catch {
    return {};
  }
}

function route(a: Answers, itemCount: number | null, askConfirm = false) {
  const r = ["welcome", "scope"];
  if (a.scope && a.scope !== "room") r.push("whichroom");
  r.push("access");
  r.push(a.access === "no" ? "have" : "tips");
  if (!measurementsOnly(a)) r.push("upload");
  r.push("length", "width", "build");
  if (itemCount !== 0) r.push("sort");
  r.push("bringing");
  if (a.bringing === "yes") r.push("brought");
  // the last look sits just before the review, once everything else is settled
  if (askConfirm) r.push("confirm");
  r.push("review", "handoff");
  return r;
}

/** Saved state from older runs can name steps that no longer exist: drop them, and land on the first open step. */
function restore(raw: Partial<Saved>): Saved {
  const answers = { ...START.answers, ...raw.answers };
  const history = (raw.history ?? []).filter((id) => id in MIN);
  const cur = raw.cur ?? START.cur;
  const saved = { ...START, ...raw, answers, history };
  if (cur in MIN) return { ...saved, cur };
  const r = route(answers, null);
  // once a room is built there's no going back before it
  const from = raw.roomId ? r.indexOf("build") : 0;
  const open = r.slice(from).find((id) => !history.includes(id)) ?? r[from];
  return { ...saved, cur: open };
}

interface RoomData {
  status: RoomStatus;
  spec: RoomSpec | null;
  build: BuildInfo | null;
}

export default function CaptureFlow() {
  const [s, setS] = useState<Saved>(() => {
    try {
      return restore(JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}"));
    } catch {
      return START;
    }
  });
  const [files, setFiles] = useState<File[]>([]);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  // On the sort screen, Back undoes the last assignment instead of leaving
  const sortUndo = useRef<(() => void) | null>(null);
  const [undoSteps, setUndoSteps] = useState(0);
  // Sorting needs a choice for every piece: Continue jumps to the first one left
  const sortJump = useRef<(() => string | null) | null>(null);
  const [sortLeft, setSortLeft] = useState<number | null>(null);
  const [nudge, setNudge] = useState("");
  const onSortProgress = useCallback((sorted: number, total: number) => setSortLeft(total - sorted), []);
  // ?sample=1 builds the bundled sample room instead of reading photos: free, no API key
  const [sample] = useState(() => new URLSearchParams(window.location.search).has("sample"));
  const a = s.answers;

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch {}
  }, [s]);

  // Follow the build once photos are uploaded; stop polling when it's finished
  const finished = room?.status.stage === "done" || room?.status.stage === "error" || room?.status.stage === "needs-photos";
  useEffect(() => {
    if (!s.roomId) return;
    let alive = true;
    const tick = () =>
      fetch(`/api/rooms/${s.roomId}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && d && setRoom(d))
        .catch(() => {});
    tick();
    const t = finished ? undefined : setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [s.roomId, finished]);

  const absent = s.absent ?? [];
  const allItems = room?.spec?.items ?? [];
  // only pieces left on Keep: no need to ask about something already going or moving
  const bins = readBins(s.roomId);
  const unsure = allItems.filter((i) => i.confidence < UNSURE && (bins[i.id] ?? "keep") === "keep");
  // sorting comes before "is this here?", so it counts every item found
  const itemCount = room?.status.stage === "done" ? allItems.length : null;
  const askConfirm = s.cur === "confirm" || (room?.status.stage === "done" && !room.status.approximate && unsure.length > 0);
  const setAbsent = (ids: string[]) => {
    setS((p) => ({ ...p, absent: ids }));
    // the room page reads this too, so it shows the same items
    try {
      localStorage.setItem(`homebody-absent-${s.roomId}`, JSON.stringify(ids));
    } catch {}
  };
  const r = route(a, itemCount, askConfirm);
  const idx = r.indexOf(s.cur);

  const set = (patch: Partial<Answers>) => setS((p) => ({ ...p, answers: { ...p.answers, ...patch } }));
  const go = (next: string) => setS((p) => ({ ...p, history: [...p.history, p.cur], cur: next }));
  const next = (patch?: Partial<Answers>) => {
    const answers = { ...a, ...patch };
    const rr = route(answers, itemCount, askConfirm);
    setS((p) => ({ ...p, answers, history: [...p.history, p.cur], cur: rr[rr.indexOf(p.cur) + 1] }));
  };
  // Once photos are uploaded there's no going back past the build; on the sort
  // screen Back steps back through sorting choices instead
  // (when revising from the review, Back with nothing to undo returns to the review)
  const canBack = s.cur === "sort" ? undoSteps > 0 || !!s.revise : s.history.length > 0 && s.cur !== "build";
  const back = () => {
    if (s.cur === "sort" && undoSteps > 0) return sortUndo.current?.();
    setError("");
    setNudge("");
    setS((p) => ({ ...p, revise: false, cur: p.history[p.history.length - 1], history: p.history.slice(0, -1) }));
  };
  const doneSorting = () => {
    if (sortLeft) {
      const name = sortJump.current?.();
      setNudge(name ? `Choose for the ${inline(name)} first. ${sortLeft} left to sort.` : "");
      return;
    }
    setNudge("");
    if (s.revise) return setS((p) => ({ ...p, revise: false, history: [...p.history, p.cur], cur: "review" }));
    next();
  };
  const restart = () => {
    setS(START);
    setFiles([]);
    setRoom(null);
  };

  // Called from the last measurement screen with its answer, so it builds from the latest sizes
  async function upload(patch: Partial<Answers>) {
    const answers = { ...a, ...patch };
    const measurement = measurementText(answers);
    set({ ...patch, measurement });
    setSending(true);
    setError("");
    const form = new FormData();
    // Measurements only builds a box room from the typed size; photos go to Claude.
    // The sample is only for ?sample=1 with nothing uploaded: real photos always build the real room.
    if (measurementsOnly(answers)) form.set("mode", "measurements");
    else if (sample && !files.length) form.set("sample", "1");
    files.forEach((f) => form.append("photos", f));
    form.set("measurement", measurement);
    // the build is fitted to these exactly
    if (answers.length) form.set("length", String(answers.length));
    if (answers.width) form.set("width", String(answers.width));
    form.set("quality", "quick");
    form.set("intake", JSON.stringify({ scope: answers.scope, room: named(answers) || undefined, access: answers.access, have: answers.have }));
    const res = await fetch("/api/rooms", { method: "POST", body: form }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setSending(false);
    if (!res?.ok) return setError(body?.error ?? "Upload failed. Try again.");
    setS((p) => ({ ...p, roomId: body.id, history: [...p.history, p.cur], cur: "build" }));
  }

  // After a failed build: rebuild from what Claude already read if we have it,
  // otherwise read the photos again (they're kept on the server either way)
  async function retryBuild() {
    if (!s.roomId) return;
    const action = room?.spec ? { action: "rebuild", quality: "quick" } : { action: "retry" };
    const res = await fetch(`/api/rooms/${s.roomId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
    if (res.ok) setRoom((d) => d && { ...d, status: { ...d.status, stage: "reading", message: "Trying again" } });
  }

  // Time left counts every step that might still come, so it only ever goes down as answers rule steps out
  const maybe = route({ ...a, bringing: a.bringing ?? "yes" }, itemCount, askConfirm || (room?.status.stage !== "done" && !measurementsOnly(a)));
  // once the room is built, its minutes are spent
  const built = room?.status.stage === "done";
  const left = maybe.slice(Math.max(maybe.indexOf(s.cur), 0)).reduce((t, id) => t + (id === "build" && built ? 0 : MIN[id] ?? 0), 0);
  const curSec = SEC[s.cur];
  const glbUrl = s.roomId && room?.build ? `/api/rooms/${s.roomId}/files/build/room.glb?v=${room.build.seconds}` : null;

  return (
    <div className="max-w-xl mx-auto px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] min-h-[100svh] sm:min-h-[70vh] sm:pb-16 flex flex-col">
      {s.cur !== "welcome" && (
        <div className="flex flex-col gap-2 mb-10">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <button onClick={back} disabled={!canBack} className="-ml-3 h-11 w-11 grid place-items-center rounded-full text-ink transition-colors hover:bg-surface-2 active:bg-line disabled:text-line-strong disabled:bg-transparent disabled:cursor-default" aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className="num">{s.cur === "handoff" ? "Space captured" : left < 1 ? "Less than a minute left" : `About ${Math.round(left)} min left`}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {SECTIONS.map((name, i) => {
              const steps = r.filter((id) => SEC[id] === i);
              const done = s.cur === "handoff" ? steps.length : steps.filter((id) => r.indexOf(id) < idx).length;
              return (
                <div key={name}>
                  <div className="h-[3px] rounded-full bg-line overflow-hidden">
                    <div className="h-full rounded-full bg-ink transition-[width] duration-500 ease-[var(--ease-settle)]" style={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%` }} />
                  </div>
                  <p className={`mt-2 text-2xs transition-colors ${i === curSec ? "text-ink font-medium" : "text-ink-faint"}`}>{name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div key={s.cur} className="flex-1 flex flex-col gap-5 animate-rise">
        {s.cur === "welcome" && (
          <>
            <p className="wordmark text-[1.75rem] mt-1">homebody</p>
            <h1 className="text-display mt-6 sm:mt-10">Your home, <em>designed.</em></h1>
            <PathStage />
            <div className="flex-1" />
            <p className="text-sm text-ink-soft">We&apos;ll start with step 1. About 10 minutes.</p>
            <button className="btn btn-primary w-full -mt-2" onClick={() => next()}>Get started</button>
            <Link href="/rooms" className="link link-quiet -mt-2 text-center text-sm min-h-11 grid place-items-center">Already scanned a room? See your rooms</Link>
          </>
        )}

        {s.cur === "scope" && (
          <Question title="What are we designing?">
            <Choice onClick={() => next({ scope: "room" })}>One room</Choice>
            <Choice onClick={() => next({ scope: "apartment" })} sub="We'll go room by room">An apartment</Choice>
            <Choice onClick={() => next({ scope: "house" })} sub="We'll go room by room">A house</Choice>
          </Question>
        )}

        {s.cur === "whichroom" && (
          <Question title="Which room should we start with?" sub="You can add the others after this one.">
            {["living room", "bedroom", "kitchen & dining", "home office"].map((rm) => (
              <Choice key={rm} onClick={() => next({ room: rm })}>{rm[0].toUpperCase() + rm.slice(1)}</Choice>
            ))}
          </Question>
        )}

        {s.cur === "access" && (
          <Question title={`Can you be in ${named(a) ? `the ${named(a)}` : "the room"} right now?`}>
            <Choice onClick={() => next({ access: "yes" })} sub="You'll take a few photos">Yes, I&apos;m here</Choice>
            <Choice onClick={() => next({ access: "no" })} sub="Moving, or it's somewhere else">Not yet</Choice>
          </Question>
        )}

        {s.cur === "have" && (
          <Question title="What do you have for the space?" sub="Pick everything that applies. More gives a more accurate room.">
            {[["floorplan", "A floor plan", "From a listing, lease or builder"], ["photos", "Photos", "Listing photos or your own"], ["dims", "Just the measurements", "Length and width"]].map(([k, l, d]) => {
              const on = a.have.includes(k);
              return (
                <button key={k} onClick={() => set({ have: on ? a.have.filter((x) => x !== k) : [...a.have, k] })} aria-pressed={on} className="choice">
                  <span className={`h-5 w-5 shrink-0 rounded-md border grid place-items-center transition-colors ${on ? "bg-clay border-clay text-on-clay" : "border-line-strong bg-surface"}`}>{on && <Check />}</span>
                  <span><span className="block font-medium">{l}</span><span className="block text-sm text-ink-soft">{d}</span></span>
                </button>
              );
            })}
            <div className="flex-1" />
            <button className="btn btn-primary w-full" disabled={!a.have.length} onClick={() => next()}>Continue</button>
          </Question>
        )}

        {s.cur === "tips" && (
          <Question title={`Let's photograph your ${named(a) || "room"}`}>
            <ol className="flex flex-col gap-3 text-sm">
              {["Turn the lights on and open the curtains.", "Take a photo from each corner, facing into the room.", "Get each wall, the windows and doors, and some open floor.", "Or take a short video walking slowly around the room. It helps most."].map((t, i) => (
                <li key={t} className="grid grid-cols-[1.75rem_1fr] gap-3 items-baseline border-t pt-3 first:border-t-0 first:pt-0">
                  <span className="text-xs num font-semibold text-clay">0{i + 1}</span>
                  <span className="text-base">{t}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm text-ink-soft">About 3 minutes.</p>
            <div className="flex-1" />
            <button className="btn btn-primary w-full" onClick={() => next()}>I have my photos</button>
          </Question>
        )}

        {s.cur === "upload" && (
          <Question title={a.access === "no" && a.have.includes("floorplan") ? "Add your floor plan and photos" : "Add your photos"} sub="Phone photos are fine, HEIC included, or a short walkthrough video. Up to 24 photos.">
            <label className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center cursor-pointer transition-colors hover:bg-surface-2 hover:border-ink-faint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-clay has-[:focus-visible]:outline-offset-2">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden className="text-clay mb-1"><rect x="3.5" y="7" width="21" height="15" rx="3" stroke="currentColor" strokeWidth="1.4" /><circle cx="14" cy="14.5" r="4" stroke="currentColor" strokeWidth="1.4" /><path d="M10 7l1.6-2.5h4.8L18 7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
              <span className="font-medium">{files.length ? `${files.length} added` : "Choose photos or a video"}</span>
              <span className="text-xs text-ink-soft">Tap to add more</span>
              <input type="file" accept="image/*,video/*,.heic,.heif,.mov,.mp4" multiple className="sr-only" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 26))} />
            </label>
            {files.length > 0 && (
              <ul className="grid grid-cols-2 gap-2 text-xs">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border bg-surface pl-3 pr-1">
                    <span className="truncate">{f.name}</span>
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="h-11 w-11 grid place-items-center rounded-full text-ink-soft transition-colors hover:text-rust" aria-label={`Remove ${f.name}`}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M3.5 3.5l7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>
                  </li>
                ))}
              </ul>
            )}
            {sample && !files.length && <p className="text-sm text-ink-soft">Sample mode: continue without photos to build the sample living room. Photos you add build your own room instead.</p>}
            <div className="flex-1" />
            <button className="btn btn-primary w-full" disabled={!files.length && !sample} onClick={() => next()}>Continue</button>
          </Question>
        )}

        {(s.cur === "length" || s.cur === "width") && (() => {
          const needed = measurementsOnly(a);
          const last = s.cur === "width";
          const lost = !sample && r.includes("upload") && files.length === 0;
          return (
            <MeasureStep
              key={s.cur}
              title={last ? "And how wide is it?" : "How long is the room?"}
              sub={
                last
                  ? "The shorter side, wall to wall."
                  : "Wall to wall, the longer side."
              }
              value={a[s.cur]}
              unit={a.unit ?? "ft"}
              onUnit={(unit) => set({ unit })}
              skip={needed ? undefined : "I don't know, work it out from my photos"}
              busy={sending}
              action={last ? (sending ? "Building…" : "Build my room") : "Continue"}
              disabled={last && lost}
              onDone={(v) => (last ? upload({ width: v }) : next({ length: v }))}
            >
              {last && error && <p className="text-sm text-rust">{error}</p>}
              {last && lost && <p className="text-sm text-rust">Your photos were cleared when the page reloaded. Go back and add them again.</p>}
            </MeasureStep>
          );
        })()}

        {s.cur === "build" && s.roomId && room?.status.stage === "needs-photos" && (
          <Question title="A few more photos" sub="We can't see enough of the room to build it well yet. Add these and we'll read everything again.">
            <MorePhotos
              roomId={s.roomId}
              asks={room.status.asks ?? []}
              onRestart={() => setRoom((d) => d && { ...d, status: { ...d.status, stage: "reading", message: "Reading your photos", asks: undefined } })}
            />
          </Question>
        )}

        {s.cur === "build" && room?.status.stage !== "needs-photos" && (
          <Question title="Building your room">
            <FloorPlan
              points={room?.spec?.footprint ?? (a.length && a.width ? [{ x: 0, y: 0 }, { x: a.length, y: 0 }, { x: a.length, y: a.width }, { x: 0, y: a.width }] : null)}
              unit={a.unit ?? "ft"}
            />
            <ul className="flex flex-col gap-3">
              {[["reading", "Reading your photos"], ["building", "Building the room in 3D"], ["done", "Ready"]].map(([stage, label]) => {
                const order = ["uploaded", "reading", "building", "rendering", "done"];
                // "Finishing up" (rendering) is still the 3D step, so it isn't ticked yet
                const now = room?.status.stage ?? "uploaded";
                const at = order.indexOf(now === "rendering" ? "building" : now);
                const mine = order.indexOf(stage);
                const ticked = mine < at || (stage === "done" && now === "done");
                return (
                  <li key={stage} className={`flex items-center gap-3 ${mine <= at ? "text-ink" : "text-ink-soft"}`}>
                    <span className={`h-5 w-5 rounded-full grid place-items-center ${ticked ? "bg-clay text-on-clay" : mine === at ? "border-2 border-clay-soft border-t-clay animate-[spin_1.1s_linear_infinite] motion-reduce:animate-none motion-reduce:border-clay" : "border border-line-strong"}`}>{ticked && <Check />}</span>
                    {label}
                  </li>
                );
              })}
            </ul>
            {room && room.status.stage !== "done" && room.status.stage !== "error" && <p className="text-sm text-ink-soft">{waitLine(room.status.stage, room.status.message)}</p>}
            {room?.status.stage === "error" && (
              <p className="rounded-xl bg-rust-tint px-4 py-3 text-sm text-rust">We couldn&apos;t build this room. Try again; your photos are kept.</p>
            )}
            <div className="flex-1" />
            {room?.status.stage === "error" ? (
              <>
                <button className="btn btn-primary w-full" onClick={retryBuild}>Try again</button>
                <button className="btn btn-quiet w-full" onClick={restart}>Start over</button>
              </>
            ) : (
              room?.status.stage === "done" ? (
                <button className="btn btn-primary w-full" onClick={() => next()}>See your room</button>
              ) : (
                <p className="text-center text-sm text-ink-soft">This takes a few minutes.</p>
              )
            )}
          </Question>
        )}

        {s.cur === "sort" && s.roomId && glbUrl && (
          <Question title="What's staying?" sub="Choose for each piece: keep it here, move it, or remove it.">
            <RoomSort roomId={s.roomId} items={allItems} absent={absent} glbUrl={glbUrl} stacked undoRef={sortUndo} onUndoChange={setUndoSteps} requireAll jumpRef={sortJump} onProgress={onSortProgress} />
            {nudge && sortLeft ? <p className="text-sm text-ink" role="status">{nudge}</p> : null}
            <button className="btn btn-primary w-full" onClick={doneSorting}>{s.revise ? "Back to your room" : "Done sorting"}</button>
          </Question>
        )}

        {s.cur === "confirm" && (
          <Question title="One last look" sub="We weren't sure we saw these. Are they in your room?">
            <ul className="flex flex-col gap-2">
              {unsure.map((it) => {
                const out = absent.includes(it.id);
                return (
                  <li key={it.id} className="rounded-2xl border bg-surface pl-4 pr-1.5 py-1.5 flex items-center gap-3">
                    <span className="h-3.5 w-3.5 rounded-sm shrink-0" style={{ background: it.primary_color }} />
                    <span className={`flex-1 min-w-0 truncate ${out ? "text-ink-faint line-through" : ""}`}>{it.name}</span>
                    <div className="seg seg-sm shrink-0" role="group" aria-label={`Is the ${it.name} here?`}>
                      <button onClick={() => setAbsent(absent.filter((x) => x !== it.id))} aria-pressed={!out} className="min-h-10">Yes</button>
                      <button onClick={() => setAbsent([...absent.filter((x) => x !== it.id), it.id])} aria-pressed={out} className="min-h-10 whitespace-nowrap">Not here</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex-1" />
            <button className="btn btn-primary w-full" onClick={() => next()}>Continue</button>
          </Question>
        )}

        {s.cur === "bringing" && (
          <Question title="Bringing any furniture from somewhere else?">
            <Choice onClick={() => next({ bringing: "yes" })} sub="Tell us what it is">Yes</Choice>
            <Choice onClick={() => next({ bringing: "no" })}>No</Choice>
          </Question>
        )}

        {s.cur === "brought" && <BroughtStep answers={a} set={set} onDone={() => next()} />}

        {s.cur === "review" && s.roomId && (
          <ReviewStep
            roomId={s.roomId} room={room} glbUrl={glbUrl} answers={a} absent={absent}
            onDone={() => go("handoff")}
            onChange={() => setS((p) => ({ ...p, revise: true, history: [...p.history, p.cur], cur: "sort" }))}
          />
        )}

        {s.cur === "handoff" && (
          <Question title="Now let's get to know you" sub="Next is a short conversation about how you live and what you love.">
            {room?.status.approximate && <Approximate />}
            <div className="flex-1" />
            <Link href="/taste" className="btn btn-primary w-full">Let&apos;s start</Link>
            <div className="flex justify-center gap-6 text-sm text-ink-soft">
              {s.roomId && <Link href={`/rooms/${s.roomId}`} className="link link-quiet min-h-11 grid place-items-center">Open your room</Link>}
              <button className="link link-quiet min-h-11" onClick={restart}>Capture another room</button>
            </div>
          </Question>
        )}
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

function Question({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col gap-5">
      <div>
        <h1 className="text-title">{title}</h1>
        {sub && <p className="mt-3 text-[1.0625rem] leading-relaxed text-ink-soft">{sub}</p>}
      </div>
      <div className="flex-1 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Choice({ onClick, sub, children }: { onClick: () => void; sub?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="choice">
      <span>
        <span className="block font-medium">{children}</span>
        {sub && <span className="block text-sm text-ink-soft">{sub}</span>}
      </span>
      <svg className="choice-mark" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

// One room side per screen, in feet and inches or meters, with "I don't know" unless the build needs it
function MeasureStep({ title, sub, value, unit, onUnit, skip, busy, action, disabled, onDone, children }: {
  title: string;
  sub: string;
  value?: number | null;
  unit: "ft" | "m";
  onUnit: (u: "ft" | "m") => void;
  skip?: string;
  busy: boolean;
  action: string;
  disabled: boolean;
  onDone: (meters: number | null) => void;
  children?: React.ReactNode;
}) {
  const inches = value ? Math.round(value / IN) : 0;
  const [feet, setFeet] = useState(value ? String(Math.floor(inches / 12)) : "");
  const [inch, setInch] = useState(value && inches % 12 ? String(inches % 12) : "");
  const [meters, setMeters] = useState(value ? String(Number(value.toFixed(2))) : "");
  const num = (t: string) => (t.trim() === "" ? 0 : Number(t.replace(",", ".")));
  const typed = unit === "m" ? meters.trim() !== "" : feet.trim() !== "" || inch.trim() !== "";
  const m = unit === "m" ? num(meters) : num(feet) * FT + num(inch) * IN;
  const readable = typed && Number.isFinite(m);
  const plausible = readable && m >= MIN_SIDE && m <= MAX_SIDE;
  const ok = plausible && !busy && !disabled;
  const submit = () => ok && onDone(Math.round(m * 1000) / 1000);
  const field = "field num pl-4 pr-10 text-lg";
  const switchUnit = (u: "ft" | "m") => {
    if (u === unit) return;
    // carry what they typed across, so switching never loses it
    if (readable && m > 0) {
      const total = Math.round(m / IN);
      setFeet(String(Math.floor(total / 12)));
      setInch(total % 12 ? String(total % 12) : "");
      setMeters(String(Number(m.toFixed(2))));
    }
    onUnit(u);
  };
  const suffix = "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-soft";
  return (
    <Question title={title} sub={sub}>
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {unit === "ft" ? (
          <>
            <label className="relative flex-1 min-w-0">
              <span className="sr-only">Feet</span>
              <input autoFocus inputMode="decimal" value={feet} onChange={(e) => setFeet(e.target.value)} className={field} />
              <span className={suffix} aria-hidden>ft</span>
            </label>
            <label className="relative flex-1 min-w-0">
              <span className="sr-only">Inches</span>
              <input inputMode="decimal" value={inch} onChange={(e) => setInch(e.target.value)} className={field} />
              <span className={suffix} aria-hidden>in</span>
            </label>
          </>
        ) : (
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">Meters</span>
            <input autoFocus inputMode="decimal" value={meters} onChange={(e) => setMeters(e.target.value)} className={field} />
            <span className={suffix} aria-hidden>m</span>
          </label>
        )}
        {/* lets Enter submit with two fields; the visible button below is the real one */}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>{action}</button>
        <div className="seg shrink-0" role="group" aria-label="Units">
          {(["ft", "m"] as const).map((k) => (
            <button key={k} type="button" onClick={() => switchUnit(k)} aria-pressed={unit === k} aria-label={k === "ft" ? "Feet and inches" : "Meters"} className="!px-3">{k}</button>
          ))}
        </div>
      </form>
      {typed && !plausible && (
        <p className="text-sm text-ink-soft">{!readable ? "Just the number is fine." : m < MIN_SIDE ? "That seems small for a room. Check the number?" : "That seems large for one room. Check the number?"}</p>
      )}
      {children}
      <div className="flex-1" />
      <button className="btn btn-primary w-full" disabled={!ok} onClick={submit}>{action}</button>
      {skip && (
        <button className="link link-quiet self-center min-h-11 text-sm" disabled={busy || disabled} onClick={() => onDone(null)}>{skip}</button>
      )}
    </Question>
  );
}

// The room taking shape while it builds: its floor outline drawn from the typed sides (or the read, once there is one)
function FloorPlan({ points, unit }: { points: { x: number; y: number }[] | null; unit: "ft" | "m" }) {
  if (!points || points.length < 3) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const [w, h] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
  if (!(w > 0 && h > 0)) return null;
  // fit the longer side across, with room for the labels
  const W = 300;
  const k = Math.min(W / w, 190 / h);
  const pad = 28;
  const path = points.map((p, i) => `${i ? "L" : "M"}${(pad + (p.x - x0) * k).toFixed(1)} ${(pad + (p.y - y0) * k).toFixed(1)}`).join(" ") + " Z";
  const right = pad + w * k;
  const bottom = pad + h * k;
  return (
    <figure className="flex flex-col items-center gap-2 py-2" aria-label={`Floor outline, ${side(Math.max(w, h), unit)} by ${side(Math.min(w, h), unit)}`}>
      <svg viewBox={`0 0 ${right + pad + 36} ${bottom + pad + 8}`} className="w-full max-w-sm" aria-hidden>
        <path d={path} fill="var(--clay-tint)" opacity="0">
          <animate attributeName="opacity" from="0" to="1" begin="1.2s" dur="0.8s" fill="freeze" />
        </path>
        <path d={path} fill="none" stroke="var(--clay)" strokeWidth="2.5" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1">
          <animate attributeName="stroke-dashoffset" from="1" to="0" dur="1.6s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1" />
        </path>
        <text x={pad + (w * k) / 2} y={bottom + 22} textAnchor="middle" fontSize="13" fill="var(--ink-soft)">{side(w, unit)}</text>
        <text x={right + 10} y={pad + (h * k) / 2} dominantBaseline="middle" fontSize="13" fill="var(--ink-soft)">{side(h, unit)}</text>
      </svg>
    </figure>
  );
}

function Approximate() {
  return (
    <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
      <span className="eyebrow text-ink">Approximate</span> · Built from measurements only. Add photos or a floor plan later to fill in the details.
    </p>
  );
}

function BroughtStep({ answers, set, onDone }: { answers: Answers; set: (p: Partial<Answers>) => void; onDone: () => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    set({ brought: [...answers.brought, draft.trim()] });
    setDraft("");
  };
  return (
    <Question title="What are you bringing?" sub="List each piece.">
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. Cedar chest, about 40 × 20 in" className="field flex-1 min-w-0" />
        <button className="btn btn-quiet" onClick={add}>Add</button>
      </div>
      <ul className="flex flex-col gap-2">
        {answers.brought.map((b, i) => (
          <li key={`${b}-${i}`} className="flex items-center justify-between rounded-xl border bg-surface pl-4 pr-1 text-sm">
            {b}
            <button onClick={() => set({ brought: answers.brought.filter((_, j) => j !== i) })} className="h-11 w-11 grid place-items-center rounded-full text-ink-soft transition-colors hover:text-rust" aria-label={`Remove ${b}`}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M3.5 3.5l7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>
          </li>
        ))}
      </ul>
      <div className="flex-1" />
      <button className="btn btn-primary w-full" disabled={!answers.brought.length} onClick={onDone}>Continue</button>
    </Question>
  );
}

// Lowercase a piece's name inside a sentence, unless it starts with an acronym like "TV"
const inline = (name: string) => (/^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

function ReviewStep({ roomId, room, glbUrl, answers, absent, onDone, onChange }: { roomId: string; room: RoomData | null; glbUrl: string | null; answers: Answers; absent: string[]; onDone: () => void; onChange: () => void }) {
  const [bins] = useBins(roomId);
  const [mode, setMode] = useState<"kept" | "empty">("kept");
  const spec = room?.spec;
  const items = (spec?.items ?? []).filter((i) => !absent.includes(i.id));
  const inBin = (b: string) => items.filter((i) => bins[i.id] === b).map((i) => inline(i.name));
  const moving = inBin("move");
  const going = inBin("remove");
  const staying = items.length - moving.length - going.length;
  const unit = answers.unit ?? "ft";
  const xs = spec?.footprint.map((p) => p.x) ?? [0];
  const ys = spec?.footprint.map((p) => p.y) ?? [0];
  const sx = Math.max(...xs) - Math.min(...xs);
  const sy = Math.max(...ys) - Math.min(...ys);
  // What they told us, read back the way a designer would
  const facts = spec && `${side(Math.max(sx, sy), unit)} × ${side(Math.min(sx, sy), unit)} · ${side(spec.ceiling_height, unit)} ceiling`;
  const pieces = [
    items.length > 0 && `${staying} ${staying === 1 ? "piece" : "pieces"} staying`,
    moving.length > 0 && `Moving: ${moving.join(", ")}`,
    going.length > 0 && `Going: ${going.join(", ")}`,
    answers.brought.length > 0 && `Coming in: ${answers.brought.map(inline).join(", ")}`,
  ].filter(Boolean);
  return (
    <Question title="Here's your room">
      {room?.status.approximate && <Approximate />}
      <div className="seg" role="group" aria-label="Show">
        {([["empty", "Empty room"], ["kept", "What stays"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k}>{l}</button>
        ))}
      </div>
      {glbUrl && (
        <div className="h-[38vh] min-h-[280px] bg-surface-2 rounded-2xl overflow-hidden">
          <GlbViewer url={glbUrl} bins={bins} selected={new Set()} mode={mode} onPick={() => {}} hidden={new Set(absent)} tint={false} />
        </div>
      )}
      {facts && <p className="font-display text-[1.5rem] leading-tight num">{facts}</p>}
      {pieces.length > 0 && (
        <p className="text-ink-soft leading-relaxed">
          {/* a no-break space ties each dot to the part before it; lines can still break after the dot */}
          {pieces.join("\u00a0· ")}
        </p>
      )}
      <div className="flex-1" />
      {/* a way back to sorting, choices kept, beside the way on */}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button className="btn btn-quiet" onClick={onChange}>Change something</button>
        <button className="btn btn-primary" onClick={onDone}>Looks right</button>
      </div>
    </Question>
  );
}
