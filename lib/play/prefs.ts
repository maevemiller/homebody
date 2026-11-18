import { readSaved } from "@/lib/taste/saved";
import type { Concept } from "@/lib/taste/session";
import type { TasteState } from "@/lib/taste/visual";
import { hueFamily } from "@/lib/design/color";
import type { Product } from "./catalog";

// What Plug & Play learns from her own taps, kept beside (not inside) the Taste Builder profile: likes and
// dislikes on pieces, swipes in "Teach me your taste", and the attribute weights they add up to. Ranking reads
// this with the brief and the visual picks. Key: homebody-play-prefs. Also: reading the confirmed brief and the
// shopping preferences out of homebody-taste, defensively, since the taste agent is still adding `shopping`.

export const PREFS_KEY = "homebody-play-prefs";
export const ADDITIONS_KEY = "homebody-brief-additions";

export interface Prefs {
  liked: string[];
  disliked: string[];
  // product ids seen in the swipe deck
  swiped: string[];
  // attribute → weight, from likes (+1) and dislikes (−1)
  material: Record<string, number>;
  family: Record<string, number>;
  hue: Record<string, number>;
  // "Just this piece" or "Let the room follow", remembered
  ripple?: "keep" | "ripple";
  walkthroughSeen?: boolean;
}

export const EMPTY_PREFS: Prefs = { liked: [], disliked: [], swiped: [], material: {}, family: {}, hue: {} };

export function readPrefs(): Prefs {
  try {
    return { ...EMPTY_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return EMPTY_PREFS;
  }
}

export function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

const bump = (m: Record<string, number>, k: string | null | undefined, by: number) => (k ? { ...m, [k]: (m[k] ?? 0) + by } : m);

/** A like (+1) or dislike (−1) on a product: remembered by id, and spread over its material, styles and color. */
export function react(prefs: Prefs, p: Product, by: 1 | -1): Prefs {
  const liked = prefs.liked.filter((x) => x !== p.id), disliked = prefs.disliked.filter((x) => x !== p.id);
  if (by > 0) liked.push(p.id);
  else disliked.push(p.id);
  let family = prefs.family;
  for (const f of p.families) family = bump(family, f, by / p.families.length);
  return {
    ...prefs, liked, disliked,
    material: bump(bump(prefs.material, p.material, by), p.accentMaterial, by * 0.4),
    family,
    hue: bump(prefs.hue, hueFamily(p.color) ?? "neutral", by),
  };
}

/** A like or dislike on one of their own pieces: only its material and color are telling. */
export function reactOwn(prefs: Prefs, own: { material: string; color: string }, by: 1 | -1): Prefs {
  return { ...prefs, material: bump(prefs.material, own.material, by * 0.6), hue: bump(prefs.hue, hueFamily(own.color) ?? "neutral", by * 0.6) };
}

export function prefScore(p: Product, prefs: Prefs): number {
  if (prefs.disliked.includes(p.id)) return -20;
  let s = prefs.liked.includes(p.id) ? 3 : 0;
  s += (prefs.material[p.material] ?? 0) * 0.8 + (prefs.material[p.accentMaterial] ?? 0) * 0.3;
  for (const f of p.families) s += ((prefs.family[f] ?? 0) * 0.8) / p.families.length;
  s += (prefs.hue[hueFamily(p.color) ?? "neutral"] ?? 0) * 0.5;
  return s;
}

// ---- The brief, and how she shops ----

export interface Shopping {
  // thrift, vintage, mid-market, designer… (lib/taste/shopping.ts TierId)
  tiers: string[];
  brands: string[];
  avoid: string[];
  // how much "Amazon, delivered fast" counts for her, 0–1 (the seed is all Amazon)
  amazon: number;
  channels: string[];
  secondhand?: "new" | "mixed" | "secondhand";
  splurge: string[];
  save: string[];
}

export interface BriefRead {
  confirmed: boolean;
  concept?: Concept;
  // every line of the brief, lowercased, for keyword reads
  text: string;
  program: string[];
  nevers: string[];
  household: { pets?: boolean; kids?: boolean; mobility?: boolean };
  shopping: Shopping | null;
  taste?: TasteState;
  budget?: number;
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" && v.trim() ? v.split(/,\s*|\s*;\s*/) : []);
const yes = (v: unknown) => {
  if (v === undefined || v === null) return false;
  const s = (Array.isArray(v) ? v.join(" ") : String(v)).toLowerCase();
  return !!s && !/^(no|none|not really|0|false)\b/.test(s);
};

function readShopping(raw: unknown): Shopping | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sh = String(r.secondhand ?? r.newOrSecondhand ?? r.new_vs_secondhand ?? "").toLowerCase();
  const weights = (r.weights ?? {}) as Record<string, number>;
  const channels = list(r.channels ?? r.channel ?? r.where).map((x) => x.toLowerCase());
  return {
    tiers: list(r.tiers ?? r.tier ?? r.style ?? r.shopper).map((x) => x.toLowerCase()),
    brands: list(r.brands_like ?? r.brands ?? r.brand),
    avoid: list(r.brands_avoid ?? r.avoid),
    amazon: Number(weights.fast ?? (channels.includes("fast") ? 1 : 0)) || 0,
    channels,
    secondhand: /second|vintage|thrift|used/.test(sh) && !/mix|both|some|either/.test(sh) ? "secondhand" : /mix|both|some|either/.test(sh) ? "mixed" : sh ? "new" : undefined,
    splurge: list(r.splurge ?? r.splurgeOn ?? r.splurge_on).map((x) => x.toLowerCase()),
    save: list(r.save ?? r.saveOn ?? r.save_on).map((x) => x.toLowerCase()),
  };
}

export function readBrief(): BriefRead {
  const saved = readSaved() as ReturnType<typeof readSaved> & { shopping?: unknown };
  const c = saved.convo?.concept;
  const lines = c ? [c.statement, ...(c.program ?? []), ...(c.constraints ?? []), ...(c.direction ?? []), ...(c.decisions ?? []).map((d) => d.decision), ...(c.nevers ?? [])] : [];
  const a = saved.answers ?? {};
  const said = lines.join(" ").toLowerCase();
  const shopRaw = (saved.taste as unknown as { shopping?: unknown } | undefined)?.shopping ?? saved.shopping ?? (saved.convo as unknown as { shopping?: unknown } | undefined)?.shopping ?? (a as Record<string, unknown>).shopping;
  const budgetRaw = Number(String(a.budget ?? "").replace(/[^0-9.]/g, ""));
  return {
    confirmed: !!saved.convo?.confirmed,
    concept: c,
    text: said,
    program: (c?.program ?? []).map((x) => x.toLowerCase()),
    nevers: (c?.nevers ?? []).map((x) => x.toLowerCase()),
    household: {
      pets: yes(a.pets) || /\b(cat|cats|dog|dogs|pet|pets)\b/.test(said),
      kids: yes(a.kids) || /\b(kid|kids|child|children|toddler|baby)\b/.test(said),
      mobility: /wheelchair|walker|mobility/.test(said),
    },
    shopping: readShopping(shopRaw),
    taste: saved.taste,
    budget: budgetRaw > 100 ? budgetRaw : undefined,
  };
}

const NEVER_WORDS: Record<string, string[]> = {
  leather: ["leather"], boucle: ["boucle", "bouclé"], brass: ["brass", "gold"], walnut: ["walnut", "dark wood"],
  white_oak: ["oak", "pale wood"], black_steel: ["black metal", "steel", "industrial"], jute: ["jute"], linen: ["linen"],
  reclaimed: ["reclaimed", "rustic"], wool: ["wool"],
};

/** Materials the brief rules out ("no leather", "nothing rustic"). */
export function neverMaterials(b: BriefRead): string[] {
  return Object.entries(NEVER_WORDS).filter(([, ws]) => b.nevers.some((n) => ws.some((w) => n.includes(w)))).map(([m]) => m);
}

/** How well a product suits how she shops: her brands, her tier, new versus secondhand. */
export function shoppingScore(p: Product, s: Shopping | null): number {
  if (!s) return p.real ? 0.8 : 0;
  let score = 0;
  const brand = (p.real?.brand ?? p.maker).toLowerCase();
  const named = (b: string) => !!b && (brand.includes(b.toLowerCase()) || b.toLowerCase().includes(brand));
  if (s.avoid.some(named) || (p.real && s.avoid.some((b) => /amazon/i.test(b)))) return -60;
  if (s.brands.some(named)) score += 2.5;
  score += s.amazon * (p.real ? 1 : 0);
  const tiers = s.tiers.join(" ");
  // the real seed is mid-market new; the samples stand in for a "studio" (designer) and a "basics" tier
  if (/mid|everyday|value|budget|afford|mix/.test(tiers)) score += p.real ? 1.2 : /basics/i.test(p.maker) ? 0.6 : -0.3;
  if (/designer|investment|high|luxury|studio/.test(tiers)) score += /studio/i.test(p.maker) ? 1 : p.real ? 0.2 : -0.2;
  if (/thrift|vintage|second|antique/.test(tiers) || s.secondhand === "secondhand") score += p.real ? -0.4 : 0;
  // where she splurges, quality over price; where she saves, the cheaper twin
  // "Sofa", "Rug", "Lighting", "Art", "A statement chair", "Storage" (lib/taste/shopping.ts SPLURGE)
  const kind = p.category === "lamp" ? "light" : p.category === "shelf" ? "storage" : p.category;
  if (s.splurge.some((x) => x.includes(kind))) score += /studio/i.test(p.maker) ? 0.8 : 0;
  if (s.save.some((x) => x.includes(kind))) score += /basics/i.test(p.maker) || p.real ? 0.6 : -0.3;
  return score + (p.real ? 0.8 : 0);
}

export interface Addition {
  room: string;
  text: string;
  topic?: string;
  piece?: string;
  at: string;
}

/** "Add to my brief": an open note for the designer, picked up by the interview next time. */
export function addToBrief(a: Omit<Addition, "at">) {
  try {
    const all: Addition[] = JSON.parse(localStorage.getItem(ADDITIONS_KEY) ?? "[]");
    all.push({ ...a, at: new Date().toISOString() });
    localStorage.setItem(ADDITIONS_KEY, JSON.stringify(all.slice(-50)));
  } catch {}
}
