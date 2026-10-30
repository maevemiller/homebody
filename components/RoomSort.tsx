"use client";

import dynamic from "next/dynamic";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { Bin, ViewMode } from "@/components/GlbViewer";
import type { RoomItem } from "@/lib/scan/spec";

const GlbViewer = dynamic(() => import("@/components/GlbViewer"), { ssr: false });

export const BINS: { id: Bin; label: string; hint: string; cls: string }[] = [
  { id: "keep", label: "Keep here", hint: "stays put", cls: "bg-sage-tint text-sage border-sage-soft" },
  { id: "move", label: "Move it", hint: "place later", cls: "bg-amber-tint text-amber border-amber-soft" },
  { id: "remove", label: "Remove", hint: "it's going", cls: "bg-rust-tint text-rust border-rust-soft" },
];

export type Bins = Record<string, Bin | undefined>;

// Sorting is a per-viewer convenience for now, kept in this browser
export function useBins(roomId: string) {
  const key = `homebody-bins-${roomId}`;
  const [bins, setBins] = useState<Bins>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}");
    } catch {
      return {};
    }
  });
  const save = (next: Bins) => {
    setBins(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  return [bins, save] as const;
}

const cm = (m: number) => `${Math.round(m * 100)}`;

/** The 3D room plus the list of detected items, sorted into keep / move / remove. */
interface Props {
  roomId: string;
  items: RoomItem[];
  glbUrl: string;
  stacked?: boolean;
  // Lets a parent's Back button undo the last assignment
  undoRef?: RefObject<(() => void) | null>;
  onUndoChange?: (steps: number) => void;
  // ids the owner said aren't in the room; read from this browser when not given
  absent?: string[];
  // Space Capture: every piece gets an explicit choice, with progress and a "Keep the rest" shortcut
  requireAll?: boolean;
  // Selects and scrolls to the first unsorted piece; returns its name, or null when all are sorted
  jumpRef?: RefObject<(() => string | null) | null>;
  onProgress?: (sorted: number, total: number) => void;
}

export default function RoomSort({ roomId, items: allItems, glbUrl, stacked = false, undoRef, onUndoChange, absent, requireAll = false, jumpRef, onProgress }: Props) {
  const [bins, saveBins] = useBins(roomId);
  const [storedAbsent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`homebody-absent-${roomId}`) ?? "[]");
    } catch {
      return [];
    }
  });
  const gone = absent ?? storedAbsent;
  const items = allItems.filter((i) => !gone.includes(i.id));
  const [mode, setMode] = useState<ViewMode>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Each assignment pushes the previous bins, so undo can step back one at a time
  const [past, setPast] = useState<Bins[]>([]);
  const commit = (next: Bins) => {
    setPast((p) => [...p, bins]);
    saveBins(next);
    setSelected(new Set());
  };
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    saveBins(prev);
    setPast(past.slice(0, -1));
    setSelected(new Set());
  };
  useEffect(() => {
    if (undoRef) undoRef.current = past.length ? undo : null;
  });
  useEffect(() => onUndoChange?.(past.length), [past.length, onUndoChange]);
  const toggle = useCallback((itemId: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(itemId)) n.delete(itemId);
      else n.add(itemId);
      return n;
    });
  }, [setSelected]);

  const counts = { keep: 0, move: 0, remove: 0, unsorted: 0 };
  for (const it of items) counts[bins[it.id] ?? "unsorted"]++;
  const sorted = items.length - counts.unsorted;
  useEffect(() => onProgress?.(sorted, items.length), [sorted, items.length, onProgress]);

  // Continue with pieces left: select the first one and bring its row into view, briefly marked
  const rows = useRef(new Map<string, HTMLLIElement>());
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!jumpRef) return;
    jumpRef.current = () => {
      const first = items.find((i) => !bins[i.id]);
      if (!first) return null;
      setSelected(new Set([first.id]));
      setFlash(first.id);
      setTimeout(() => setFlash((f) => (f === first.id ? null : f)), 1600);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rows.current.get(first.id)?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      return first.name;
    };
  });
  const keepRest = () => {
    const next = { ...bins };
    for (const it of items) if (!next[it.id]) next[it.id] = "keep";
    commit(next);
  };

  return (
    <div className={stacked ? "flex flex-col gap-4" : "grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6"}>
      <div className="flex flex-col gap-3 min-w-0">
        <div className="seg" role="group" aria-label="Show">
          {([["empty", "Empty room"], ["all", "Everything"], ["kept", "What stays"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className="whitespace-nowrap !px-2">{l}</button>
          ))}
        </div>
        <div className={`${stacked ? "h-[42vh]" : "h-[62vh]"} min-h-[320px] bg-surface-2 rounded-2xl overflow-hidden`}>
          <GlbViewer url={glbUrl} bins={bins} selected={selected} mode={mode} onPick={toggle} hidden={new Set(gone)} />
        </div>
        {/* on phones the hint goes away once they start tapping */}
        {!(stacked && (selected.size > 0 || past.length > 0)) && <p className="text-xs text-ink-soft">Drag to turn the room. Tap furniture to select it.</p>}
      </div>

      <div className="rounded-2xl border bg-surface flex flex-col min-w-0 overflow-hidden">
        {!stacked && (
          <div className="px-4 py-3 border-b text-xs text-ink-soft num">
            {BINS.map((b) => `${b.label} ${counts[b.id]}`).join(" · ")} · To sort {counts.unsorted}
          </div>
        )}
        {requireAll && (
          <div className="px-4 py-2.5 border-b flex items-center justify-between gap-3 text-sm">
            <span className="num" aria-live="polite">
              <span className="font-medium text-ink">{sorted} of {items.length}</span> <span className="text-ink-soft">sorted</span>
            </span>
            {counts.unsorted > 0 && sorted > 0 && (
              <button className="link link-quiet min-h-11 text-sm" onClick={keepRest}>Keep the rest</button>
            )}
          </div>
        )}
        <ul className={`flex-1 overflow-y-auto ${stacked ? "max-h-[28vh]" : "max-h-[46vh]"}`}>
          {items.map((it) => {
            const bin = BINS.find((x) => x.id === bins[it.id]);
            return (
              <li key={it.id} ref={(el) => { if (el) rows.current.set(it.id, el); else rows.current.delete(it.id); }}>
                <button onClick={() => toggle(it.id)} aria-pressed={selected.has(it.id)} className={`w-full text-left px-4 min-h-12 py-2.5 border-b flex items-center gap-3 transition-colors focus-visible:-outline-offset-2 ${selected.has(it.id) ? "bg-clay-tint" : "hover:bg-surface-2"} ${flash === it.id ? "ring-2 ring-inset ring-clay" : ""}`}>
                  <span className={`h-[18px] w-[18px] shrink-0 rounded-md border grid place-items-center transition-colors ${selected.has(it.id) ? "bg-clay border-clay text-on-clay" : "border-line-strong"}`}>{selected.has(it.id) && <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
                  <span className="h-3.5 w-3.5 rounded-full shrink-0 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" style={{ background: it.primary_color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm truncate">{it.name}</span>
                    {!stacked && <span className="block text-xs text-ink-faint mono">{cm(it.width)}×{cm(it.depth)}×{cm(it.height)} cm</span>}
                  </span>
                  {/* in capture every row shows its state, so what's left to sort is plain */}
                  {(bin || !stacked || requireAll) && <span className={`text-2xs font-medium rounded-full border px-2 py-0.5 whitespace-nowrap ${bin?.cls ?? "text-ink-faint"}`}>{bin?.label ?? "To sort"}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {/* On phones, once something is selected the buttons dock to the bottom of the screen,
            so tapping furniture in 3D never means scrolling down to sort it */}
        <div
          className={`p-4 border-t flex flex-col gap-2 bg-surface ${
            stacked && selected.size
              ? "fixed inset-x-0 bottom-0 z-20 mx-auto max-w-xl pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-10px_24px_-14px_rgba(0,0,0,0.35)]"
              : ""
          }`}
        >
          {(selected.size > 0 || !stacked) && (
            <p className="text-xs text-ink-soft">{selected.size ? `${selected.size} selected` : "Tap things, then choose where they go."}</p>
          )}
          <div className="grid grid-cols-3 gap-1.5">
            {BINS.map((b) => (
              <button
                key={b.id}
                disabled={!selected.size}
                onClick={() => {
                  const next = { ...bins };
                  selected.forEach((s) => (next[s] = b.id));
                  commit(next);
                }}
                className={`rounded-xl border px-2 min-h-11 text-sm font-medium transition-[transform,opacity] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${b.cls}`}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs">
            {!stacked && <button className="link link-quiet min-h-9" onClick={() => setSelected(new Set(items.filter((i) => !bins[i.id]).map((i) => i.id)))}>Select all to sort</button>}
            {/* on phones, Back is undo */}
            {(!stacked || !undoRef) && past.length > 0 && <button className="link link-quiet min-h-11" onClick={undo}>Undo</button>}
            {!stacked && <button className="link link-quiet min-h-9" onClick={() => commit({})}>Clear sorting</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
