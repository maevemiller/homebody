"use client";

import Image from "next/image";
import type { Fact } from "@/lib/taste/dossier";
import { ORDER, SECTIONS, type DossierItem, type SectionId, type Zone } from "@/lib/taste/session";
import { seenBlend, blendName, heroFor, MATERIAL, paletteFor, PATTERN, ROOM, roomSrc, type TasteState } from "@/lib/taste/visual";
import { MaterialFace, PaletteStrip, PatternFace } from "./Swatches";

// The live dossier (docs/reference/interior-design/dossier.md §3), set as a studio's working
// sheet rather than a doodle pad (Maeve, 2026-10-29): a title block, then numbered rows on a
// ruled grid, filled section by section as they talk. What they said is set in ink; a guess is
// set lighter with a pencilled "?" in the margin; "because" sits under its line; a correction
// is struck through by hand rather than replaced. The hand face appears only for those marks.

export type Entry = (DossierItem | (Fact & { id: string; at?: number })) & { crossed?: boolean };

type Row = Exclude<Zone, "title" | "why">;
const ZONE_LABEL: Record<Row, string> = {
  day: "A day in the room",
  look: "The look",
  who: "Who's here",
  story: "The story",
  keep: "Keeping",
  never: "Never",
  practical: "The practical bits",
};
const ZONE_SECTION: Record<Row, SectionId> = { day: "you", who: "you", look: "style", never: "style", story: "extras", keep: "extras", practical: "extras" };
// the sheet's order: how they live, the look, then what's fixed
const ROWS: Row[] = ["day", "who", "look", "never", "story", "keep", "practical"];
const SECTION_LABEL = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label])) as Record<string, string>;

export default function Dossier({ room, moods, entries, taste, section }: { room: string; moods: string[]; entries: Entry[]; taste: TasteState; section: SectionId }) {
  const by = (z: Zone) => entries.filter((e) => e.zone === z);
  const title = by("title").filter((e) => !e.crossed).at(-1)?.text ?? `Your ${room}`;
  const b = seenBlend(taste);
  const pal = paletteFor(taste);
  const hero = heroFor(taste, by("never").filter((e) => !e.crossed).map((e) => e.text));
  const mats = taste.materials.liked.slice(0, 4);
  const pats = taste.patterns.liked.slice(0, 2);
  const lookHas = by("look").length > 0 || b.length > 0 || !!pal || mats.length > 0 || pats.length > 0 || !!hero;
  const sure = entries.filter((e) => e.zone !== "title" && !e.crossed && e.sure).length;
  const guesses = entries.filter((e) => e.zone !== "title" && !e.crossed && !e.sure).length;

  return (
    <article className="relative overflow-hidden rounded-[1.75rem] bg-[var(--paper)] shadow-[var(--shadow-2)]">
      {/* title block: the room, the brief's working title, and the sheet's state */}
      <header className="border-b px-5 pt-5 pb-4 sm:px-8 sm:pt-7 sm:pb-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow text-ink-faint">Design notes · {room}</p>
          <p className="text-2xs text-ink-faint num whitespace-nowrap">
            {sure} noted{guesses ? ` · ${guesses} to confirm` : ""}
          </p>
        </div>
        <h2 key={title} className="mt-2 text-[2rem] sm:text-[2.75rem] leading-[1.04] tracking-[-0.018em] animate-rise">{title}</h2>
        {moods.length > 0 && (
          // mood words: the designer's shorthand, set in italic grey
          <p className="hand mt-2 text-[0.9375rem] text-ink-soft" aria-label="Mood words">
            {moods.map((m, i) => (
              <span key={m} className="inline-block animate-rise" style={{ animationDelay: `${i * 0.12}s` }}>
                {i ? <span className="mx-1.5 not-italic text-ink-faint">·</span> : null}{m}
              </span>
            ))}
          </p>
        )}
        {by("why").length > 0 && (
          <div className="mt-4 grid gap-1 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
            <p className="eyebrow pt-0.5 text-ink-faint">Why now</p>
            <Lines items={by("why")} />
          </div>
        )}
      </header>

      <ol className="divide-y">
        {ROWS.map((z, i) => {
          const isLook = z === "look";
          const has = isLook ? lookHas : by(z).length > 0;
          return (
            <ZoneRow key={z} n={i + 1} label={ZONE_LABEL[z]} active={ZONE_SECTION[z] === section} past={ORDER.indexOf(ZONE_SECTION[z]) < ORDER.indexOf(section)} empty={!has} waitsFor={SECTION_LABEL[ZONE_SECTION[z]]}>
              {isLook ? (
                <Look blend={b.length ? blendName(b) : ""} pal={pal} mats={mats} pats={pats} hero={hero} lines={by("look")} />
              ) : (
                <Lines items={by(z)} />
              )}
            </ZoneRow>
          );
        })}
      </ol>
    </article>
  );
}

function ZoneRow({ n, label, active, past, empty, waitsFor, children }: { n: number; label: string; active: boolean; past: boolean; empty: boolean; waitsFor: string; children: React.ReactNode }) {
  return (
    <li className={`relative grid gap-2 px-5 py-4 sm:grid-cols-[8.5rem_1fr] sm:gap-4 sm:px-8 sm:py-5 transition-colors ${active ? "bg-surface-2/60" : ""}`} aria-label={label}>
      {active && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-ink" aria-hidden />}
      <h3 className="flex items-baseline gap-2 font-sans sm:flex-col sm:gap-1">
        <span className={`text-2xs num font-semibold ${active ? "text-clay" : "text-ink-faint"}`}>{String(n).padStart(2, "0")}</span>
        <span className={`eyebrow ${active ? "text-ink" : empty ? "text-ink-faint" : "text-ink-soft"}`}>{label}</span>
      </h3>
      {empty ? (
        // what's still to come, said plainly: no empty boxes waiting to be filled in
        <p className="self-center text-sm text-ink-faint">{active ? "We're on this now." : past ? "Nothing noted." : `Comes up in ${waitsFor}.`}</p>
      ) : (
        <div className="min-w-0">{children}</div>
      )}
    </li>
  );
}

function Look({ blend, pal, mats, pats, hero, lines }: { blend: string; pal: ReturnType<typeof paletteFor>; mats: string[]; pats: string[]; hero: string | null | undefined; lines: Entry[] }) {
  const ref = hero ? ROOM.get(hero) : undefined;
  return (
    <div className="flex flex-col gap-4">
      {blend && <p key={blend} className="font-display text-[1.5rem] leading-snug tracking-[-0.01em] animate-rise">{blend}</p>}
      {(ref || pal || mats.length > 0 || pats.length > 0) && (
        <div className={`grid gap-4 ${ref ? "sm:grid-cols-[minmax(0,1fr)_42%]" : ""}`}>
          <div className="flex min-w-0 flex-col gap-4">
            {pal && (
              <figure className="animate-rise" aria-label={`Palette: ${pal.name}`}>
                <PaletteStrip p={pal} className="h-8 rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]" />
                <figcaption className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-medium text-ink">{pal.name}</span>
                  {pal.names && <span className="text-ink-faint">{pal.names.slice(0, 4).join(", ").toLowerCase()}</span>}
                </figcaption>
              </figure>
            )}
            {(mats.length > 0 || pats.length > 0) && (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                {mats.map((id) => {
                  const m = MATERIAL.get(id)!;
                  return (
                    <li key={id} className="flex min-w-0 items-center gap-2 animate-rise">
                      <MaterialFace m={m} className="h-7 w-7 shrink-0 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]" />
                      <span className="text-sm leading-tight">{m.label}</span>
                    </li>
                  );
                })}
                {pats.map((id) => {
                  const p = PATTERN.get(id)!;
                  return (
                    <li key={id} className="flex min-w-0 items-center gap-2 animate-rise">
                      <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]"><PatternFace p={p} className="h-full w-full" /></span>
                      <span className="text-sm leading-tight">{p.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {ref && hero && (
            <figure className="animate-rise">
              <Image src={roomSrc(hero)} alt={ref.alt} width={360} height={270} className="aspect-[4/3] w-full rounded-lg object-cover" />
              <figcaption className="mt-1.5 text-2xs text-ink-faint">Reference, from your picks</figcaption>
            </figure>
          )}
        </div>
      )}
      <Lines items={lines} />
    </div>
  );
}

function Lines({ items }: { items: Entry[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-col">
      {items.map((e) => (
        <li key={e.id} data-at={e.at} className="grid grid-cols-[minmax(0,1fr)_1.5rem] gap-x-2 py-1.5 first:pt-0 last:pb-0 animate-rise">
          <span className="min-w-0">
            <span className="relative inline">
              <span className={`text-[0.9375rem] leading-[1.45] ${e.crossed ? "text-ink-faint" : e.sure ? "text-ink" : "italic text-ink-soft"}`}>{e.text}</span>
              {e.crossed && (
                // a correction is struck through by hand, so what changed stays readable
                <svg className="pointer-events-none absolute inset-x-0 top-1/2 h-3 w-full -translate-y-1/2 overflow-visible text-rust" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
                  <path d="M0 6 C 20 2, 40 9, 60 4 S 90 7, 100 3" pathLength={1} className="draw" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              )}
            </span>
            {e.because && !e.crossed && (
              <span className="mt-0.5 flex gap-1.5 text-[0.8125rem] leading-snug text-ink-faint">
                <span aria-hidden>↳</span>
                <span>{e.because}</span>
              </span>
            )}
          </span>
          {/* a guess carries the designer's pencilled query in the margin */}
          {!e.sure && !e.crossed ? (
            <span className="query mt-0.5 justify-self-end" title="A guess. Tell me if it's wrong." aria-label="A guess">?</span>
          ) : <span />}
        </li>
      ))}
    </ul>
  );
}
