"use client";

import { useState } from "react";
import { LIVE, PAIRINGS, pairingClass, type PairingId } from "@/app/fonts";

// The type specimen: each candidate pairing set in real Homebody moments.
// The live pairing is chosen in app/fonts (LIVE); this page only previews.

const IDS = Object.keys(PAIRINGS) as PairingId[];

export default function TypePage() {
  const [id, setId] = useState<PairingId>(LIVE);
  const p = PAIRINGS[id];
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-10">
      <header className="flex flex-col gap-5 max-w-2xl">
        <p className="eyebrow text-ink-soft">Homebody · type specimen</p>
        <h1 className="text-display">Typefaces</h1>
        <p className="text-ink-soft">
          An elegant serif over a quiet sans, on white and black. Three pairings, each set in the screens people actually
          see. The live one is marked; switching it for the whole site is one line, <code className="mono text-[0.85em] text-ink">LIVE</code> in <code className="mono text-[0.85em] text-ink">app/fonts/index.ts</code>.
        </p>
        <div className="seg" role="group" aria-label="Pairing">
          {IDS.map((k) => (
            <button key={k} onClick={() => setId(k)} aria-pressed={id === k} className="!px-2 whitespace-nowrap">
              {PAIRINGS[k].display.label} + {PAIRINGS[k].sans.label}
              {k === LIVE && <span className="ml-1.5 text-2xs text-ink-soft">· Live</span>}
            </button>
          ))}
        </div>
      </header>

      {/* everything inside is set in the chosen pairing */}
      <div key={id} className={`${pairingClass(id)} type-scope flex flex-col gap-12 animate-rise`}>
        <section className="grid sm:grid-cols-3 gap-px rounded-[1.75rem] overflow-hidden bg-line shadow-[var(--shadow-1)]">
          {([
            ["Display", p.display.label, "font-display font-light", "Aa"],
            ["Display italic", p.display.label, "font-display italic font-light", "Aa"],
            ["Text", p.sans.label, "font-sans", "Aa"],
          ] as const).map(([role, name, cls, glyph]) => (
            <div key={role} className="bg-surface p-6 flex flex-col gap-3">
              <p className="eyebrow text-ink-faint">{role}</p>
              <p className={`${cls} text-[5rem] leading-none tracking-[-0.02em]`}>{glyph}</p>
              <p className="text-sm">{name}</p>
            </div>
          ))}
          <p className="sm:col-span-3 bg-surface px-6 py-5 text-sm text-ink-soft">{p.why}</p>
        </section>

        <div className="grid lg:grid-cols-[400px_1fr] gap-10 items-start">
          <Moment label="A question">
            <QuestionMock />
          </Moment>
          <div className="flex flex-col gap-10 min-w-0">
            <Moment label="The brief">
              <BriefMock />
            </Moment>
            <Moment label="A notebook note">
              <NoteMock />
            </Moment>
          </div>
        </div>

        <Moment label="The 3D toolbar">
          <ToolbarMock />
        </Moment>

        <Moment label="Scale">
          <ol className="flex flex-col divide-y border-y">
            {([
              ["display", "text-display font-display", <>Your home, <em>designed.</em></>],
              ["title", "text-title font-display", "How long is the room?"],
              ["lg", "text-lg", "14′ 2″ × 11′ 6″ · 8′ 4″ ceiling"],
              ["base", "text-base", "Wall to wall, the longer side."],
              ["sm", "text-sm text-ink-soft", "Phone photos are fine, HEIC included. Up to 24."],
              ["eyebrow", "eyebrow text-ink-soft", "Key decisions"],
            ] as const).map(([k, cls, t]) => (
              <li key={k} className="grid grid-cols-[4.5rem_1fr] items-baseline gap-4 py-4">
                <span className="mono text-2xs text-ink-faint">{k}</span>
                <span className={`${cls} min-w-0`}>{t}</span>
              </li>
            ))}
          </ol>
        </Moment>
      </div>
    </div>
  );
}

function Moment({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 min-w-0">
      <p className="eyebrow text-ink-faint">{label}</p>
      {children}
    </section>
  );
}

function QuestionMock() {
  return (
    <div className="rounded-[2.25rem] border bg-bg p-6 pt-5 shadow-[var(--shadow-2)] flex flex-col gap-5 min-h-[560px]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-ink-soft">
          <span className="text-lg leading-none">‹</span>
          <span className="num">About 6 min left</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {["Space", "Capture", "Inventory", "Review"].map((n, i) => (
            <div key={n}>
              <div className="h-[3px] rounded-full bg-line overflow-hidden">
                <div className="h-full bg-ink" style={{ width: i === 0 ? "100%" : i === 1 ? "40%" : "0%" }} />
              </div>
              <p className={`mt-2 text-2xs ${i === 1 ? "text-ink font-medium" : "text-ink-faint"}`}>{n}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <h2 className="text-title">What do you have for the space?</h2>
        <p className="mt-3 text-[1.0625rem] leading-relaxed text-ink-soft">Pick everything that applies. More gives a more accurate room.</p>
      </div>
      <div className="flex flex-col gap-3">
        {[["A floor plan", "From a listing, lease or builder", true], ["Photos", "Listing photos or your own", true], ["Just the measurements", "Length and width", false]].map(([l, d, on]) => (
          <div key={l as string} className={`choice ${on ? "!border-ink !bg-surface" : ""}`}>
            <span className={`h-5 w-5 shrink-0 rounded-md border grid place-items-center ${on ? "bg-clay border-clay text-on-clay" : "border-line-strong"}`}>
              {on && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
            <span><span className="block font-medium">{l}</span><span className="block text-sm text-ink-soft">{d}</span></span>
          </div>
        ))}
      </div>
      <div className="flex-1" />
      <span className="btn btn-primary w-full">Continue</span>
    </div>
  );
}

function BriefMock() {
  const rows: [string, string[]][] = [
    ["Program", ["Seat six for weekend dinners; reading for two most nights", "Work from the sofa twice a week: needs a side surface at 24–26 in"]],
    ["Constraints", ["Keeping: the oak dining table (anchor), the wool rug", "North light only; 8′ 4″ ceiling; radiator under the window"]],
    ["Key decisions", ["Lamps at three heights, 2700K — because the room has no overhead fixture", "Performance bouclé on the sofa — because it will meet red wine"]],
    ["Nevers", ["No glass coffee table", "No cool-white bulbs"]],
  ];
  return (
    <div className="rounded-[1.75rem] bg-[var(--paper)] shadow-[var(--shadow-2)] p-6 sm:p-8 flex flex-col gap-6">
      <div>
        <p className="eyebrow text-ink-faint">Your brief</p>
        <h2 className="mt-2 text-[2rem] leading-tight tracking-[-0.015em]">Living room, <em>a room for six</em> that reads well at night</h2>
      </div>
      <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
        {rows.map(([k, v]) => (
          <div key={k} className={`flex flex-col gap-1.5 ${k === "Key decisions" ? "sm:col-span-2" : ""}`}>
            <dt className="eyebrow text-ink-faint">{k}</dt>
            {v.map((line) => (
              <dd key={line} className="text-[0.9375rem] leading-snug">{line}</dd>
            ))}
          </div>
        ))}
      </dl>
    </div>
  );
}

function NoteMock() {
  const rows: [string, string, boolean, string?][] = [
    ["Who's here", "Four of you; kids 4 and 7", true, "Wipeable, low-sheen finishes"],
    ["A day in the room", "Films most evenings", false],
    ["The look", "Oiled oak, olive, aged brass", true],
    ["Practical", "Rug 8 × 10 at least, front legs on", true],
  ];
  return (
    <div className="rounded-[1.75rem] bg-[var(--paper)] shadow-[var(--shadow-2)] overflow-hidden">
      <div className="border-b px-6 py-5">
        <p className="eyebrow text-ink-faint">Design notes · living room</p>
        <p className="mt-2 font-display text-[2rem] leading-tight tracking-[-0.015em]">Living room</p>
        <p className="mt-1 italic text-[0.9375rem] text-ink-soft">calm · lived-in · <span className="not-italic">north light</span></p>
      </div>
      <ol className="divide-y">
        {rows.map(([k, v, sure, why], i) => (
          <li key={k} className="grid grid-cols-[7.5rem_1fr_1.25rem] gap-3 px-6 py-4">
            <span className="flex flex-col gap-1">
              <span className="text-2xs num text-ink-faint">0{i + 1}</span>
              <span className="eyebrow text-ink-soft">{k}</span>
            </span>
            <span className="min-w-0">
              <span className={`block text-[0.9375rem] ${sure ? "text-ink" : "italic text-ink-soft"}`}>{v}</span>
              {why && <span className="mt-0.5 block text-[0.8125rem] text-ink-faint">↳ {why}</span>}
            </span>
            {!sure ? <span className="query justify-self-end">?</span> : <span />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ToolbarMock() {
  const tools = ["Move", "Turn", "Swap", "Remove"];
  return (
    <div className="rounded-[1.75rem] bg-surface-2 overflow-hidden">
      <div className="glass flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg text-ink-soft">‹</span>
          <h2 className="text-lg font-display truncate">Living room</h2>
        </div>
        <div className="seg seg-sm w-[260px] whitespace-nowrap">
          <button aria-pressed="false">Plan</button>
          <button aria-pressed="true">3D</button>
          <button aria-pressed="false">Eye level</button>
        </div>
        <span className="rounded-full bg-surface-2 px-3 py-1.5 text-sm text-ink-soft">
          New pieces <b className="ml-1 font-semibold text-ink num">$2,145</b>
        </span>
      </div>
      <div className="h-40 grid place-items-center text-sm text-ink-faint">the room in 3D</div>
      <div className="glass flex justify-center gap-1 px-4 py-3 border-t">
        {tools.map((t, i) => (
          <span key={t} className={`min-w-[64px] h-14 px-2 rounded-xl flex flex-col items-center justify-center gap-1 text-2xs font-medium ${i === 2 ? "bg-clay text-on-clay" : "text-ink"}`}>
            <span className="h-4 w-4 rounded-full border-[1.5px] border-current" aria-hidden />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
