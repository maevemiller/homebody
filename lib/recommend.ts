import { CATALOG, ROOM_CATEGORIES, itemsFor } from "./catalog";
import { CatalogItem, InventoryItem, RoomFunctionalInfo, RoomId, StyleAnswers } from "./types";

export interface CategoryPick {
  categoryKey: string;
  categoryLabel: string;
  isCore: boolean;
  options: CatalogItem[]; // scored, best first — a single entry for owned items
  chosen: CatalogItem;
}

const OWNED_SWATCHES = ["#C9BFA8", "#B7C4B0", "#C7AFA0", "#AEB9C2"];

function score(item: CatalogItem, style: StyleAnswers): number {
  let s = 0;
  for (const tag of item.aesthetics) {
    if (style.aesthetics.includes(tag)) s += 2;
  }
  if (style.palette && item.palette.includes(style.palette)) s += 1;
  return s;
}

export function categoriesForRoom(room: RoomId, pack: "standard" | "extended") {
  const def = ROOM_CATEGORIES[room];
  const cats = pack === "extended" ? [...def.core, ...def.accessory] : def.core;
  return cats.map((c) => ({ ...c, isCore: def.core.some((k) => k.key === c.key) }));
}

function ownedAsCatalogItem(item: InventoryItem, index: number): CatalogItem {
  return {
    id: item.id,
    room: item.room,
    category: item.category,
    categoryLabel: item.categoryLabel,
    packTier: "standard",
    name: item.label,
    price: 0,
    swatch: OWNED_SWATCHES[index % OWNED_SWATCHES.length],
    aesthetics: [],
    palette: [],
    note: "Already yours — kept as-is, not recommended.",
    isOwned: true,
    photoDataUrl: item.photoDataUrl,
  };
}

export function recommendRoom(
  room: RoomId,
  functional: RoomFunctionalInfo,
  style: StyleAnswers,
  swaps: Record<string, string>,
  inventory: InventoryItem[] = []
): CategoryPick[] {
  const cats = categoriesForRoom(room, functional.pack);
  const roomInventory = inventory.filter((i) => i.room === room);
  const byCategory = new Map<string, InventoryItem[]>();
  for (const item of roomInventory) {
    byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
  }

  const picks: CategoryPick[] = [];
  const handledCategories = new Set<string>();

  for (const { key, label, isCore } of cats) {
    handledCategories.add(key);
    const owned = byCategory.get(key);
    if (owned && owned.length > 0) {
      owned.forEach((item, i) => {
        const catalogShaped = ownedAsCatalogItem(item, i);
        picks.push({
          categoryKey: key,
          categoryLabel: label,
          isCore,
          options: [catalogShaped],
          chosen: catalogShaped,
        });
      });
      continue;
    }

    const options = itemsFor(room, key).sort((a, b) => {
      const diff = score(b, style) - score(a, style);
      if (diff !== 0) return diff;
      return a.price - b.price;
    });
    const swapKey = `${room}::${key}`;
    const swappedId = swaps[swapKey];
    const chosen = (swappedId && options.find((o) => o.id === swappedId)) || options[0];
    picks.push({ categoryKey: key, categoryLabel: label, isCore, options, chosen });
  }

  // Owned pieces in a category outside the current pack (e.g. tagged "other")
  // still belong in the plan — they just weren't recommended.
  for (const [key, items] of byCategory) {
    if (handledCategories.has(key)) continue;
    items.forEach((item, i) => {
      const catalogShaped = ownedAsCatalogItem(item, i);
      picks.push({
        categoryKey: key,
        categoryLabel: item.categoryLabel,
        isCore: false,
        options: [catalogShaped],
        chosen: catalogShaped,
      });
    });
  }

  return picks;
}

export function roomTotal(picks: CategoryPick[]): number {
  return picks.reduce((sum, p) => sum + p.chosen.price, 0);
}

export function allItemIds(): string[] {
  return CATALOG.map((i) => i.id);
}
