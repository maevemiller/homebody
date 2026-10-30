import library from "./images.json";

// The Taste Builder's visual vocabulary (docs/reference/interior-design/): the
// style families, the palettes as hex swatches, materials and patterns as
// photographs or Poly Haven textures, the room photos with their tags, and the
// scoring model that turns picks, "nevers", "what is it about this one?" chips
// and this-or-that pairs into a style blend (learning-taste-from-images.md §6).
// Pure data and functions, shared by the screen, the live route and the fallback.

export const FAMILIES = {
  warm_minimal: "warm minimal",
  japandi: "Japandi",
  scandinavian: "Scandinavian",
  midcentury: "mid-century",
  minimal: "modern minimal",
  organic: "organic modern",
  wabi_sabi: "wabi-sabi",
  industrial: "industrial",
  traditional: "traditional",
  transitional: "transitional",
  farmhouse: "modern farmhouse",
  french_country: "French country",
  mediterranean: "Mediterranean",
  art_deco: "Art Deco",
  grandmillennial: "grandmillennial",
  coastal: "coastal",
  boho: "bohemian",
  eclectic: "eclectic",
  indian: "Indian",
} as const;
export type Family = keyof typeof FAMILIES;
export const FAMILY_IDS = Object.keys(FAMILIES) as Family[];

// The tree's eight looks (questions.ts LOOKS), so a visual pick answers "look" without asking it
export const LOOK_OF: Record<Family, string> = {
  warm_minimal: "minimal", japandi: "scandi", scandinavian: "scandi", midcentury: "midcentury", minimal: "minimal",
  organic: "organic", wabi_sabi: "organic", industrial: "industrial", traditional: "traditional", transitional: "traditional",
  farmhouse: "traditional", french_country: "traditional", mediterranean: "organic", art_deco: "eclectic",
  grandmillennial: "eclectic", coastal: "scandi", boho: "eclectic", eclectic: "eclectic", indian: "eclectic",
};

export type Value = "light" | "mid" | "dark";
export interface RoomImage {
  id: string;
  alt: string;
  family: Partial<Record<Family, number>>;
  palette: string;
  value: Value;
  temperature: "warm" | "neutral" | "cool";
  density: "sparse" | "edited" | "layered" | "packed";
  line: "straight" | "mixed" | "curved";
  age: "new" | "mixed" | "antique";
  woods: string[];
  metals: string[];
  textiles: string[];
  pattern: "none" | "subtle" | "bold";
  mood: string[];
}

export const ROOMS: RoomImage[] = library.images as RoomImage[];
export const ROOM = new Map(ROOMS.map((r) => [r.id, r]));
export const roomSrc = (id: string) => `/taste/rooms/${id}.jpg`;

// ---- Palettes (palettes-materials-patterns.md §2), rendered 60-30-10 --------------

export interface Palette {
  id: string;
  name: string;
  hex: string[];
  names?: string[];
  families: Family[];
  // what it says for the tree's color question
  color: "light" | "warm" | "bold";
  more?: boolean;
}

export const PALETTES: Palette[] = [
  { id: "warm_neutrals", name: "Warm neutrals", hex: ["#F4EEE3", "#E6DCCB", "#D3C2A6", "#B08D62", "#B8704E", "#3E2C23"], names: ["Warm white", "Oat", "Sand", "Camel", "Clay", "Espresso"], families: ["warm_minimal", "organic", "transitional", "japandi"], color: "warm" },
  { id: "cool_neutrals", name: "Cool neutrals", hex: ["#F6F7F7", "#E3E6E6", "#C9CDCD", "#A3A8A9", "#6E777B", "#33393D"], names: ["Crisp white", "Mist", "Pebble", "Stone", "Slate", "Charcoal"], families: ["minimal", "scandinavian", "transitional", "coastal"], color: "light" },
  { id: "earthy", name: "Earthy", hex: ["#CDBFAE", "#C99A3E", "#C0673F", "#9C4A2A", "#6F6F3C", "#4A3A2C"], names: ["Mushroom", "Ochre", "Terracotta", "Rust", "Olive", "Bark"], families: ["organic", "mediterranean", "boho", "midcentury", "indian"], color: "warm" },
  { id: "jewel", name: "Jewel tones", hex: ["#F2EDE2", "#1F5E4B", "#24427A", "#8E1F35", "#5B3A6E", "#B8913B"], names: ["Ivory", "Emerald", "Sapphire", "Ruby", "Amethyst", "Antique gold"], families: ["art_deco", "eclectic", "traditional", "indian"], color: "bold" },
  { id: "pastels", name: "Soft color", hex: ["#F7F3EE", "#EBC9C1", "#F0DFA8", "#B9C6AC", "#B7CBDD", "#CDBFD9"], names: ["Chalk", "Blush", "Butter", "Sage", "Powder blue", "Lilac"], families: ["scandinavian", "grandmillennial", "french_country", "coastal"], color: "light" },
  { id: "monochrome", name: "Tonal", hex: ["#EFEAE2", "#DDD5C9", "#BFB4A5", "#958979", "#615749", "#2F2A24"], names: ["Bone", "Linen", "Greige", "Taupe", "Umber", "Ink"], families: ["warm_minimal", "japandi", "minimal"], color: "light" },
  { id: "high_contrast", name: "High contrast", hex: ["#FAFAF8", "#141414", "#8C8C8A", "#C2362B", "#2B4FA3", "#B5964A"], names: ["Paper white", "Black", "Ash", "Signal red", "Cobalt", "Brass"], families: ["minimal", "art_deco", "industrial", "farmhouse"], color: "bold" },
  { id: "moody", name: "Moody", hex: ["#2E2B28", "#3D4A44", "#4B3B47", "#6A5642", "#A8875B", "#E9E1D3"], names: ["Soot", "Bottle green", "Aubergine", "Tobacco", "Old gold", "Parchment"], families: ["art_deco", "traditional", "scandinavian"], color: "bold", more: true },
  { id: "coastal", name: "Coastal", hex: ["#F5F3EE", "#E4DCCB", "#C8D7DC", "#8FB2C2", "#3F6A84", "#B7A98E"], names: ["Salt", "Sand", "Sea mist", "Harbor blue", "Deep water", "Driftwood"], families: ["coastal", "mediterranean"], color: "light", more: true },
  { id: "midcentury", name: "Mid-century", hex: ["#F1E8D8", "#D9A441", "#C2662D", "#6B7A3A", "#2F6F73", "#5A3B24"], names: ["Cream", "Mustard", "Burnt orange", "Olive", "Teal", "Teak"], families: ["midcentury"], color: "bold", more: true },
  { id: "indian_festive", name: "Haldi and indigo", hex: ["#F3E9D6", "#E3A72F", "#D9643A", "#C2416B", "#2E3F7A", "#2F5D4A"], names: ["Cream", "Haldi", "Marigold", "Rani pink", "Indigo", "Deep green"], families: ["indian"], color: "bold", more: true },
  { id: "mediterranean", name: "Mediterranean", hex: ["#F6F1E7", "#E5D3B3", "#C7764B", "#7A8450", "#2C5A8C", "#D9B44A"], names: ["Whitewash", "Sandstone", "Terracotta", "Olive", "Cobalt", "Ochre"], families: ["mediterranean"], color: "warm", more: true },
];
export const PALETTE = new Map(PALETTES.map((p) => [p.id, p]));

// ---- Materials (§3–6): Poly Haven CC0 textures where we have one, else a drawn finish ----

export interface Material {
  id: string;
  label: string;
  group: "Wood" | "Stone and plaster" | "Metal" | "Textile";
  texture?: string;
  // a CSS filter that brings a texture to its real color (the CC0 linen is dyed blue)
  filter?: string;
  // how far to zoom a fine weave so it reads at swatch size
  zoom?: string;
  hex: string;
  // metals are drawn as a polished chip; everything else is a photographed CC0 texture
  finish?: "metal";
  families: Family[];
  // the tree's materials choice it answers
  choice: string;
}

export const MATERIALS: Material[] = [
  { id: "white_oak", label: "Natural oak", group: "Wood", texture: "oak_wood_planks", filter: "sepia(.35) saturate(.6) brightness(1.3) contrast(.9)", hex: "#DCC9A8", families: ["warm_minimal", "japandi", "scandinavian", "transitional"], choice: "pale_wood" },
  { id: "walnut", label: "Walnut", group: "Wood", texture: "fine_grained_wood", hex: "#5E4130", families: ["midcentury", "transitional", "warm_minimal"], choice: "warm_wood" },
  { id: "reclaimed", label: "Weathered oak", group: "Wood", texture: "kitchen_wood", hex: "#8C7B68", families: ["farmhouse", "industrial", "wabi_sabi"], choice: "warm_wood" },
  { id: "plaster", label: "Limewash plaster", group: "Stone and plaster", texture: "painted_plaster_wall", filter: "sepia(.35) brightness(1.12) contrast(.9)", hex: "#E7DED1", families: ["warm_minimal", "mediterranean", "wabi_sabi"], choice: "stone" },
  { id: "limestone", label: "Limestone", group: "Stone and plaster", texture: "marble_01", hex: "#D9C7A8", families: ["french_country", "mediterranean", "transitional"], choice: "stone" },
  { id: "terrazzo", label: "Terrazzo", group: "Stone and plaster", texture: "terrazzo", hex: "#D8D2C8", families: ["midcentury", "mediterranean", "organic", "minimal"], choice: "stone" },
  { id: "brick", label: "Old brick", group: "Stone and plaster", texture: "brick_wall_001", hex: "#9A5040", families: ["industrial", "farmhouse"], choice: "stone" },
  { id: "concrete", label: "Concrete", group: "Stone and plaster", texture: "concrete_floor_worn_001", hex: "#A9A7A2", families: ["minimal", "industrial"], choice: "stone" },
  { id: "linen", label: "Washed linen", group: "Textile", texture: "cotton_jersey", filter: "saturate(.45) brightness(1.06) contrast(1.15)", zoom: "340%", hex: "#D9D2C5", families: ["warm_minimal", "coastal", "french_country", "japandi"], choice: "linen" },
  { id: "boucle", label: "Bouclé", group: "Textile", texture: "curly_teddy_natural", hex: "#EFE4D4", families: ["warm_minimal", "organic", "midcentury"], choice: "boucle" },
  { id: "jute", label: "Jute", group: "Textile", texture: "hessian_380", hex: "#B08A5A", families: ["coastal", "organic", "boho"], choice: "rattan" },
  { id: "leather", label: "Worn leather", group: "Textile", texture: "brown_leather", hex: "#8A5A3C", families: ["midcentury", "industrial"], choice: "leather" },
  { id: "brass", label: "Unlacquered brass", group: "Metal", texture: "brass", filter: "saturate(.75) brightness(.86) contrast(1.05)", hex: "#B5964A", families: ["midcentury", "traditional", "indian", "art_deco"], choice: "brass" },
  { id: "black_steel", label: "Black steel", group: "Metal", texture: "black_steel", hex: "#2A2A2A", families: ["industrial", "farmhouse", "minimal"], choice: "black_metal" },
  { id: "nickel", label: "Brushed nickel", group: "Metal", texture: "brushed_nickel", hex: "#A7A9A9", families: ["transitional", "minimal"], choice: "glass" },
];

export const MATERIAL = new Map(MATERIALS.map((m) => [m.id, m]));
export const textureSrc = (t: string) => `/taste/textures/${t}.jpg`;

// ---- Patterns (§7): photographed where we have one, else a drawn tile ----------

export interface Pattern {
  id: string;
  label: string;
  // a photograph (public/taste/patterns) or a CC0 fabric texture (public/taste/textures)
  photo?: string;
  texture?: string;
  families: Family[];
  appetite: "plain" | "little" | "love";
}

export const PATTERNS: Pattern[] = [
  { id: "solid", label: "Plain, with texture", texture: "poly_wool_herringbone", families: ["warm_minimal", "japandi", "minimal"], appetite: "plain" },
  { id: "gingham", label: "Gingham", texture: "gingham_check", families: ["farmhouse", "french_country", "grandmillennial"], appetite: "little" },
  { id: "plaid", label: "Plaid and houndstooth", texture: "wool_boucle", families: ["traditional", "farmhouse", "transitional"], appetite: "little" },
  { id: "geometric", label: "Soft geometric", texture: "faux_fur_geometric", families: ["art_deco", "midcentury", "minimal"], appetite: "little" },
  { id: "block_print", label: "Hand block print", photo: "block-print", families: ["indian", "boho", "french_country"], appetite: "love" },
  { id: "kilim", label: "Kilim and Persian rugs", photo: "kilim", families: ["boho", "eclectic", "traditional"], appetite: "love" },
  { id: "chinoiserie", label: "Chinoiserie", photo: "chinoiserie-fabric", families: ["grandmillennial", "traditional"], appetite: "love" },
  { id: "deco_print", label: "Bold graphic weave", photo: "graphic-fabric", families: ["art_deco", "eclectic", "midcentury"], appetite: "love" },
];
export const PATTERN = new Map(PATTERNS.map((p) => [p.id, p]));
export const patternSrc = (p: string) => `/taste/patterns/${p}.jpg`;

// ---- The sets the conversation can show -------------------------------------

export const SET_IDS = ["rooms", "palettes", "materials", "patterns"] as const;
export type SetId = (typeof SET_IDS)[number];

export interface SetInfo {
  id: SetId;
  title: string;
  like: string;
  never: string;
  chips: string[];
}

// "what is it about this one?" chips, per kind: one tap says which attribute drove the pick
export const SETS: Record<SetId, SetInfo> = {
  rooms: {
    id: "rooms", title: "Rooms", like: "Which of these could you see yourself living in?", never: "And any you'd never live in?",
    chips: ["The colors", "The wood", "The light", "How calm it is", "All the stuff", "The plants", "That sofa", "The textures"],
  },
  palettes: {
    id: "palettes", title: "Color", like: "Which of these feel like you? Pick any.", never: "Any you couldn't live with?",
    chips: ["The warmth", "How soft it is", "The depth", "That accent", "It's grown-up"],
  },
  materials: {
    id: "materials", title: "Materials", like: "Which would you love to have around?", never: "Anything you'd rather not touch every day?",
    chips: ["The texture", "The color", "How it ages", "It feels expensive", "It's practical"],
  },
  patterns: {
    id: "patterns", title: "Pattern", like: "Which of these would you put on a pillow, a rug or a curtain?", never: "Any that are a hard no?",
    chips: ["The scale", "The colors", "It's handmade", "It's playful", "It's quiet"],
  },
};

// The room grid: nine that span the style map, six more on "Show me more"
export const ROOM_GRID = ["scandi-throw", "mcm-navy", "warmmin-plaster", "minimal-view", "industrial-brick", "boho-sage", "traditional-fireplace", "med-arch", "eclectic-gallery"];
export const ROOM_MORE = ["japandi-lattice", "deco-curve", "coastal-airy", "farm-beams", "grandmil-drapes", "indian-living"];
// photos that aren't whole rooms (a pouf against wallpaper): kept tagged, never shown as a room
const NOT_ROOMS = ["grandmil-wallpaper"];

// The room grid for this person: up to five that echo what they've said (their words and the
// style evidence so far), then contrasts from across the map, so the grid still splits taste.
const MOOD_WORDS = ["calm", "cozy", "bright", "moody", "elegant", "playful", "grounded", "energizing"];
export function roomGrid(t: { styles: Partial<Record<Family, number>> }, said: string): { grid: string[]; more: string[] } {
  const text = said.toLowerCase();
  // "a cave", "a den", "a nest" mean moody rooms as surely as "dark" does
  const dark = /\b(dark|moody|dim|deep|rich|hotel bar|candle ?lit|low light|lamps?|cosy|cozy|night|cave|den|nest|snug|burrow|womb|cocoon|hole up)\b/.test(text);
  const light = /\b(light|bright|airy|white|fresh|sunny|breezy)\b/.test(text);
  const moods = MOOD_WORDS.filter((m) => text.includes(m === "cozy" ? "coz" : m));
  const score = (r: RoomImage) =>
    Object.entries(r.family).reduce((n, [f, w]) => n + (w as number) * (t.styles[f as Family] ?? 0), 0) +
    0.7 * r.mood.filter((m) => moods.includes(m)).length +
    (dark && r.value !== "light" ? 1.2 : 0) + (dark && r.mood.includes("moody") ? 0.6 : 0) + (light && r.value === "light" ? 0.5 : 0);
  const pool = [...ROOM_GRID, ...ROOM_MORE, ...ROOMS.map((r) => r.id).filter((id) => !ROOM_GRID.includes(id) && !ROOM_MORE.includes(id))].filter((id) => !NOT_ROOMS.includes(id));
  const ranked = pool.map((id) => ({ id, n: score(ROOM.get(id)!) })).filter((x) => x.n > 0.6).sort((a, b) => b.n - a.n);
  const echo: string[] = [];
  const families = new Set<string>();
  for (const x of ranked) {
    const top = Object.entries(ROOM.get(x.id)!.family).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
    if (families.has(top) && echo.length >= 2) continue;
    families.add(top);
    echo.push(x.id);
    if (echo.length === 5) break;
  }
  const grid = [...echo, ...ROOM_GRID.filter((id) => !echo.includes(id))].slice(0, 9);
  return { grid, more: [...ROOM_GRID, ...ROOM_MORE].filter((id) => !grid.includes(id)).slice(0, 6) };
}

// ---- The taste state the visual picks build ----------------------------------

export interface Picks {
  liked: string[];
  never: string[];
}

export interface TasteState {
  // family → score; a style blend once there's enough signal
  styles: Partial<Record<Family, number>>;
  rooms: Picks;
  palettes: Picks;
  materials: Picks;
  patterns: Picks;
  // "what is it about this one?": the item and the chips tapped
  chips: { set: SetId; item: string; chips: string[] }[];
  // the sets done (or skipped), so the agent doesn't show one twice
  shown: SetId[];
  // pairs answered in an "I'm not sure" exploration
  pairs: { a: string; b: string; pick: "a" | "b" | "both" | "neither" }[];
  value?: Partial<Record<Value, number>>;
  // sets they explored and still couldn't decide: nothing is recorded for these
  undecided?: SetId[];
  // families they said aren't them (a read-back correction): hidden from the blend
  excluded?: Family[];
}

export const EMPTY_TASTE: TasteState = {
  styles: {}, rooms: { liked: [], never: [] }, palettes: { liked: [], never: [] }, materials: { liked: [], never: [] },
  patterns: { liked: [], never: [] }, chips: [], shown: [], pairs: [],
};

const bump = (s: TasteState["styles"], weights: Partial<Record<Family, number>>, by: number) => {
  const out = { ...s };
  for (const [f, w] of Object.entries(weights) as [Family, number][]) out[f] = (out[f] ?? 0) + w * by;
  return out;
};
const even = (fs: Family[], w = 1): Partial<Record<Family, number>> => Object.fromEntries(fs.map((f) => [f, w / fs.length]));

// The families an item in a set points to
export function familiesOf(set: SetId, item: string): Partial<Record<Family, number>> {
  if (set === "rooms") return ROOM.get(item)?.family ?? {};
  if (set === "palettes") return even(PALETTE.get(item)?.families ?? [], 0.6);
  if (set === "materials") return even(MATERIAL.get(item)?.families ?? [], 0.5);
  return even(PATTERN.get(item)?.families ?? [], 0.5);
}

// Scoring (learning-taste-from-images.md §6.2): like +1, never −1.5, a chip +0.5 on the item's
// families (the chip's attribute is kept separately), pair winner +1 and loser −0.5
export function scorePicks(t: TasteState, set: SetId, picks: Picks): TasteState {
  let styles = t.styles;
  for (const id of picks.liked) styles = bump(styles, familiesOf(set, id), 1);
  for (const id of picks.never) styles = bump(styles, familiesOf(set, id), -1.5);
  let value = t.value ?? {};
  if (set === "rooms")
    for (const id of picks.liked) {
      const v = ROOM.get(id)?.value;
      if (v) value = { ...value, [v]: (value[v] ?? 0) + 1 };
    }
  return { ...t, styles, value, [set]: picks, shown: [...new Set([...t.shown, set])] };
}

export function scoreChips(t: TasteState, set: SetId, item: string, chips: string[]): TasteState {
  const rest = t.chips.filter((c) => !(c.set === set && c.item === item));
  return { ...t, styles: chips.length ? bump(t.styles, familiesOf(set, item), 0.5) : t.styles, chips: chips.length ? [...rest, { set, item, chips }] : rest };
}

// Words they said, mapped to families at a lower weight (the model's inferences come in here too)
export function scoreWords(t: TasteState, styles: { family: string; weight: number }[]): TasteState {
  let s = t.styles;
  for (const x of styles) if (x.family in FAMILIES) s = bump(s, { [x.family as Family]: 1 }, Math.max(-1, Math.min(1, x.weight)) * 0.6);
  return { ...t, styles: s };
}

// Normalized to the top two or three, rounded to friendly numbers ("60% warm minimal, 30% mid-century…")
export function blend(t: TasteState): { family: Family; label: string; pct: number }[] {
  const ranked = (Object.entries(t.styles) as [Family, number][]).filter(([f, v]) => v > 0.25 && !t.excluded?.includes(f)).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const total = ranked.reduce((n, [, v]) => n + v, 0);
  if (!total) return [];
  const out = ranked.map(([family, v]) => ({ family, label: FAMILIES[family], pct: Math.round((v / total) * 10) * 10 })).filter((x) => x.pct >= 10);
  // the rounding never adds past 100
  const sum = out.reduce((n, x) => n + x.pct, 0);
  if (out.length && sum !== 100) out[0].pct += 100 - sum;
  return out;
}

// What each family adds when it's the second reference in a blend: what it puts in the room, concretely
const ACCENT: Record<Family, string> = {
  // forms and references, not materials: a material is in the brief only if she picked or said it
  warm_minimal: "warm-minimal restraint", japandi: "Japandi low, quiet lines", scandinavian: "Scandinavian simplicity",
  midcentury: "mid-century tapered legs and low profiles", minimal: "flat-front, unornamented pieces", organic: "organic modern curves",
  wabi_sabi: "wabi-sabi handmade surfaces", industrial: "industrial utility", traditional: "traditional turned legs and rolled arms",
  transitional: "transitional tailored upholstery", farmhouse: "farmhouse plain, sturdy forms", french_country: "French country carved details",
  mediterranean: "Mediterranean arches and handmade surfaces", art_deco: "Art Deco curves and geometry", grandmillennial: "grandmillennial skirted upholstery",
  coastal: "coastal light, airy forms", boho: "bohemian layering", eclectic: "eclectic mixed periods", indian: "Indian craft details",
};

// The blend as she saw it: only families from rooms she actually chose, so the page never names a
// style she wasn't shown ("a little Deco glamour") or reads out the hidden profile's percentages
export function seenBlend(t: TasteState): ReturnType<typeof blend> {
  const seen = new Set(t.rooms.liked.flatMap((id) => Object.entries(ROOM.get(id)?.family ?? {}).filter(([, w]) => (w as number) >= 0.3).map(([f]) => f)));
  return blend({ ...t, styles: Object.fromEntries(Object.entries(t.styles).filter(([f]) => seen.has(f))) });
}

// A designer's name for the blend, by reference: "Warm minimal, with mid-century walnut and tapered legs"
export function blendName(b: ReturnType<typeof blend>): string {
  if (!b.length) return "";
  const [first, second, third] = b;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (!second || first.pct >= 80) return cap(first.label);
  return `${cap(first.label)}, with ${ACCENT[second.family]}${third && third.pct >= 20 ? `; some ${ACCENT[third.family]}` : ""}`;
}

// What the visual picks answer in the tree, so nothing is asked twice
export function treeAnswers(t: TasteState): { id: string; value: string | string[] }[] {
  const out: { id: string; value: string | string[] }[] = [];
  const top = blend(t)[0];
  if (top && t.rooms.liked.length && !t.undecided?.includes("rooms")) out.push({ id: "look", value: LOOK_OF[top.family] });
  const pal = t.palettes.liked.map((id) => PALETTE.get(id)).filter(Boolean) as Palette[];
  if (pal.length) {
    const votes = pal.reduce<Record<string, number>>((v, p) => ({ ...v, [p.color]: (v[p.color] ?? 0) + 1 }), {});
    out.push({ id: "color", value: Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0] });
  }
  const mats = [...new Set(t.materials.liked.map((id) => MATERIAL.get(id)?.choice).filter(Boolean) as string[])];
  if (mats.length) out.push({ id: "materials", value: mats });
  // pattern appetite only from patterns they actually chose; "none liked" or "not sure" leaves it open
  const likedPatterns = t.patterns.liked.map((id) => PATTERN.get(id)!).filter(Boolean);
  if (likedPatterns.length && !t.undecided?.includes("patterns")) {
    const appetite = likedPatterns.every((p) => p.appetite === "plain") ? "plain" : likedPatterns.some((p) => p.appetite === "love") && likedPatterns.length > 1 ? "love" : "little";
    out.push({ id: "pattern", value: appetite });
  }
  const nevers = [
    ...t.rooms.never.map((id) => ROOM.get(id)?.alt.toLowerCase()),
    ...t.palettes.never.map((id) => PALETTE.get(id)?.name.toLowerCase()),
    ...t.materials.never.map((id) => MATERIAL.get(id)?.label.toLowerCase()),
    ...t.patterns.never.map((id) => PATTERN.get(id)?.label.toLowerCase()),
  ].filter(Boolean) as string[];
  if (nevers.length && (t.palettes.never.length || t.materials.never.length || t.patterns.never.length)) out.push({ id: "avoid", value: nevers.slice(0, 4).join("; ") });
  return out;
}

// ---- "I'm not sure": the adaptive this-or-that (learning-taste-from-images.md §3, §6.3) ----

export interface Pair {
  a: string;
  b: string;
  // what it splits, said under the pair
  axis: string;
}

// Room pairs chosen to split neighbors (style-families.md confusions) or an axis (§8 this-or-thats)
export const PAIRS: Pair[] = [
  { a: "scandi-linen", b: "minimal-stone", axis: "Bright and airy, or quiet and grounded" },
  { a: "eclectic-art", b: "warmmin-plaster", axis: "Collected walls, or clear surfaces" },
  { a: "industrial-loft", b: "coastal-airy", axis: "Deep and moody, or light and breezy" },
  { a: "mcm-credenza", b: "japandi-lattice", axis: "Warm teak, or pale and low" },
  { a: "deco-curve", b: "minimal-sectional", axis: "Soft curves, or straight lines" },
  { a: "traditional-drapes", b: "transitional-coffered", axis: "Ornate, or tailored" },
  { a: "boho-pendants", b: "organic-kitchen", axis: "Layered and global, or edited and natural" },
  { a: "grandmil-drapes", b: "scandi-sage", axis: "Pattern and history, or calm and new" },
  { a: "farm-beams", b: "industrial-brick", axis: "Rustic and homey, or raw and urban" },
  { a: "med-bench", b: "warmmin-round", axis: "Sun-baked plaster, or soft and tonal" },
  { a: "deco-moody", b: "mcm-navy", axis: "Glamorous, or easygoing" },
  { a: "indian-living", b: "boho-color", axis: "Heritage and brass, or free-spirited color" },
  { a: "scandi-round", b: "minimal-view", axis: "Cozy and lived-in, or sleek and gallery-like" },
  { a: "mcm-orange", b: "transitional-white", axis: "Bold color, or soft neutrals" },
  { a: "med-hall", b: "minimal-grey", axis: "Old pieces with a story, or new and crisp" },
];

export const EXPLORE_MIN = 6;
export const EXPLORE_MAX = 12;

const leaders = (s: TasteState["styles"]) => (Object.entries(s) as [Family, number][]).sort((a, b) => b[1] - a[1]);

// The next pair: the unused one that best separates the current top two families; with nothing
// known yet, the broadest axes first (light/dark, more/less)
export function nextPair(t: TasteState, asked: Pair[]): Pair | null {
  const left = PAIRS.filter((p) => !asked.some((q) => q.a === p.a && q.b === p.b));
  if (!left.length) return null;
  const [f1, f2] = leaders(t.styles).map(([f]) => f);
  if (!f1 || asked.length < 2) return left[0];
  const w = (id: string, f?: Family) => (f ? ROOM.get(id)?.family[f] ?? 0 : 0);
  const split = (p: Pair) => Math.abs(w(p.a, f1) - w(p.a, f2) - (w(p.b, f1) - w(p.b, f2))) + 0.3 * (w(p.a, f1) + w(p.b, f1));
  return [...left].sort((x, y) => split(y) - split(x))[0];
}

export function scorePair(t: TasteState, p: Pair, pick: "a" | "b" | "both" | "neither"): TasteState {
  const A = ROOM.get(p.a)!.family;
  const B = ROOM.get(p.b)!.family;
  let styles = t.styles;
  if (pick === "a") styles = bump(bump(styles, A, 1), B, -0.5);
  if (pick === "b") styles = bump(bump(styles, B, 1), A, -0.5);
  if (pick === "both") styles = bump(bump(styles, A, 0.5), B, 0.5);
  if (pick === "neither") styles = bump(bump(styles, A, -0.5), B, -0.5);
  return { ...t, styles, pairs: [...t.pairs, { a: p.a, b: p.b, pick }] };
}

// Stop when the leader is clear and the last three agreed, or at the cap
export function exploreDone(t: TasteState, answered: { pick: string; winner?: Family }[]): boolean {
  if (answered.length >= EXPLORE_MAX) return true;
  if (answered.length < EXPLORE_MIN) return false;
  const [[, a] = [null, 0], [, b] = [null, 0]] = leaders(t.styles);
  const last = answered.slice(-3).map((x) => x.winner);
  const agree = last.length === 3 && last.every((w) => w && w === last[0]);
  return a > 0 && (a >= 1.6 * Math.max(b, 0.01) || agree);
}

export const winnerOf = (p: Pair, pick: string): Family | undefined => {
  const id = pick === "a" ? p.a : pick === "b" ? p.b : null;
  if (!id) return undefined;
  return leaders(ROOM.get(id)!.family as TasteState["styles"])[0]?.[0];
};

// ---- "I'm not sure" inside one set: a this-or-that among that set's own items ----------
// King of the hill: the one they keep choosing stays, each challenger is the item least like it,
// so every pair earns its decision. It stops when one has held three rounds, or at the cap.

export const setItems = (set: SetId): string[] =>
  set === "rooms" ? ROOMS.map((r) => r.id) : set === "palettes" ? PALETTES.map((p) => p.id) : set === "materials" ? MATERIALS.map((m) => m.id) : PATTERNS.map((p) => p.id);

const overlap = (set: SetId, a: string, b: string) => {
  const A = familiesOf(set, a);
  const B = familiesOf(set, b);
  return Object.keys(A).filter((f) => f in B).length;
};
const fitOf = (t: TasteState, set: SetId, id: string) =>
  Object.entries(familiesOf(set, id)).reduce((n, [f, w]) => n + (w as number) * (t.styles[f as Family] ?? 0), 0);

// The opening pair: what their taste so far points to, against its opposite
export function firstInSet(t: TasteState, set: SetId): [string, string] {
  const items = setItems(set).filter((id) => !(set === "palettes" && PALETTE.get(id)?.more));
  const a = [...items].sort((x, y) => fitOf(t, set, y) - fitOf(t, set, x))[0];
  const b = challenger(set, a, [a], t)!;
  return [a, b];
}

export function challenger(set: SetId, champ: string, seen: string[], t: TasteState): string | null {
  const left = setItems(set).filter((id) => !seen.includes(id));
  if (!left.length) return null;
  return [...left].sort((x, y) => overlap(set, champ, x) - overlap(set, champ, y) || fitOf(t, set, y) - fitOf(t, set, x))[0];
}

export const SET_EXPLORE_MAX = 7;

// The palette a person's picks point to, for the dossier strip: their first liked palette,
// else the top family's natural palette
// Only one they chose: nothing goes on the page before they've seen palettes and picked one
export function paletteFor(t: TasteState): Palette | null {
  return t.palettes.liked.length ? PALETTE.get(t.palettes.liked[0]) ?? null : null;
}

// What each material "never" rules out in a room photo's tags
const MATERIAL_TAG: Record<string, (r: RoomImage) => boolean> = {
  white_oak: (r) => r.woods.includes("white_oak"), walnut: (r) => r.woods.includes("walnut"), reclaimed: (r) => r.woods.includes("reclaimed"),
  brick: (r) => /brick/i.test(r.alt), concrete: (r) => /concrete/i.test(r.alt), plaster: (r) => /plaster/i.test(r.alt),
  linen: (r) => r.textiles.includes("linen"), boucle: (r) => r.textiles.includes("boucle"), jute: (r) => r.textiles.includes("jute"),
  leather: (r) => r.textiles.includes("leather"), brass: (r) => r.metals.includes("brass"), black_steel: (r) => r.metals.includes("black_steel"),
  nickel: (r) => r.metals.includes("nickel"), terrazzo: () => false, limestone: () => false,
};

// Whether a room photo contradicts anything they said no to: a room, palette or material they
// marked never, a style they said isn't them, or a "never" in their own words ("glossy", "mid-century")
export function clashes(t: TasteState, id: string, neverWords: string[] = []): boolean {
  const r = ROOM.get(id);
  if (!r) return true;
  if (t.rooms.never.includes(id) || t.palettes.never.includes(r.palette)) return true;
  if (t.materials.never.some((m) => MATERIAL_TAG[m]?.(r))) return true;
  const top = Object.entries(r.family).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] as Family;
  if (t.excluded?.includes(top)) return true;
  const said = `${r.alt} ${Object.keys(r.family).map((f) => FAMILIES[f as Family]).join(" ")} ${r.mood.join(" ")} ${r.metals.join(" ")} ${r.textiles.join(" ")}`.toLowerCase();
  return neverWords.some((w) => w.toLowerCase().split(/[^a-z-]+/).filter((x) => x.length > 3 && !["anything", "nothing", "never", "with", "that", "this", "only", "sofa"].includes(x)).some((x) => said.includes(x)));
}

// The hero image: the liked room that best fits the blend and contradicts none of their nevers
// the room she reacted to most: the one she said the most about ("what is it about this one?"), then the
// first she picked; the style fit only breaks ties
export function heroFor(t: TasteState, neverWords: string[] = []): string | undefined {
  const fit = (id: string) => Object.entries(ROOM.get(id)?.family ?? {}).reduce((n, [f, w]) => n + (w as number) * (t.styles[f as Family] ?? 0), 0);
  const said = (id: string) => t.chips.filter((c) => c.set === "rooms" && c.item === id).reduce((n, c) => n + c.chips.length, 0);
  const order = (id: string) => t.rooms.liked.indexOf(id);
  return [...t.rooms.liked].filter((id) => !clashes(t, id, neverWords)).sort((a, b) => said(b) - said(a) || order(a) - order(b) || fit(b) - fit(a))[0];
}

// A one-line read of the taste picks, for the agent: what they chose, in words
export function describeTaste(t: TasteState): string {
  const parts: string[] = [];
  const b = blend(t);
  if (b.length) parts.push(`Style blend so far: ${b.map((x) => `${x.pct}% ${x.label}`).join(", ")}`);
  const say = (label: string, ids: string[], name: (id: string) => string | undefined) => ids.length && parts.push(`${label}: ${ids.map(name).filter(Boolean).join("; ")}`);
  say("Rooms they could live in", t.rooms.liked, (id) => ROOM.get(id)?.alt);
  say("Rooms they'd never live in", t.rooms.never, (id) => ROOM.get(id)?.alt);
  say("Palettes they liked", t.palettes.liked, (id) => PALETTE.get(id)?.name);
  say("Palettes they couldn't live with", t.palettes.never, (id) => PALETTE.get(id)?.name);
  say("Materials they love", t.materials.liked, (id) => MATERIAL.get(id)?.label);
  say("Materials they'd rather not", t.materials.never, (id) => MATERIAL.get(id)?.label);
  say("Patterns they liked", t.patterns.liked, (id) => PATTERN.get(id)?.label);
  say("Patterns that are a hard no", t.patterns.never, (id) => PATTERN.get(id)?.label);
  for (const c of t.chips) {
    const name = c.set === "rooms" ? ROOM.get(c.item)?.alt : c.set === "palettes" ? PALETTE.get(c.item)?.name : c.set === "materials" ? MATERIAL.get(c.item)?.label : PATTERN.get(c.item)?.label;
    parts.push(`What drew them to "${name}": ${c.chips.join(", ").toLowerCase()}`);
  }
  if (t.pairs.length) parts.push(`Answered ${t.pairs.length} this-or-that pairs`);
  if (t.undecided?.length) parts.push(`Still undecided (record nothing for these): ${t.undecided.join(", ")}`);
  if (t.excluded?.length) parts.push(`Styles they said aren't them (keep out): ${t.excluded.map((f) => FAMILIES[f]).join(", ")}`);
  return parts.join("\n");
}
