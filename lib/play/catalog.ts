import data from "./products.json";
import type { TasteState } from "@/lib/taste/visual";

// The Plug & Play sample catalog: about twenty made-up products with
// illustrative prices, each drawn as a simple parametric model. SAMPLE DATA
// only; real retailers, models and links belong to Transaction.

export const KINDS = ["sofa", "chair", "rug", "lamp", "table", "shelf", "art"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<Kind, string> = {
  sofa: "Sofas", chair: "Chairs", rug: "Rugs", lamp: "Lamps", table: "Tables", shelf: "Shelves", art: "Art",
};

export const KIND_ONE: Record<Kind, string> = {
  sofa: "Sofa", chair: "Chair", rug: "Rug", lamp: "Lamp", table: "Table", shelf: "Shelf", art: "Art",
};

export interface Product {
  id: string;
  name: string;
  maker: string;
  price: number;
  category: Kind;
  // meters: width side to side, depth front to back, height
  w: number;
  d: number;
  h: number;
  color: string;
  accent: string;
  material: string;
  accentMaterial: string;
  families: string[];
  palettes: string[];
  // products sharing a look are lookalikes at different prices (the Dupe idea)
  look?: string;
  variant?: string;
  // art: the colors its abstract composition is drawn from
  art?: string[];
}

export const SAMPLE_NOTE: string = data.note;
export const PRODUCTS = data.products as Product[];
export const PRODUCT = new Map(PRODUCTS.map((p) => [p.id, p]));

// The room scan's categories (lib/scan/spec.ts) as catalog kinds, for Swap
const KIND_OF: Record<string, Kind> = {
  sofa: "sofa", sectional: "sofa",
  armchair: "chair", accent_chair: "chair", dining_chair: "chair", office_chair: "chair",
  rug: "rug",
  floor_lamp: "lamp", table_lamp: "lamp",
  coffee_table: "table", side_table: "table",
  bookshelf: "shelf", shelving_unit: "shelf",
  artwork: "art", mirror: "art",
};
export const kindOf = (category: string): Kind | undefined =>
  (KINDS as readonly string[]).includes(category) ? (category as Kind) : KIND_OF[category];

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// ---- Taste fit: palette, material and style overlap with the Taste Builder picks ----

export function hasTaste(t: TasteState | undefined): t is TasteState {
  return !!t && (t.palettes.liked.length > 0 || t.materials.liked.length > 0 || Object.keys(t.styles).length > 0);
}

export function fitScore(p: Product, t: TasteState): number {
  let s = 0;
  if (t.materials.liked.includes(p.material)) s += 2;
  if (t.materials.liked.includes(p.accentMaterial)) s += 0.5;
  if (t.materials.never.includes(p.material)) s -= 3;
  if (p.palettes.some((id) => t.palettes.liked.includes(id))) s += 1.5;
  if (p.palettes.some((id) => t.palettes.never.includes(id))) s -= 2;
  const top = Math.max(0.0001, ...Object.values(t.styles).map((v) => v ?? 0));
  const styles = t.styles as Record<string, number | undefined>;
  const excluded = (t.excluded ?? []) as string[];
  for (const f of p.families) {
    if (excluded.includes(f)) s -= 1;
    else s += (2 * Math.max(0, styles[f] ?? 0)) / top / p.families.length;
  }
  return s;
}

export const GOOD_FIT = 2;

/** The catalog in browsing order: by taste fit when there's a profile, else by kind then price. */
export function sortCatalog(t: TasteState | undefined): { product: Product; fit: number | null }[] {
  if (!hasTaste(t)) {
    return [...HEROES]
      .sort((a, b) => KINDS.indexOf(a.category) - KINDS.indexOf(b.category) || a.price - b.price)
      .map((product) => ({ product, fit: null }));
  }
  return HEROES.map((product) => ({ product, fit: fitScore(product, t) }))
    .sort((a, b) => b.fit! - a.fit! || a.product.price - b.product.price);
}

export const isBasics = (p: Product) => /basics/i.test(p.maker);

/** The same look at the other price: a studio piece's basics twin, or a basics piece's studio original. */
export function twinOf(p: Product): Product | undefined {
  if (!p.look) return undefined;
  return PRODUCTS.find((q) => q.id !== p.id && q.look === p.look && isBasics(q) !== isBasics(p));
}

/** What the catalog lists: one card per look (the studio piece, with its lookalike's price on the card). */
export const HEROES = PRODUCTS.filter((p) => !(isBasics(p) && twinOf(p)));

export interface Alternative {
  product: Product;
  // why it's offered: the same look for less (or more), the closest thing to their own piece, or just another option
  reason: "less" | "more" | "closest" | "other";
}

// The scan's materials (lib/scan/spec.ts) in catalog terms, for "closest to yours"
const MATERIAL_LIKE: Record<string, string[]> = {
  fabric: ["linen", "wool", "boucle"], velvet: ["linen", "boucle"], boucle: ["boucle"], leather: ["leather"],
  wood_light: ["white_oak"], wood_mid: ["white_oak", "walnut"], wood_dark: ["walnut"],
  metal_black: ["black_steel"], metal_brass: ["brass"], metal_chrome: ["black_steel"],
  marble: ["limestone"], stone: ["limestone"], ceramic: ["limestone"], wicker: ["jute"], glass: [], painted: [], plastic: [],
};

function rgb(hex: string) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** 0 for the same color, about 1 for opposite ends of the range (weighted RGB, close enough for furniture). */
export function colorGap(a: string, b: string) {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  const rm = (r1 + r2) / 2;
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2) / 765;
}

export interface Own {
  color: string;
  material: string;
  w: number;
}

/** How close a product is to one of their own pieces: color, material and size. Lower is closer. */
export function likeness(p: Product, own: Own) {
  const mat = (MATERIAL_LIKE[own.material] ?? []).includes(p.material) ? 0 : 0.35;
  return colorGap(p.color, own.color) + mat + Math.min(0.3, Math.abs(p.w - own.w) / 3);
}

/**
 * Up to three swaps of the same kind. A catalog piece leads with its twin (the same look at the other price);
 * one of their own leads with the closest match to it, then that match's cheaper twin. The rest fill in by taste.
 */
export function alternatives(kind: Kind, current: Product | undefined, t: TasteState | undefined, own?: Own): Alternative[] {
  const fit = (p: Product) => (hasTaste(t) ? fitScore(p, t) : 0);
  const pool = PRODUCTS.filter((p) => p.category === kind && p.id !== current?.id);
  const out: Alternative[] = [];
  const take = (p: Product | undefined, reason: Alternative["reason"]) => {
    if (p && p.id !== current?.id && !out.some((a) => a.product.id === p.id)) out.push({ product: p, reason });
  };
  if (current) {
    const twin = twinOf(current);
    if (twin) take(twin, twin.price < current.price ? "less" : "more");
  } else if (own) {
    const closest = [...pool].sort((a, b) => likeness(a, own) - likeness(b, own))[0];
    if (closest) {
      // the closest match, and the same look for less when there is one
      const studio = isBasics(closest) ? twinOf(closest) ?? closest : closest;
      take(studio, "closest");
      const twin = twinOf(studio);
      if (twin) take(twin, "less");
    }
  }
  // fill in with other looks at a spread of prices: best taste fit first, one per look
  const looks = new Set(out.map((a) => a.product.look));
  for (const p of [...pool].sort((a, b) => fit(b) - fit(a) || a.price - b.price)) {
    if (out.length >= 3) break;
    if (p.look && looks.has(p.look)) continue;
    if (current?.look && p.look === current.look) continue;
    take(p, "other");
    if (p.look) looks.add(p.look);
  }
  return out;
}
