import { FAMILIES, type Family } from "@/lib/taste/visual";
import { distance, hexToLab, hueFamily, isNeutral, undertone } from "@/lib/design/color";
import { PRODUCTS, roleOfProduct, twinOf, type Product } from "./catalog";
import { rank, type RankCtx } from "./rank";

// "Change this": what she'd like different about one piece, as parameter chips (budget, color, style,
// material, size, shape) plus her own words, turned into 3–5 alternatives. Words are read here first, for
// free; only what this can't read goes to the small model route (app/api/play/interpret).

export interface Ask {
  budget?: "less" | "more";
  color?: "lighter" | "darker" | "warmer" | "cooler" | "bolder" | "quieter";
  // a specific color she named ("cobalt", "sage")
  hex?: string;
  colorWord?: string;
  style?: Family;
  material?: string;
  size?: "smaller" | "larger";
  shape?: "rounder" | "straighter";
  // anything left over, as she said it
  text?: string;
}

export const CHIP_GROUPS = ["budget", "color", "style", "material", "size", "shape"] as const;
export type ChipGroup = (typeof CHIP_GROUPS)[number];

export const CHIPS: Record<ChipGroup, { label: string; options: { value: string; label: string }[] }> = {
  budget: { label: "Budget", options: [{ value: "less", label: "Spend less" }, { value: "more", label: "Worth more" }] },
  color: {
    label: "Color",
    options: [
      { value: "lighter", label: "Lighter" }, { value: "darker", label: "Darker" }, { value: "warmer", label: "Warmer" },
      { value: "cooler", label: "Cooler" }, { value: "bolder", label: "More color" }, { value: "quieter", label: "Quieter" },
    ],
  },
  style: {
    label: "Style",
    options: (["warm_minimal", "midcentury", "japandi", "organic", "industrial", "traditional", "transitional", "farmhouse"] as Family[]).map((f) => ({ value: f, label: cap(FAMILIES[f]) })),
  },
  material: {
    label: "Material",
    options: [
      { value: "white_oak", label: "Pale wood" }, { value: "walnut", label: "Walnut" }, { value: "linen", label: "Linen" },
      { value: "boucle", label: "Bouclé" }, { value: "leather", label: "Leather" }, { value: "wool", label: "Wool" },
      { value: "jute", label: "Jute" }, { value: "brass", label: "Brass" }, { value: "black_steel", label: "Black metal" },
      { value: "limestone", label: "Stone" },
    ],
  },
  size: { label: "Size", options: [{ value: "smaller", label: "Smaller" }, { value: "larger", label: "Larger" }] },
  shape: { label: "Shape", options: [{ value: "rounder", label: "Rounder" }, { value: "straighter", label: "More tailored" }] },
};

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// named colors she might say, as hex (a small, plain list; Wada does the pairing)
export const COLOR_WORDS: Record<string, string> = {
  cobalt: "#2b4fa3", navy: "#1f2f4f", blue: "#3f6a9a", "powder blue": "#b7cbdd", teal: "#2f6f73", green: "#4f6b47",
  sage: "#9cae8f", olive: "#6f6f3c", emerald: "#1f5e4b", "bottle green": "#3d4a44", rust: "#9c4a2a", terracotta: "#c0673f",
  orange: "#c2662d", ochre: "#c99a3e", mustard: "#d9a441", yellow: "#e3c35a", red: "#a8322b", burgundy: "#6d2232",
  pink: "#e3a6b0", blush: "#ebc9c1", purple: "#5b3a6e", lilac: "#cdbfd9", brown: "#6a4a33", camel: "#b08d62",
  tan: "#c2a477", cream: "#efe6d2", ivory: "#f2ede2", white: "#f6f5f1", black: "#1e1e1e", charcoal: "#33393d",
  grey: "#9a9a96", gray: "#9a9a96", beige: "#d8cbb4", oat: "#e6dccb",
};

const MATERIAL_WORDS: [RegExp, string][] = [
  [/\b(pale|light|blond|natural) (wood|oak)|\boak\b/, "white_oak"], [/\bwalnut|dark wood\b/, "walnut"], [/\blinen\b/, "linen"],
  [/\bbouc?l[eé]\b/, "boucle"], [/\bleather\b/, "leather"], [/\bwool\b/, "wool"], [/\bjute|sisal|rattan|cane|wicker\b/, "jute"],
  [/\bbrass|gold\b/, "brass"], [/\b(black )?(metal|steel|iron)\b/, "black_steel"], [/\bstone|marble|travertine|plaster\b/, "limestone"],
  [/\breclaimed|rustic\b/, "reclaimed"], [/\bpaper\b/, "paper"], [/\bvelvet\b/, "linen"],
];

/** Her words, read for free: whatever this can't place stays in `text` for the model route. */
export function readWords(said: string): { ask: Ask; understood: string[]; rest: string } {
  const t = ` ${said.toLowerCase()} `;
  const ask: Ask = {};
  const understood: string[] = [];
  const hit = (re: RegExp) => re.test(t);
  if (hit(/\b(cheaper|less expensive|too (expensive|pricey)|budget|save|cost less|lower price)\b/)) { ask.budget = "less"; understood.push("spend less"); }
  else if (hit(/\b(nicer|better quality|investment|splurge|higher end|more premium)\b/)) { ask.budget = "more"; understood.push("worth more"); }
  if (hit(/\b(smaller|too big|too large|compact|narrower|tiny)\b/)) { ask.size = "smaller"; understood.push("smaller"); }
  else if (hit(/\b(bigger|larger|too small|wider|longer|deeper)\b/)) { ask.size = "larger"; understood.push("larger"); }
  if (hit(/\b(round|rounder|curv|soft(er)? edges|organic shape)/)) { ask.shape = "rounder"; understood.push("rounder"); }
  else if (hit(/\b(square|boxy|tailored|straight|crisp|clean lines)\b/)) { ask.shape = "straighter"; understood.push("more tailored"); }
  if (hit(/\b(lighter|paler|brighter)\b/)) { ask.color = "lighter"; understood.push("lighter"); }
  else if (hit(/\b(darker|deeper|moodier)\b/)) { ask.color = "darker"; understood.push("darker"); }
  else if (hit(/\b(warmer)\b/)) { ask.color = "warmer"; understood.push("warmer"); }
  else if (hit(/\b(cooler|colder)\b/)) { ask.color = "cooler"; understood.push("cooler"); }
  else if (hit(/\b(more color|colou?rful|bolder|brighter colou?r|pop)\b/)) { ask.color = "bolder"; understood.push("more color"); }
  else if (hit(/\b(quieter|calmer|neutral|less loud|subtler)\b/)) { ask.color = "quieter"; understood.push("quieter"); }
  for (const w of Object.keys(COLOR_WORDS).sort((a, b) => b.length - a.length)) {
    if (new RegExp(`\\b${w}\\b`).test(t)) { ask.hex = COLOR_WORDS[w]; ask.colorWord = w; understood.push(w); break; }
  }
  for (const [re, m] of MATERIAL_WORDS) if (re.test(t)) { ask.material = m; understood.push(m.replace(/_/g, " ")); break; }
  for (const [id, label] of Object.entries(FAMILIES) as [Family, string][]) {
    const words = [label.toLowerCase(), id.replace(/_/g, " "), ...(id === "midcentury" ? ["mid century", "retro", "60s"] : []), ...(id === "industrial" ? ["loft"] : []), ...(id === "farmhouse" ? ["farmhouse", "country"] : [])];
    if (words.some((w) => t.includes(w))) { ask.style = id; understood.push(label); break; }
  }
  // what's left after the words it understood
  let rest = said;
  for (const w of [/\b(cheaper|less expensive|smaller|bigger|larger|round(er)?|lighter|darker|warmer|cooler)\b/gi, ...Object.keys(COLOR_WORDS).map((w) => new RegExp(`\\b${w}\\b`, "gi"))]) rest = rest.replace(w, "");
  rest = rest.replace(/\b(i'?d|i would|like|want|it|something|maybe|please|a|an|the|more|less|bit|little|and|in|with|to|be|this|that|one)\b/gi, "").replace(/[^a-z]+/gi, " ").trim();
  return { ask, understood, rest: rest.split(/\s+/).filter((w) => w.length > 2).length >= 2 ? said : "" };
}

/** Is there anything in it to act on? */
export const asksSomething = (a: Ask) => !!(a.budget || a.color || a.hex || a.style || a.material || a.size || a.shape);

// the same job in the room: coffee tables with coffee tables (ottomans count), side tables with side tables
const jobOf = (p: Product) => {
  const r = roleOfProduct(p);
  return p.category === "chair" ? (p.sub === "dining_chair" ? "dining_chair" : "chair") : r;
};
const round = (p: Product) => p.variant === "oval" || p.variant === "round" || p.variant === "lantern" || (p.look ?? "").includes("boucle") || (p.category !== "rug" && Math.abs(p.w - p.d) < 0.05 && p.category !== "lamp");

/** How well a candidate answers each part of the ask: 1 a full yes, 0 a no. */
function answers(p: Product, current: { price: number; color: string; w: number; material: string }, a: Ask): { met: number; asked: number } {
  let met = 0, asked = 0;
  const L = (h: string) => hexToLab(h)[0];
  const check = (ok: boolean) => { asked++; if (ok) met++; };
  if (a.budget) check(a.budget === "less" ? p.price < current.price * 0.9 : p.price > current.price * 1.1);
  if (a.size) check(a.size === "smaller" ? p.w < current.w * 0.94 : p.w > current.w * 1.06);
  if (a.shape) check(a.shape === "rounder" ? round(p) : !round(p));
  if (a.material) check(p.material === a.material || p.accentMaterial === a.material);
  if (a.style) check(p.families.includes(a.style));
  if (a.hex) check(distance(p.color, a.hex) < 18 || (!!p.accent && distance(p.accent, a.hex) < 14) || (!!hueFamily(a.hex) && hueFamily(p.color) === hueFamily(a.hex)));
  if (a.color) {
    const c = current.color;
    check(
      a.color === "lighter" ? L(p.color) > L(c) + 8
        : a.color === "darker" ? L(p.color) < L(c) - 8
          : a.color === "warmer" ? undertone(p.color) === "warm" && undertone(c) !== "warm" || hexToLab(p.color)[2] > hexToLab(c)[2] + 6
            : a.color === "cooler" ? hexToLab(p.color)[2] < hexToLab(c)[2] - 6
              : a.color === "bolder" ? !isNeutral(p.color)
                : isNeutral(p.color),
    );
  }
  return { met, asked };
}

export interface Alt {
  product: Product;
  // a short line on why it's offered
  why: string;
  // it meets everything asked (false: the closest there is)
  full: boolean;
}

/**
 * 3–5 alternatives to a piece. `current` is the product shown, or a stand-in built from one of theirs.
 * With nothing asked, it leads with the same look for less, then the best-ranked others of the same job.
 */
export function alternativesFor(
  current: Product | { id?: string; category: Product["category"]; sub?: string; price: number; color: string; w: number; material: string },
  ask: Ask,
  ctx: RankCtx,
  exclude: Set<string> = new Set(),
): Alt[] {
  const job = "id" in current && current.id && "families" in current ? jobOf(current as Product) : current.category === "table" ? (current.sub === "side_table" ? "side_table" : "coffee_table") : current.category;
  const pool = PRODUCTS.filter((p) => p.id !== current.id && !exclude.has(p.id) && jobOf(p) === job && rank(p, ctx) > -50);
  const scored = pool.map((p) => {
    const { met, asked } = answers(p, current, ask);
    return { p, met, asked, score: rank(p, ctx) + met * 4 - (asked - met) * 2 };
  });
  scored.sort((a, b) => b.score - a.score);
  const out: Alt[] = [];
  const add = (p: Product, why: string, full: boolean) => {
    if (out.length < 5 && !out.some((o) => o.product.id === p.id)) out.push({ product: p, why, full });
  };
  if (!asksSomething(ask)) {
    const twin = "families" in current ? twinOf(current as Product) : undefined;
    if (twin && twin.price < current.price) add(twin, "Same look for less", true);
  }
  const full = scored.filter((s) => s.asked === 0 || s.met === s.asked);
  const near = scored.filter((s) => s.asked > 0 && s.met < s.asked && s.met > 0);
  for (const s of full) add(s.p, whyLine(s.p, current, ask), true);
  // fewer than three that meet everything: the closest, said as such
  if (out.length < 3) for (const s of near) add(s.p, `Closest: ${whyLine(s.p, current, ask)}`, false);
  if (out.length < 3) for (const s of scored) add(s.p, whyLine(s.p, current, ask), false);
  return out.slice(0, Math.max(3, Math.min(5, out.length)));
}

function whyLine(p: Product, current: { price: number; w: number; color: string }, a: Ask): string {
  const bits: string[] = [];
  if (a.budget && p.price !== current.price) bits.push(p.price < current.price ? "costs less" : "a step up in make");
  if (a.size) bits.push(`${Math.round(Math.abs(p.w - current.w) * 100)} cm ${p.w < current.w ? "narrower" : "wider"}`);
  if (a.material) bits.push(p.material.replace(/_/g, " "));
  if (a.style) bits.push(FAMILIES[a.style]);
  if (a.hex || a.color) bits.push(p.real?.colorName?.toLowerCase() || (isNeutral(p.color) ? "a quiet neutral" : `${hueFamily(p.color)}`));
  if (a.shape) bits.push(a.shape === "rounder" ? "softer shape" : "tailored lines");
  if (!bits.length) {
    const color = p.real?.colorName?.toLowerCase() || (isNeutral(p.color) ? "neutral" : hueFamily(p.color) ?? "");
    bits.push(`${color ? `${color} ` : ""}${p.material.replace(/_/g, " ")}${p.accentMaterial && p.accentMaterial !== p.material ? ` and ${p.accentMaterial.replace(/_/g, " ")}` : ""}`);
  }
  return cap(bits.join(", "));
}
