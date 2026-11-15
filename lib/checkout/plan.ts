import seed from "@/docs/reference/sourcing/seed-products.json";
import type { RoomItem, RoomSpec } from "@/lib/scan/spec";
import { KINDS, PRODUCT, colorGap, isBasics, twinOf, type Kind, type Product } from "@/lib/play/catalog";
import { initialLayout, readLayout, reconcile, storageKey, type Layout } from "@/lib/play/layout";
import type { Saved } from "@/lib/taste/saved";

// Transaction (/checkout/[id]): what a room's Plug & Play layout costs and where to buy it.
// The Plug & Play catalog is sample data with illustrative prices, so each new piece carries a clearly
// labelled estimate and, where the seed has one, the closest real listing to link to (Amazon Berkeley
// Objects, CC BY 4.0: no prices, so "Price on Amazon"). No payments: checkout happens at each retailer.

export interface Listing {
  id: string;
  name: string;
  brand: string;
  retailer: string;
  url: string;
  image: string;
  // inches, width × depth × height
  dims: { w: number; d: number; h: number };
}

interface SeedItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  color_hex: string | null;
  dims_in: { w: number; d: number; h: number };
  product_url: string;
  image_url: string;
  homebody: { w: number; material: string };
}

const SEED = (seed as { items: SeedItem[] }).items;
export const LISTING_CREDIT = "Real listings, photos and sizes: Amazon.com (Amazon Berkeley Objects, CC BY 4.0). Prices aren't in that data.";

// The sample kinds as the seed's categories; lamps and tables split by size
function seedCategories(p: Product): string[] {
  switch (p.category) {
    case "sofa": return ["sofa"];
    case "chair": return ["accent_chair"];
    case "rug": return ["rug"];
    case "lamp": return p.h > 1 ? ["floor_lamp"] : ["table_lamp"];
    case "table": return p.w > 0.8 ? ["coffee_table"] : ["side_table"];
    case "shelf": return ["bookcase"];
    default: return [];
  }
}

const listingOf = (s: SeedItem): Listing => ({
  id: s.id,
  // "Amazon Brand – Rivet Aiden Mid-Century Sectional ..., 86"W, Hunter Green" → the part a person reads
  name: s.name.replace(/^(Amazon Brand\s*[–-]\s*)/, "").split(",")[0].trim(),
  brand: s.brand,
  retailer: "Amazon",
  url: s.product_url,
  image: s.image_url,
  dims: s.dims_in,
});

/** The closest real listing to a sample piece: same kind, then material, color and width. */
export function closestListing(p: Product): Listing | undefined {
  const cats = seedCategories(p);
  const pool = SEED.filter((s) => cats.includes(s.category));
  const score = (s: SeedItem) =>
    (s.homebody.material === p.material ? 0 : 0.35) +
    (s.color_hex ? colorGap(s.color_hex, p.color) : 0.25) +
    Math.min(0.3, Math.abs(s.homebody.w - p.w) / 3);
  const best = [...pool].sort((a, b) => score(a) - score(b))[0];
  return best ? listingOf(best) : undefined;
}

/** A search on a retailer, for a piece with no real listing in the seed. A plain link, labelled as a search. */
export const searchUrl = (p: Product) =>
  `https://www.amazon.com/s?k=${encodeURIComponent(`${p.name.replace(/^\w+\s/, "")} ${p.category === "art" ? "wall art" : ""}`.trim())}`;

// ---- One room's plan ----

export interface NewLine {
  key: string;
  product: Product;
  // the same look for less, when this piece has one
  twin?: Product;
  // one of theirs this replaces (a Swap in Plug & Play)
  replaces?: string;
  placed: boolean;
}

export interface OwnLine {
  key: string;
  name: string;
  brought: boolean;
}

export interface RoomPlan {
  id: string;
  name: string;
  hero?: string;
  lines: NewLine[];
  own: OwnLine[];
  // there's no layout saved from Plug & Play yet
  untouched: boolean;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Every room this browser has a Plug & Play layout for. */
export function roomsWithLayouts(): string[] {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(storageKey("")))
      .map((k) => k.slice(storageKey("").length))
      .filter((id) => /^[\w-]+$/.test(id))
      .sort();
  } catch {
    return [];
  }
}

/** The layout as Plug & Play would open it: the saved one brought up to date with the sorting, or the starting one. */
export function layoutFor(id: string, spec: RoomSpec): { layout: Layout; untouched: boolean } {
  const capture = readJson<{ roomId?: string; absent?: string[]; answers?: { brought?: string[] } }>("homebody-capture", {});
  const ours = capture.roomId === id;
  const inputs = {
    spec,
    bins: readJson<Record<string, string>>(`homebody-bins-${id}`, {}),
    absent: readJson<string[]>(`homebody-absent-${id}`, ours ? capture.absent ?? [] : []),
    brought: ours ? capture.answers?.brought ?? [] : [],
  };
  const fresh = initialLayout(inputs);
  const saved = readLayout(id);
  return { layout: saved ? reconcile(saved, fresh, inputs) : fresh, untouched: !saved };
}

export function planFor(id: string, spec: RoomSpec, hero?: string): RoomPlan {
  const { layout, untouched } = layoutFor(id, spec);
  const items = new Map<string, RoomItem>(spec.items.map((i) => [i.id, i]));
  const lines: NewLine[] = [];
  const own: OwnLine[] = [];
  for (const p of layout.pieces) {
    const product = p.product ? PRODUCT.get(p.product) : undefined;
    const item = p.item ? items.get(p.item) : undefined;
    if (product) {
      lines.push({ key: p.key, product, twin: twinOf(product), replaces: item?.name, placed: p.placed });
    } else if (item) {
      own.push({ key: p.key, name: item.name, brought: false });
    } else if (p.brought) {
      own.push({ key: p.key, name: p.brought.split(/,|\(| - | — /)[0].trim() || p.brought, brought: true });
    }
  }
  lines.sort((a, b) => KINDS.indexOf(a.product.category) - KINDS.indexOf(b.product.category) || b.product.price - a.product.price);
  return { id, name: spec.name || "Room", hero, lines, own, untouched };
}

/** A twin that's actually cheaper: the toggle only offers to save money. */
export const cheaperTwin = (l: NewLine) => (l.twin && l.twin.price < l.product.price && !isBasics(l.product) ? l.twin : undefined);

// ---- Lookalike choices, kept per room (Plug & Play's layout stays as she left it) ----

export const choiceKey = (id: string) => `homebody-checkout-${id}`;

export function readLookalikes(id: string): string[] {
  const v = readJson<{ lookalikes?: unknown }>(choiceKey(id), {}).lookalikes;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function writeLookalikes(id: string, keys: string[]) {
  try {
    localStorage.setItem(choiceKey(id), JSON.stringify({ lookalikes: keys }));
  } catch {}
}

// ---- The brief: its idea line and budget ----

const BUDGET_LABEL: Record<string, string> = {
  lean: "Keeping it lean", mid: "Somewhere in the middle", invest: "Happy to invest",
};

export interface BriefBits {
  idea?: string;
  title?: string;
  // a figure in dollars, when she gave one
  budget?: number;
  // the budget as she chose it, when there's no figure
  budgetLabel?: string;
  // the line the figure came from
  budgetSource?: string;
}

const MONEY = /\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k\b)?/gi;

function figures(text: string): number[] {
  return [...text.matchAll(MONEY)].map((m) => Number(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1)).filter((n) => n >= 50);
}

/** The budget figure in the brief: a line about budget or spending, its highest figure (the top of a range). */
export function budgetIn(lines: string[]): { amount: number; line: string } | undefined {
  const about = /\b(budget|spend|ceiling|cap|up to|total|all[- ]in)\b/i;
  for (const pass of [true, false]) {
    for (const line of lines) {
      if (pass && !about.test(line)) continue;
      const f = figures(line);
      if (f.length) return { amount: Math.max(...f), line };
    }
  }
  return undefined;
}

export function briefBits(id: string): BriefBits {
  const saved = readJson<Partial<Saved>>("homebody-taste", {});
  const capture = readJson<{ roomId?: string }>("homebody-capture", {});
  // the brief belongs to the room she captured; a room from elsewhere shows no idea line
  const mine = !capture.roomId || capture.roomId === id;
  const c = mine ? saved.convo?.concept : undefined;
  const lines = [
    ...(c?.constraints ?? []),
    ...(c?.decisions ?? []).map((d) => `${d.decision} (${d.because})`),
    ...(saved.convo?.dossier ?? []).map((d) => d.text),
    ...Object.values(saved.answers ?? {}).filter((v): v is string => typeof v === "string"),
  ];
  const found = budgetIn(lines);
  const answer = saved.answers?.budget;
  return {
    idea: c?.statement?.trim() || undefined,
    title: c?.title?.trim() || undefined,
    budget: found?.amount,
    budgetSource: found?.line,
    budgetLabel: typeof answer === "string" ? BUDGET_LABEL[answer] : undefined,
  };
}

// ---- Formatting ----

const IN = 39.3701;
/** Inches, rounded, width × depth × height. Rugs read as feet. */
export function dimsText(d: { w: number; d: number; h: number }, kind?: Kind | string) {
  if (kind === "rug") {
    const ft = (n: number) => {
      const t = Math.round(n / 6) / 2;
      return `${t % 1 ? t.toFixed(1) : t}′`;
    };
    return `${ft(d.w)} × ${ft(d.d)}`;
  }
  return `${Math.round(d.w)} × ${Math.round(d.d)} × ${Math.round(d.h)} in`;
}
export const productDims = (p: Product) => dimsText({ w: p.w * IN, d: p.d * IN, h: p.h * IN }, p.category);
