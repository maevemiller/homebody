"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProgressRail from "@/components/ProgressRail";
import Room3D from "@/components/Room3D";
import { useHomebody } from "@/lib/state";
import { CATALOG_ROOMS, ROOM_LABELS } from "@/lib/catalog";
import { recommendRoom, roomTotal, CategoryPick } from "@/lib/recommend";
import { buildRoomScene } from "@/lib/spatial";
import { formatUSD } from "@/lib/pricing";
import { RoomId } from "@/lib/types";

function BudgetBar({ total, budget }: { total: number; budget: number }) {
  const pct = Math.min(100, Math.round((total / budget) * 100));
  const over = total > budget;
  return (
    <div>
      <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: over ? "var(--clay)" : "var(--sage)" }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs mono">
        <span className={over ? "text-clay" : "text-sage"}>{formatUSD(total)}</span>
        <span className="text-ink-faint">of {formatUSD(budget)} budget</span>
      </div>
    </div>
  );
}

function CategoryTile({
  pick,
  room,
  onSwap,
  onRemoveOwned,
}: {
  pick: CategoryPick;
  room: RoomId;
  onSwap: (room: RoomId, category: string, nextId: string) => void;
  onRemoveOwned: (id: string) => void;
}) {
  const { chosen, options, categoryLabel, isCore } = pick;
  const idx = options.findIndex((o) => o.id === chosen.id);
  const shopHref = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(chosen.name)}`;

  function swap() {
    const next = options[(idx + 1) % options.length];
    onSwap(room, pick.categoryKey, next.id);
  }

  return (
    <div className="rounded-md border border-line-strong bg-surface overflow-hidden">
      {chosen.isOwned && chosen.photoDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={chosen.photoDataUrl} alt={chosen.name} className="h-28 w-full object-cover" />
      ) : (
        <div className="h-28" style={{ background: chosen.swatch }} />
      )}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="mono text-[10px] uppercase text-ink-faint">
            {categoryLabel}
            {!isCore && !chosen.isOwned && <span className="text-sage"> · accessory</span>}
            {chosen.isOwned && <span className="text-sage"> · yours</span>}
          </span>
          <span className="mono text-xs">{chosen.isOwned ? "—" : formatUSD(chosen.price)}</span>
        </div>
        <div className="mt-1 font-display font-semibold">{chosen.name}</div>
        <p className="mt-1 text-xs text-ink-soft">{chosen.note}</p>
        <div className="mt-3 flex items-center gap-3">
          {chosen.isOwned ? (
            <button
              onClick={() => onRemoveOwned(chosen.id)}
              className="text-xs font-medium text-clay hover:underline"
            >
              Use a recommendation instead
            </button>
          ) : (
            <>
              {options.length > 1 && (
                <button onClick={swap} className="text-xs font-medium text-clay hover:underline">
                  Swap ({idx + 1}/{options.length})
                </button>
              )}
              <a
                href={shopHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-sage hover:underline"
              >
                Find this online →
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const { state, hydrated, setSwap, removeInventoryItem } = useHomebody();
  const { intake, functional, style, swaps, inventory } = state;
  const [show3D, setShow3D] = useState<Record<string, boolean>>({});

  const coveredRooms = intake.rooms.filter((r) => CATALOG_ROOMS.includes(r));
  const functionalDone = coveredRooms.every((r) => functional[r]);

  useEffect(() => {
    if (!hydrated) return;
    if (intake.rooms.length === 0 || !intake.mode) return router.replace("/start");
    if (!functionalDone) return router.replace("/plan/functional");
    if (style.aesthetics.length === 0) return router.replace("/plan/style");
  }, [hydrated, intake, functionalDone, style, router]);

  const plans = useMemo(() => {
    return coveredRooms
      .filter((r) => functional[r])
      .map((r) => {
        const picks = recommendRoom(r, functional[r]!, style, swaps, inventory);
        return { room: r, picks, total: roomTotal(picks), budget: functional[r]!.budget };
      });
  }, [coveredRooms, functional, style, swaps, inventory]);

  if (!hydrated || !functionalDone || style.aesthetics.length === 0) return null;

  const grandTotal = plans.reduce((s, p) => s + p.total, 0);
  const grandBudget = plans.reduce((s, p) => s + p.budget, 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <ProgressRail current={5} />
      <span className="eyebrow text-clay">Your plan</span>
      <h1 className="mt-3 text-4xl font-semibold">Room by room, ready to shop</h1>
      <p className="mt-3 text-ink-soft max-w-xl">
        Every pick is matched to the directions you chose. Anything you
        photographed as already yours is kept as-is. Swap anything — each
        swap only changes that one piece for now; propagating a single swap
        into the rest of the room automatically is a v3 feature, not this
        prototype.
      </p>

      <div className="mt-8 rounded-md border border-clay bg-clay-tint p-5 flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-sm text-ink-soft">Plan total</span>
        <span className="font-display text-2xl font-semibold mono">
          {formatUSD(grandTotal)}{" "}
          <span className="text-sm font-sans font-normal text-ink-soft">
            of {formatUSD(grandBudget)} across {plans.length} room{plans.length === 1 ? "" : "s"}
          </span>
        </span>
      </div>

      <div className="mt-12 space-y-16">
        {plans.map(({ room, picks, total, budget }) => {
          const scene = buildRoomScene(
            room,
            functional[room]!,
            picks,
            intake.photos.find((p) => p.room === room)?.dataUrl
          );
          const is3DOpen = !!show3D[room];
          return (
            <section key={room}>
              <div className="flex items-baseline justify-between gap-6 flex-wrap">
                <h2 className="text-2xl font-semibold">{ROOM_LABELS[room]}</h2>
                <div className="w-56">
                  <BudgetBar total={total} budget={budget} />
                </div>
              </div>

              <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {picks.map((pick) => (
                  <CategoryTile
                    key={`${pick.categoryKey}-${pick.chosen.id}`}
                    pick={pick}
                    room={room}
                    onSwap={setSwap}
                    onRemoveOwned={removeInventoryItem}
                  />
                ))}
              </div>

              <div className="mt-5">
                <button
                  onClick={() => setShow3D((s) => ({ ...s, [room]: !s[room] }))}
                  className="mono text-xs px-4 py-2.5 rounded-full border border-line-strong text-ink hover:border-clay hover:text-clay transition-colors"
                >
                  {is3DOpen ? "Hide 3D preview ▲" : "View this room in 3D ▼"}
                </button>
                {scene.estimatedDimensions && (
                  <span className="ml-3 text-xs text-ink-faint">
                    No dimensions entered — using a typical {ROOM_LABELS[room].toLowerCase()} size.
                  </span>
                )}
                {is3DOpen && (
                  <div className="mt-4">
                    <Room3D scene={scene} />
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
