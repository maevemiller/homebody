"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProgressRail from "@/components/ProgressRail";
import { useHomebody } from "@/lib/state";
import { CATALOG_ROOMS, ROOM_LABELS, ROOM_CATEGORIES } from "@/lib/catalog";
import { InventoryItem, RoomId } from "@/lib/types";

function defaultBudget(room: RoomId, pack: "standard" | "extended") {
  const def = ROOM_CATEGORIES[room];
  const count = pack === "extended" ? def.core.length + def.accessory.length : def.core.length;
  return count * 450;
}

function allCategories(room: RoomId) {
  const def = ROOM_CATEGORIES[room];
  return [...def.core, ...def.accessory, { key: "other", label: "Other" }];
}

function AddOwnedItemForm({
  room,
  onAdd,
}: {
  room: RoomId;
  onAdd: (item: InventoryItem) => void;
}) {
  const categories = allCategories(room);
  const [category, setCategory] = useState(categories[0]?.key ?? "other");
  const [label, setLabel] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(undefined);

  function onPhoto(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  function add() {
    if (!label.trim()) return;
    const categoryLabel = categories.find((c) => c.key === category)?.label ?? "Other";
    onAdd({
      // Date.now() here only ever runs inside this click handler, never
      // during render — safe despite the purity lint rule's static check.
      // eslint-disable-next-line react-hooks/purity
      id: `inv-${Date.now()}`,
      room,
      category,
      categoryLabel,
      label: label.trim(),
      photoDataUrl: photo,
    });
    setLabel("");
    setPhoto(undefined);
  }

  return (
    <div>
      <div className="grid sm:grid-cols-[140px_1fr_auto] gap-2 items-end">
        <label className="block">
          <span className="text-xs font-medium">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-sage"
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium">What is it?</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Grandmother's cobalt dishware"
            className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-sage"
          />
        </label>
        <label className="flex-1">
          <span className="text-xs font-medium block mb-1">Photo</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-ink-soft file:mr-2 file:py-1.5 file:px-2.5 file:rounded-full file:border-0 file:bg-surface-2 file:text-ink file:text-xs"
          />
        </label>
      </div>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="Preview" className="mt-2 h-16 w-16 rounded object-cover" />
      )}
      <button
        onClick={add}
        disabled={!label.trim()}
        className="mt-3 text-sm font-medium px-4 py-2 rounded-full bg-sage text-[#F7F4EB] disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
      >
        Add to {ROOM_LABELS[room]}
      </button>
    </div>
  );
}

export default function FunctionalInfoPage() {
  const router = useRouter();
  const {
    state,
    setFunctionalRoom,
    addInventoryItem,
    removeInventoryItem,
    hydrated,
  } = useHomebody();
  const { intake, functional, inventory } = state;

  const coveredRooms = intake.rooms.filter((r) => CATALOG_ROOMS.includes(r));
  const uncoveredRooms = intake.rooms.filter((r) => !CATALOG_ROOMS.includes(r));

  const [activeOverride, setActiveOverride] = useState<RoomId | null>(null);
  const active =
    activeOverride && coveredRooms.includes(activeOverride)
      ? activeOverride
      : coveredRooms[0] ?? null;

  useEffect(() => {
    if (!hydrated) return;
    if (intake.rooms.length === 0 || !intake.mode) router.replace("/start");
  }, [hydrated, intake, router]);

  if (!hydrated) return null;

  const allDone = coveredRooms.every((r) => functional[r]);

  function pickPack(room: RoomId, pack: "standard" | "extended") {
    const existing = functional[room];
    setFunctionalRoom(room, {
      pack,
      dimensions: existing?.dimensions ?? "",
      budget: existing?.budget ?? defaultBudget(room, pack),
    });
  }

  function setDimensions(room: RoomId, dimensions: string) {
    const existing = functional[room];
    setFunctionalRoom(room, {
      pack: existing?.pack ?? "standard",
      dimensions,
      budget: existing?.budget ?? defaultBudget(room, existing?.pack ?? "standard"),
    });
  }

  function setBudget(room: RoomId, budget: number) {
    const existing = functional[room];
    setFunctionalRoom(room, {
      pack: existing?.pack ?? "standard",
      dimensions: existing?.dimensions ?? "",
      budget,
    });
  }

  const activeInventory = active ? inventory.filter((i) => i.room === active) : [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <ProgressRail current={3} />
      <span className="eyebrow text-clay">Functional info</span>
      <h1 className="mt-3 text-4xl font-semibold">What goes in each room</h1>
      <p className="mt-3 text-ink-soft max-w-xl">
        Room by room: pick the standard or extended item pack, note rough
        dimensions if you have them, set a budget, and tell us about anything
        you already own.
      </p>

      <div className="mt-10 grid md:grid-cols-[180px_1fr] gap-8">
        <nav className="flex md:flex-col gap-1.5 flex-wrap">
          {coveredRooms.map((r) => (
            <button
              key={r}
              onClick={() => setActiveOverride(r)}
              className={`text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
                active === r ? "bg-clay-tint text-ink font-medium border border-clay" : "text-ink-soft hover:bg-surface border border-transparent"
              }`}
            >
              {ROOM_LABELS[r]}
              {functional[r] && <span className="ml-2 text-sage mono text-[10px]">✓</span>}
            </button>
          ))}
        </nav>

        <div>
          {active && (
            <div className="rounded-md border border-line bg-surface p-6">
              <h2 className="text-xl font-semibold">{ROOM_LABELS[active]}</h2>

              <div className="mt-5">
                <span className="text-sm font-medium">Item pack</span>
                <div className="mt-2 grid sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => pickPack(active, "standard")}
                    className={`text-left rounded-md border p-4 ${
                      functional[active]?.pack === "standard" || !functional[active]
                        ? "border-clay bg-clay-tint"
                        : "border-line bg-surface"
                    }`}
                  >
                    <div className="font-medium text-sm">Standard set</div>
                    <p className="mt-1 text-xs text-ink-soft">
                      {ROOM_CATEGORIES[active].core.map((c) => c.label).join(", ")}
                    </p>
                  </button>
                  <button
                    onClick={() => pickPack(active, "extended")}
                    className={`text-left rounded-md border p-4 ${
                      functional[active]?.pack === "extended" ? "border-sage bg-sage-tint" : "border-line bg-surface"
                    }`}
                  >
                    <div className="font-medium text-sm">Extended set</div>
                    <p className="mt-1 text-xs text-ink-soft">
                      Standard, plus {ROOM_CATEGORIES[active].accessory.map((c) => c.label).join(", ")}
                    </p>
                  </button>
                </div>
              </div>

              <label className="block mt-5">
                <span className="text-sm font-medium">Rough dimensions <span className="text-ink-faint font-normal">(optional)</span></span>
                <input
                  value={functional[active]?.dimensions ?? ""}
                  onChange={(e) => setDimensions(active, e.target.value)}
                  placeholder={'e.g. 12ft × 14ft, one window wall'}
                  className="mt-1.5 w-full rounded-md border border-line bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-clay"
                />
                <span className="mt-1 block text-xs text-ink-faint">
                  Used to size your room in the 3D preview on the results page.
                </span>
              </label>

              <label className="block mt-5">
                <span className="text-sm font-medium">Budget for this room</span>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="range"
                    min={200}
                    max={4000}
                    step={50}
                    value={functional[active]?.budget ?? defaultBudget(active, "standard")}
                    onChange={(e) => setBudget(active, Number(e.target.value))}
                    className="flex-1 accent-[var(--clay)]"
                  />
                  <span className="mono text-sm w-20 text-right">
                    ${(functional[active]?.budget ?? defaultBudget(active, "standard")).toLocaleString()}
                  </span>
                </div>
              </label>
            </div>
          )}

          {active && (
            <div className="mt-6 rounded-md border border-sage bg-sage-tint p-6">
              <span className="eyebrow text-sage">Already yours</span>
              <h3 className="mt-2 font-display font-semibold text-lg">
                Have a piece for the {ROOM_LABELS[active].toLowerCase()} already?
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                Snap a photo (or pull one from your camera roll) and we&apos;ll build
                the plan — and the 3D preview — around it instead of recommending
                something new for that spot.
              </p>

              {activeInventory.length > 0 && (
                <ul className="mt-4 grid sm:grid-cols-2 gap-3">
                  {activeInventory.map((item) => (
                    <li key={item.id} className="flex gap-3 rounded-md border border-line-strong bg-surface p-3">
                      {item.photoDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.photoDataUrl} alt={item.label} className="h-14 w-14 rounded object-cover flex-none" />
                      ) : (
                        <div className="h-14 w-14 rounded bg-surface-2 flex-none" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mono text-[10px] uppercase text-ink-faint">{item.categoryLabel}</div>
                        <div className="text-sm truncate">{item.label}</div>
                        <button
                          onClick={() => removeInventoryItem(item.id)}
                          className="mt-1 text-xs text-clay hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4">
                <AddOwnedItemForm key={active} room={active} onAdd={addInventoryItem} />
              </div>
            </div>
          )}

          {uncoveredRooms.length > 0 && (
            <p className="mt-6 text-xs text-ink-faint mono">
              {uncoveredRooms.map((r) => ROOM_LABELS[r]).join(", ")}: curation is
              still in progress for v0 — not included in this plan yet.
            </p>
          )}
        </div>
      </div>

      <div className="mt-10">
        <button
          disabled={!allDone}
          onClick={() => router.push("/plan/style")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-clay text-[#F7F4EB] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue to style
        </button>
        {!allDone && (
          <p className="mt-2 text-xs text-ink-faint">Set a pack for every room to continue.</p>
        )}
      </div>
    </div>
  );
}
