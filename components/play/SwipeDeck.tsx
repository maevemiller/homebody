"use client";

import { useMemo, useRef, useState } from "react";
import { PRODUCTS, REAL_CREDIT, type Product } from "@/lib/play/catalog";
import { Icon } from "./icons";

// "Teach me your taste": real pieces one at a time, swipe right for yes and left for no (or tap). Each swipe
// updates the play profile (lib/play/prefs.ts); at the end the proposal can re-rank around it. For when taste
// is hard to put into words.

const DECK = 10;

/** A spread of pieces: different kinds, materials and styles, ones she hasn't judged yet first. */
export function deckOf(seen: Set<string>): Product[] {
  const pool = PRODUCTS.filter((p) => p.real && !seen.has(p.id) && p.sub !== "dining_chair");
  const out: Product[] = [];
  const used = new Set<string>();
  for (const p of [...pool].sort((a, b) => a.id.localeCompare(b.id))) {
    const k = `${p.category}|${p.material}`;
    if (used.has(k)) continue;
    used.add(k);
    out.push(p);
    if (out.length >= DECK) break;
  }
  return out.length >= 4 ? out : PRODUCTS.filter((p) => p.real).slice(0, DECK);
}

export default function SwipeDeck({ seen, onSwipe, onDone, onClose }: {
  seen: Set<string>;
  onSwipe: (p: Product, liked: boolean) => void;
  onDone: (count: number) => void;
  onClose: () => void;
}) {
  const deck = useMemo(() => deckOf(seen), [seen]);
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const card = deck[i];

  const decide = (liked: boolean) => {
    if (!card || leaving) return;
    setLeaving(liked ? 1 : -1);
    onSwipe(card, liked);
    window.setTimeout(() => {
      setLeaving(0);
      setDx(0);
      setI((n) => n + 1);
    }, 220);
  };

  const done = i >= deck.length;
  const x = leaving ? leaving * 480 : dx;

  return (
    <div role="dialog" aria-modal="true" aria-label="Teach me your taste" className="fixed inset-0 z-50 bg-bg/96 backdrop-blur flex flex-col">
      <header className="h-14 shrink-0 flex items-center gap-2 px-4">
        <div className="mr-auto">
          <p className="eyebrow text-ink-faint">Teach me your taste</p>
          <p className="text-sm text-ink-soft">{done ? "That's the deck" : `${i + 1} of ${deck.length} · yes or no, no need to explain`}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="h-11 w-11 grid place-items-center rounded-full text-ink-soft hover:text-ink"><Icon name="close" /></button>
      </header>
      <div className="flex-1 min-h-0 grid place-items-center px-6">
        {done ? (
          <div className="max-w-sm text-center animate-[rise_0.25s_ease-out]">
            <p className="font-display text-2xl leading-tight">Got it.</p>
            <p className="mt-2 text-ink-soft text-sm leading-relaxed">Your yeses and nos now steer what the room proposes. Re-furnish to see it, or keep what&apos;s there and they&apos;ll shape the next change.</p>
            <div className="mt-6 flex flex-col gap-2">
              <button onClick={() => onDone(deck.length)} className="btn btn-primary">Re-furnish with this</button>
              <button onClick={onClose} className="btn btn-quiet">Keep the room as it is</button>
            </div>
          </div>
        ) : card ? (
          <div
            key={card.id}
            onPointerDown={(e) => {
              drag.current = { x: e.clientX, id: e.pointerId };
              setDragging(true);
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => drag.current && setDx(e.clientX - drag.current.x)}
            onPointerUp={() => {
              drag.current = null;
              setDragging(false);
              if (Math.abs(dx) > 90) decide(dx > 0);
              else setDx(0);
            }}
            onPointerCancel={() => { drag.current = null; setDragging(false); setDx(0); }}
            style={{ transform: `translateX(${x}px) rotate(${x / 30}deg)`, transition: dragging ? "none" : "transform 0.22s ease-out" }}
            className="w-full max-w-[340px] rounded-3xl bg-surface border shadow-[var(--shadow-2)] p-4 select-none touch-none cursor-grab animate-[rise_0.2s_ease-out]"
          >
            <div className="relative h-60 rounded-2xl bg-white grid place-items-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.real?.image} alt={card.name} draggable={false} className="max-h-full max-w-full object-contain mix-blend-multiply pointer-events-none" />
              <span aria-hidden className="absolute inset-0 transition-colors" style={{ background: dx > 40 ? "rgb(62 122 74 / 0.10)" : dx < -40 ? "rgb(176 71 58 / 0.10)" : "transparent" }} />
            </div>
            <p className="mt-3 text-base leading-snug">{card.name}</p>
            <p className="text-xs text-ink-faint mt-1">{card.real?.brand} · {card.real?.colorName || card.material.replace(/_/g, " ")} · {REAL_CREDIT}</p>
          </div>
        ) : null}
      </div>
      {!done && (
        <div className="shrink-0 flex justify-center gap-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button onClick={() => decide(false)} aria-label="Not for me" className="h-16 w-16 rounded-full border bg-surface grid place-items-center text-rust shadow-sm hover:bg-rust-tint"><Icon name="dislike" size={26} /></button>
          <button onClick={() => decide(true)} aria-label="Yes, that's me" className="h-16 w-16 rounded-full border bg-surface grid place-items-center text-sage shadow-sm hover:bg-sage-tint"><Icon name="like" size={26} /></button>
        </div>
      )}
    </div>
  );
}
