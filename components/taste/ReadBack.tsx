"use client";

import Image from "next/image";
import { useState } from "react";
import type { Entry } from "./Dossier";
import { MaterialFace, PaletteStrip } from "./Swatches";
import { deFluff, moodsOK, pickedDirection } from "@/lib/taste/craft";
import { related, similar, type Concept } from "@/lib/taste/session";
import { seenBlend, blendName, heroFor, MATERIAL, PALETTE, paletteFor, ROOM, roomSrc, type TasteState } from "@/lib/taste/visual";

// "Here's what I heard" (dossier.md §2, §3.3): the sketch tidies into a designer's brief (Maeve,
// 2026-10-29): one plain sentence, then program, constraints, direction (with the palette as 60-30-10
// and the picked materials with their finishes), key decisions with the fact behind each, nevers and
// open questions. Every part is correctable. Briefs saved before then keep their older rows.
// Corrections go back to the designer through the composer; the statement and mood words can
// also be edited in place.

export default function ReadBack({ concept, taste, entries, confirmed, room, offline, onEdit, onConfirm }: {
  concept: Concept;
  taste: TasteState;
  entries: Entry[];
  confirmed: boolean;
  // the room's name ("living room"), so the page and the voice say the same thing
  room: string;
  // the free interpreter was running: its plain facts stand in for the designer's lines
  offline: boolean;
  onEdit: (c: Concept) => void;
  onConfirm: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(concept.statement);
  const b = seenBlend(taste);
  const pal = paletteFor(taste);
  const pal2 = taste.palettes.liked[1] ? PALETTE.get(taste.palettes.liked[1]) : undefined;
  const mats = taste.materials.liked.slice(0, 4);
  // each row once: no line that repeats another in other words
  const live = (z: string) =>
    entries.filter((e) => e.zone === z && !e.crossed).filter((e, i, all) => !all.slice(0, i).some((x) => similar(x.text, e.text)));
  const hero = heroFor(taste, live("never").map((e) => e.text));
  // two or three sentences: a long statement is cut at a sentence near 60 words
  const statement = cap(deFluff(concept.statement));
  // rows are the designer's own short lines; raw answers (a whole story pasted in) never print here
  const designer = (e: Entry) => !e.id.startsWith("f-");
  const short = (e: Entry) => clean(e.text).length <= 70;
  const story = live("story").filter((e) => (designer(e) || offline) && short(e)).slice(-2);
  // spoken nevers first, then the pictures they ruled out; all of them, on one line
  const never = [...live("never").filter(designer), ...live("never").filter((e) => !designer(e))];
  const practical = live("practical");
  // what she's keeping, anchor first; a wish ("a round table") is for the statement, not this row
  const keepLines = live("keep").filter((e) => designer(e) || /anchor/.test(e.text) || offline);
  const keep = [...keepLines].sort((a, b) => Number(/anchor/.test(b.text)) - Number(/anchor/.test(a.text))).slice(0, 3);
  const moods = moodsOK(concept.moods, true);
  // the structured brief: the designer's lines plus what the page knows for certain, each line once
  const structured = concept.program !== undefined;
  const merge = (...groups: string[][]) => groups.flat().map(clean).filter(Boolean).filter((x, i, all) => !all.slice(0, i).some((y) => similar(x, y)));
  const style = b.length ? [`Style: ${blendName(b)}`] : [];
  const sections: [string, string[]][] = structured
    ? [
        ["Program", merge(concept.program ?? [])],
        // her practical lines only where the designer's constraints don't already carry them ("Mum visits at Christmas")
        ["Constraints", merge(keep.map((e) => `Keeping: ${clean(e.text).replace(/ — the anchor$/, " (anchor)")}`), concept.constraints ?? [], practical.map((e) => e.text).filter((t) => ![...(concept.constraints ?? []), ...(concept.program ?? [])].some((c) => related(t, c))))],
        // the page's style line only when the designer didn't already name the lead style
        // one palette line: the page's 60-30-10 from her pick; the designer's own palette lines step aside
        ["Direction", merge(concept.direction?.some((x) => /^style\b/i.test(x) || (b[0] && x.toLowerCase().includes(b[0].label.toLowerCase()))) ? [] : style, (concept.direction ?? []).filter((x) => !(pal && PALETTE_LINE.test(x)) && !(taste.materials.liked.length && /^materials?\b/i.test(x))), pickedDirection(taste))],
        ["Key decisions", (concept.decisions ?? []).map((d) => `${clean(d.decision)}${WHY}${clean(d.because).replace(/^because\s+/i, "")}`)],
        ["Nevers", merge(concept.nevers ?? [], never.map((e) => e.text))],
        ["Open questions", merge(concept.open_questions ?? [])],
      ]
    : [];

  // a correction's removed lines stay on the page, struck through, in their section
  const LABEL: Record<string, string> = { program: "Program", constraints: "Constraints", direction: "Direction", decisions: "Key decisions", nevers: "Nevers" };
  const struck = new Set((concept.struck ?? []).map((x) => `${LABEL[x.section]}::${clean(x.text).replace(/ — because /, WHY)}`));
  for (const x of concept.struck ?? []) {
    const row = sections.find(([label]) => label === LABEL[x.section]);
    const text = clean(x.text).replace(/ — because /, WHY);
    if (row && !row[1].includes(text)) row[1].push(text);
  }
  const rows = sections.filter(([, lines]) => lines.length);
  return (
    <article className="overflow-hidden rounded-[1.75rem] bg-[var(--paper)] shadow-[var(--shadow-2)] animate-rise">
      {/* title block */}
      <header className="border-b px-5 pt-6 pb-6 sm:px-9 sm:pt-9 sm:pb-8">
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow text-clay">Design brief · {room}</p>
          <p className={`text-2xs font-medium whitespace-nowrap ${confirmed ? "text-clay" : "text-ink-faint"}`}>{confirmed ? "Confirmed" : "Draft for your review"}</p>
        </div>
        <h2 className="mt-3 text-[2.375rem] sm:text-[3.5rem] leading-[1.02] tracking-[-0.022em]">{concept.title}</h2>
        {moods.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-x-2 text-[0.9375rem] italic text-ink-soft">
            {moods.map((m, i) => <span key={m + i}>{i ? <span className="mr-2 text-ink-faint">/</span> : null}{m}</span>)}
          </p>
        )}

        <div className="mt-7 grid gap-6 sm:grid-cols-[1.2fr_1fr] sm:gap-9">
          <div className="order-2 sm:order-1">
            <p className="eyebrow mb-2 text-ink-faint">The idea</p>
            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={7} className="field font-display text-[1.15rem] leading-relaxed" aria-label="Concept statement" />
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={() => { onEdit({ ...concept, statement: draft.trim() }); setEditing(false); }}>Save</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => { setDraft(concept.statement); setEditing(false); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <blockquote className="font-display text-[1.3125rem] sm:text-[1.5rem] leading-[1.42] text-ink">
                {statement}
                {!confirmed && <button className="link link-quiet ml-2 align-baseline font-sans text-sm" onClick={() => setEditing(true)}>Edit</button>}
              </blockquote>
            )}
            {!structured && b.length > 0 && <p className="mt-4 text-sm text-ink-soft">The look: <span className="text-ink">{blendName(b)}</span></p>}
          </div>

          <div className="order-1 flex flex-col gap-4 sm:order-2">
            {hero && ROOM.get(hero) && (
              <figure>
                <Image src={roomSrc(hero)} alt={ROOM.get(hero)!.alt} width={720} height={540} className="aspect-[4/3] w-full rounded-lg object-cover" />
              </figure>
            )}
            {pal && (
              <figure>
                <PaletteStrip p={pal} className="h-9 rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]" />
                <figcaption className="mt-1.5 text-xs text-ink-faint"><span className="font-medium text-ink">{pal.name}</span>{pal.names ? ` · ${pal.names.slice(0, 4).join(", ").toLowerCase()}` : ""}</figcaption>
              </figure>
            )}
            {/* her second palette pick, shown with the same treatment */}
            {pal && pal2 && (
              <figure>
                <PaletteStrip p={pal2} className="h-9 rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]" />
                <figcaption className="mt-1.5 text-xs text-ink-faint"><span className="font-medium text-ink">{pal2.name}</span>{pal2.names ? ` · ${pal2.names.slice(0, 4).join(", ").toLowerCase()}` : ""}</figcaption>
              </figure>
            )}
            {mats.length > 0 && (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                {mats.map((id) => {
                  const m = MATERIAL.get(id)!;
                  return (
                    <li key={id} className="flex min-w-0 items-center gap-2 text-sm">
                      <MaterialFace m={m} className="h-7 w-7 shrink-0 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]" />
                      <span className="leading-tight">{m.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </header>

      {structured ? (
        <ol className="divide-y">
          {rows.map(([label, lines], i) => (
            <li key={label} className="grid gap-2 px-5 py-5 sm:grid-cols-[10rem_1fr] sm:gap-6 sm:px-9 sm:py-6">
              <h3 className="flex items-baseline gap-2 font-sans sm:flex-col sm:gap-1">
                <span className="text-2xs num font-semibold text-clay">{String(i + 1).padStart(2, "0")}</span>
                <span className="eyebrow text-ink">{label}</span>
              </h3>
              <ul className="flex min-w-0 flex-col divide-y divide-line/70">
                {lines.map((x) => <BriefLine key={x} kind={label} text={x} struck={struck.has(`${label}::${x}`)} />)}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <dl className="grid gap-x-8 gap-y-4 px-5 py-6 text-sm sm:grid-cols-2 sm:px-9">
          {keep.length > 0 && <Row label="Starts from" value={keep.map((e) => clean(e.text)).join(", ")} />}
          {story.length > 0 && <Row label="The nod" value={story.map((e) => clean(e.text)).join("; ")} />}
          {never.length > 0 && <Row label="Never" value={never.map((e) => clean(e.text)).join(", ")} />}
          {practical.length > 0 && <Row label="Practical" value={practical.map((e) => clean(e.text)).join(" · ")} />}
        </dl>
      )}

      <footer className="border-t px-5 py-5 sm:px-9">
        {!confirmed ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className="btn btn-primary sm:px-8" onClick={onConfirm}>Yes, this is it</button>
            <p className="text-sm text-ink-soft sm:ml-2">Not quite? Say or type what I got wrong, and I&apos;ll redraw it.</p>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[0.9375rem] text-ink">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-clay text-on-clay" aria-hidden>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            Brief confirmed. Next: ideas for your {room}.
          </p>
        )}
      </footer>
    </article>
  );
}

// One line of the brief. A key decision reads as the decision, with its reason beneath; a never
// carries a cross; an open question carries the designer's pencilled query.
// The decision and its reason, joined while the lines are merged and split again to show
const WHY = " ¦ ";
const PALETTE_LINE = /\bpalette\b|60-30-10|\b60\b.*\b30\b|\b(base|secondary|accent) (color|colour|tone)/i;

function BriefLine({ kind, text, struck }: { kind: string; text: string; struck?: boolean }) {
  // a line a correction removed: still there, crossed out, so she sees what changed
  const off = struck ? " line-through decoration-[var(--pencil)] text-ink-faint" : "";
  if (kind === "Key decisions") {
    const at = text.indexOf(WHY);
    const decision = at > 0 ? text.slice(0, at) : text;
    const why = at > 0 ? `Why: ${text.slice(at + WHY.length)}` : "";
    return (
      <li className={`py-2.5 first:pt-0 last:pb-0${off}`}>
        <p className="text-[0.9375rem] font-medium leading-snug text-ink">{decision.charAt(0).toUpperCase() + decision.slice(1)}</p>
        {why && <p className="mt-0.5 text-sm leading-snug text-ink-soft">{why.charAt(0).toUpperCase() + why.slice(1)}</p>}
      </li>
    );
  }
  return (
    <li className={`grid grid-cols-[minmax(0,1fr)_1.25rem] gap-x-2 py-2 first:pt-0 last:pb-0${off}`}>
      <span className="text-[0.9375rem] leading-snug text-ink">{text.charAt(0).toUpperCase() + text.slice(1)}</span>
      {kind === "Nevers" ? (
        <svg className="mt-1 text-rust" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="Never"><path d="M2.5 2.5l7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      ) : kind === "Open questions" ? (
        <span className="query mt-0.5 justify-self-end" aria-label="Open">?</span>
      ) : <span />}
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="eyebrow text-ink-faint">{label}</dt>
      <dd className="mt-1 text-[0.9375rem] leading-snug text-ink">{value}</dd>
    </div>
  );
}

function cap(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+["”]?\s*/g) ?? [text];
  let out = "";
  for (const x of sentences) {
    if (out && (out.split(/\s+/).length + x.split(/\s+/).length > 64 || out.match(/[.!?]/g)!.length >= 3)) break;
    out += x;
  }
  return out.trim() || text;
}

// A row's words without stray quotes or a trailing separator
// (an inch mark after a number stays: 18" of floor, a 96" sofa)
const clean = (t: string) => t.replace(/(?<!\d)["“”]|[“”]/g, "").replace(/[;.,\s]+$/, "").trim();
