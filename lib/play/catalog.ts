import data from "./products.json";
import seed from "@/docs/reference/sourcing/seed-products.json";
import { PALETTES, type TasteState } from "@/lib/taste/visual";
import { distance } from "@/lib/design/color";

// The Plug & Play catalog: real products from the Amazon Berkeley Objects seed (CC BY 4.0, credited
// "Amazon.com"; no prices in the data, so estimates are labelled as such) and the made-up sample pieces
// with illustrative prices. Every piece is drawn as a parametric model sized to its real dimensions
// (components/play/models.ts); the ABO GLBs (~50 MB each) are never loaded.

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
  // a finer type within the kind (coffee_table, side_table, console, desk, sideboard, ottoman, dining_chair, mirror…)
  sub?: string;
  // a real, buyable product (docs/reference/sourcing/seed-products.json): no price in the licensed data, so
  // `price` holds the middle of an estimate for totals, and the estimate is always shown as one
  real?: Real;
}

export interface Real {
  brand: string;
  url: string;
  image: string;
  colorName: string;
  // the listing's own size, in inches
  dimsIn: { w: number; d: number; h: number };
  credit: string;
  // a range from typical prices for this kind of piece at this brand tier: an estimate, never a quote
  estimate: [number, number] | null;
}

export const SAMPLE_NOTE: string = data.note;
export const REAL_CREDIT = "Amazon.com, CC BY 4.0";

// ---- Real products: the ABO seed (CC BY 4.0, "Amazon.com"), sized to their real dimensions ----

interface SeedItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  color: string | null;
  color_hex: string | null;
  dims_in: { w: number; d: number; h: number };
  product_url: string;
  image_url: string;
  homebody: { category: string; w: number; d: number; h: number; material: string; accentMaterial: string | null; families_guess: string[] };
}

// the seed's categories as catalog kinds; beds, pendants, table lamps and planters have no place to stand yet
const SEED_KIND: Record<string, [Kind, string]> = {
  sofa: ["sofa", "sofa"], accent_chair: ["chair", "accent_chair"], dining_chair: ["chair", "dining_chair"],
  ottoman: ["table", "ottoman"], coffee_table: ["table", "coffee_table"], side_table: ["table", "side_table"],
  nightstand: ["table", "nightstand"], console_table: ["table", "console"], desk: ["table", "desk"],
  dining_table: ["table", "dining_table"], sideboard: ["shelf", "sideboard"], dresser: ["shelf", "dresser"],
  bookcase: ["shelf", "bookcase"], floor_lamp: ["lamp", "floor_lamp"], rug: ["rug", "rug"], mirror: ["art", "mirror"],
};

// typical US prices for an Amazon private-label piece of this type (2024–26 listings): a guide, labelled as one
const ESTIMATE: Record<string, [number, number]> = {
  sofa: [700, 1300], accent_chair: [250, 500], dining_chair: [150, 300], ottoman: [150, 300], coffee_table: [150, 350],
  side_table: [70, 160], nightstand: [120, 250], console: [180, 380], desk: [250, 450], dining_table: [300, 650],
  sideboard: [450, 850], dresser: [400, 750], bookcase: [70, 140], floor_lamp: [90, 200], rug: [180, 500], mirror: [80, 180],
};

// a color for the model when the listing names none, from what it's made of
const MATERIAL_HEX: Record<string, string> = {
  linen: "#cfc6b8", wool: "#d9d2c4", leather: "#7a4e34", jute: "#c2a477", boucle: "#ece5d8", walnut: "#5e4130",
  white_oak: "#c9ad85", reclaimed: "#8a6446", black_steel: "#2b2b2b", brass: "#b8954a", limestone: "#e2dccf",
  plaster: "#e6e1d8", paper: "#f1ece2", terrazzo: "#d8d2c8",
};

const palettesFor = (hex: string) => PALETTES.filter((pl) => pl.hex.some((h) => distance(h, hex) < 9)).map((pl) => pl.id);

const REAL: Product[] = (seed.items as unknown as SeedItem[]).flatMap((it): Product[] => {
  const map = SEED_KIND[it.category];
  if (!map) return [];
  const [category, sub] = map;
  const hb = it.homebody;
  const color = it.color_hex ?? MATERIAL_HEX[hb.material] ?? "#cfc6b8";
  const accentMaterial = hb.accentMaterial ?? (category === "lamp" ? "linen" : hb.material);
  const est = ESTIMATE[sub] ?? null;
  // drop the "Amazon Brand – " prefix and the listing's tail of specs for a name that fits a card
  const name = it.name.replace(/^Amazon\s*Brand\s*[-–]\s*/i, "").split(/,\s/)[0].replace(/\s+/g, " ").trim();
  return [{
    id: it.id, name, maker: it.brand, price: est ? Math.round((est[0] + est[1]) / 2) : 0, category, sub,
    w: hb.w, d: hb.d, h: hb.h, color, accent: MATERIAL_HEX[accentMaterial] ?? color, material: hb.material, accentMaterial,
    families: hb.families_guess, palettes: palettesFor(color),
    variant: sub === "dining_table" && Math.abs(hb.w - hb.d) < 0.1 ? "round" : sub === "mirror" ? "round" : undefined,
    real: {
      brand: it.brand, url: it.product_url, image: it.image_url, colorName: it.color ?? "", credit: REAL_CREDIT,
      dimsIn: { w: it.dims_in.w, d: it.dims_in.d, h: it.dims_in.h }, estimate: est,
    },
  }];
});

export const SAMPLES = (data.products as Product[]).map((p) => ({ ...p, sub: p.sub ?? (p.category === "table" ? "coffee_table" : p.category === "shelf" ? "bookcase" : undefined) }));
export const PRODUCTS: Product[] = [...REAL, ...SAMPLES];
export const PRODUCT = new Map(PRODUCTS.map((p) => [p.id, p]));
export const isReal = (p: Product) => !!p.real;

/** The price as it can honestly be shown: a sample's illustrative price, or a real piece's estimate. */
export function priceLabel(p: Product, short = false): string {
  if (!p.real) return money(p.price);
  if (!p.real.estimate) return short ? "On retailer" : "Price on retailer";
  const [lo, hi] = p.real.estimate;
  return short ? `≈${money((lo + hi) / 2)}` : `Est. ${money(lo)}–${money(hi).slice(1)}`;
}

/** What a design-rule role a product fills (lib/design/rules.ts). */
export function roleOfProduct(p: Product): string {
  if (p.category === "table") return p.sub === "side_table" || p.sub === "nightstand" ? "side_table" : p.sub === "desk" ? "desk" : p.sub === "dining_table" ? "dining_table" : p.sub === "console" ? "storage" : "coffee_table";
  if (p.category === "shelf") return p.sub === "bookcase" || !p.sub ? "shelf" : "storage";
  return p.category;
}

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
