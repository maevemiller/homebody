"use client";

import { useState } from "react";
import { buildProfile, GROUPS, NOT_YET_KNOWN } from "@/lib/taste/profile";
import type { Answer, Known } from "@/lib/taste/questions";

// Dev-only "What Homebody assumes about me": the AI profile with the reason and
// source behind each assumption. Taste Builder renders it only with ?dev=1 outside
// production; the profile is never shown to users.
// extra: rows from the live designer conversation (persona read, style blend, words), shown as their own groups
export interface ExtraRow {
  group: string;
  label: string;
  value: string;
  because: string;
}

export default function AssumptionsPanel({ known, answers, notes, extra = [] }: { known: Omit<Known, "answers">; answers: Record<string, Answer>; notes?: string[]; extra?: ExtraRow[] }) {
  const [open, setOpen] = useState(false);
  const list = buildProfile(known, answers, notes);
  const extraGroups = [...new Set(extra.map((r) => r.group))];
  const hasAny = (g: string) => list.some((a) => a.group === g && a.value !== NOT_YET_KNOWN);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-amber-soft bg-amber-tint px-4 min-h-11 text-sm font-medium text-amber shadow-sm"
      >
        {open ? "Close" : "What Homebody assumes"}
      </button>

      {open && (
        <div role="dialog" aria-label="What Homebody assumes about me" className="fixed inset-x-0 bottom-0 z-30 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t bg-surface shadow-[0_-8px_24px_rgba(0,0,0,0.08)] animate-[rise_.2s_ease]">
          <div className="max-w-xl mx-auto px-4 pt-5 pb-24">
            <p className="eyebrow text-amber">Dev only</p>
            <h2 className="mt-1 text-2xl">What Homebody assumes about me</h2>
            {extraGroups.map((g) => (
              <section key={g} className="mt-5">
                <h3 className="eyebrow text-ink-soft">{g}</h3>
                <ul className="mt-2 flex flex-col divide-y divide-line border-y">
                  {extra.filter((r) => r.group === g).map((r, i) => (
                    <li key={`${r.label}-${i}`} className="py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-ink-soft">{r.label}</span>
                        <span className="text-sm text-right font-medium text-ink">{r.value}</span>
                      </div>
                      {r.because && <p className="mt-1 text-sm text-ink-soft">Why: {r.because}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {/* groups with real assumptions first; what isn't known yet folds into one quiet line each */}
            {[...GROUPS].sort((x, y) => Number(!hasAny(x)) - Number(!hasAny(y))).map((g) => {
              const rows = list.filter((a) => a.group === g && a.value !== NOT_YET_KNOWN);
              const blanks = list.filter((a) => a.group === g && a.value === NOT_YET_KNOWN);
              if (!rows.length && !blanks.length) return null;
              return (
                <section key={g} className="mt-5">
                  <h3 className="eyebrow text-ink-soft">{g}</h3>
                  {rows.length > 0 && (
                    <ul className="mt-2 flex flex-col divide-y divide-line border-y">
                      {rows.map((a) => (
                        <li key={`${a.field}-${a.label}`} data-field={a.field} data-status={a.status} className="py-2.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm text-ink-soft">{a.label}</span>
                            <span className={`text-sm text-right font-medium ${a.status === "guess" || a.status === "reading" ? "text-amber" : "text-ink"}`}>{a.value}</span>
                          </div>
                          <p className="mt-1 text-sm text-ink-soft">Why: {a.because}</p>
                          <p className="text-sm text-ink-soft">From: {a.from}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {blanks.length > 0 && (
                    <p data-unknown className="mt-2 text-sm text-ink-faint">Not yet known: {blanks.map((a) => a.label).join(", ")}</p>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
