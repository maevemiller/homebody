import { distance, harmonize, hueFamily, isNeutral } from "./color";
import { areaOf, type DPiece } from "./rules";

// The ripple engine (docs/reference/design-principles/coherence.md): the room as roles that pieces fill, and,
// when one piece changes, the smallest set of follow-on changes that keeps it coherent. Code only: it finds
// the violated relationships, proposes candidate fixes from the catalog, filters them by locks and budget,
// scores coherence gain against cost and disruption, and caps the result at about three (§4).

export type Role = "dominant" | "secondary" | "accent";

/** A piece's color role by its visible area (§2A step 1): a cushion or vase is an accent; a sofa or rug is not. */
export function roleOf(p: DPiece, all: DPiece[]): Role {
  const a = areaOf(p);
  const total = all.reduce((s, q) => s + areaOf(q), 0) || 1;
  if (a / total > 0.22 || p.role === "sofa" || p.role === "rug") return isNeutral(p.color) ? "dominant" : "secondary";
  if (a / total > 0.08) return "secondary";
  return "accent";
}

export interface DesignState {
  palette: { dominant: string[]; secondary: string[]; accents: { hue: string; hex: string; carriers: string[] }[] };
  materials: { name: string; carriers: string[] }[];
  undertone: "warm" | "cool" | "neutral";
}

export function designState(ps: DPiece[]): DesignState {
  const dominant: string[] = [], secondary: string[] = [];
  const accents = new Map<string, { hue: string; hex: string; carriers: string[] }>();
  for (const p of ps) {
    const role = roleOf(p, ps);
    if (role === "dominant") dominant.push(p.color);
    else if (role === "secondary") secondary.push(p.color);
    for (const hex of [p.color, p.accent].filter(Boolean) as string[]) {
      const hue = hueFamily(hex);
      if (!hue) continue;
      const a = accents.get(hue) ?? { hue, hex, carriers: [] };
      if (!a.carriers.includes(p.key)) a.carriers.push(p.key);
      accents.set(hue, a);
    }
  }
  const mats = new Map<string, string[]>();
  for (const p of ps) for (const m of [p.material, p.accentMaterial].filter(Boolean) as string[]) mats.set(m, [...new Set([...(mats.get(m) ?? []), p.key])]);
  const warm = ps.filter((p) => isNeutral(p.color)).length;
  return {
    palette: { dominant, secondary, accents: [...accents.values()] },
    materials: [...mats.entries()].map(([name, carriers]) => ({ name, carriers })),
    undertone: warm ? "warm" : "neutral",
  };
}

/** A product the engine may swap in or add. */
export interface Candidate {
  id: string;
  name: string;
  // the design role it fills (lib/design/rules.ts DPiece.role)
  role: string;
  color: string;
  accent?: string;
  material: string;
  accentMaterial?: string;
  price: number;
}

export interface Change {
  key: string;
  // what the piece was and what it is now (null for an addition or a removal)
  from: { color: string; accent?: string; material: string; accentMaterial?: string } | null;
  to: { color: string; accent?: string; material: string; accentMaterial?: string } | null;
}

export interface Proposal {
  action: "swap";
  key: string;
  to: string;
  why: string;
  cost: number;
}

export interface Ripple {
  mode: "ripple" | "keep";
  proposals: Proposal[];
  kept_on_purpose: { key: string; why: string }[];
  warnings: string[];
  total_cost: number;
}

// what follows first (§4: accessories → lighting → small furniture → textiles → large furniture)
const DISRUPTION: Record<string, number> = { art: 1, lamp: 2, side_table: 3, coffee_table: 4, storage: 5, shelf: 5, chair: 6, rug: 7, desk: 8, sofa: 10 };
const disruption = (role: string) => DISRUPTION[role] ?? 6;

const carries = (c: { color: string; accent?: string }, hue: string) => [c.color, c.accent].some((h) => h && hueFamily(h) === hue);
const hasMat = (c: { material: string; accentMaterial?: string }, m: string) => c.material === m || c.accentMaterial === m;

/**
 * Follow-on changes for one change. In "keep" mode only the warnings come back. Never touches locked pieces
 * (theirs, or ones they picked), the hero, or large anchors to suit a small piece; stays within `budget`.
 */
export function ripple(
  change: Change,
  room: DPiece[],
  candidates: Candidate[],
  opts: { mode: "ripple" | "keep"; locked: Set<string>; budget?: number; cap?: number; inRoom?: Set<string> },
): Ripple {
  const cap = opts.cap ?? 3;
  const out: Ripple = { mode: opts.mode, proposals: [], kept_on_purpose: [], warnings: [], total_cost: 0 };
  const me = room.find((p) => p.key === change.key);
  const others = room.filter((p) => p.key !== change.key);
  const free = others.filter((p) => !opts.locked.has(p.key) && !p.hero && !p.fixed && p.lock === "free");
  const meDisruption = me ? disruption(me.role) : 5;
  // small things follow big things: only pieces no bigger than the changed one may follow it
  const followers = free.filter((p) => disruption(p.role) <= Math.max(meDisruption, 4)).sort((a, b) => disruption(a.role) - disruption(b.role));
  const used = new Set<string>();
  // products already in the room aren't offered again
  const taken = new Set<string>(opts.inRoom ?? []);
  let budget = opts.budget ?? Infinity;

  const swapFor = (target: DPiece, want: (c: Candidate) => boolean, why: string) => {
    if (out.proposals.length >= cap || used.has(target.key)) return false;
    const pick = candidates
      .filter((c) => c.role === target.role && want(c) && !taken.has(c.id))
      .sort((a, b) => a.price - b.price)[0];
    if (!pick) return false;
    const cost = Math.max(0, pick.price);
    if (cost > budget) return false;
    budget -= cost;
    used.add(target.key);
    taken.add(pick.id);
    out.proposals.push({ action: "swap", key: target.key, to: pick.id, why: `${pick.name}: ${why}`, cost });
    out.total_cost += cost;
    return true;
  };

  const to = change.to;
  const from = change.from;
  const after = room.map((p) => (p.key === change.key && to ? { ...p, ...to } : p)).filter((p) => !(p.key === change.key && !to));

  // A. a new color: repeat it to three carriers, and resolve the old accent
  const newHues = to ? [to.color, to.accent].filter(Boolean).map((h) => hueFamily(h!)).filter(Boolean) as string[] : [];
  for (const hue of [...new Set(newHues)]) {
    const carriers = after.filter((p) => carries(p, hue));
    if (carriers.length >= 3) continue;
    const need = 3 - carriers.length;
    out.warnings.push(`${cap1(hue)} appears ${carriers.length === 1 ? "once" : `${carriers.length} times`}; it'll read as a one-off. ${opts.mode === "keep" ? "Let the room follow to echo it." : ""}`.trim());
    let got = 0;
    for (const t of followers) {
      if (got >= need) break;
      if (carries(t, hue)) continue;
      if (swapFor(t, (c) => carries(c, hue), `repeats the ${hue} across the room (rule of three)`)) got++;
    }
  }
  if (from && to) {
    const oldHues = [from.color, from.accent].filter(Boolean).map((h) => hueFamily(h!)).filter(Boolean) as string[];
    for (const hue of oldHues.filter((h) => !newHues.includes(h))) {
      const left = after.filter((p) => carries(p, hue));
      if (!left.length) continue;
      const newHex = to.color;
      const oldHex = [from.color, from.accent].find((h) => h && hueFamily(h) === hue)!;
      const pair = harmonize(newHex, oldHex);
      if (pair.ok) {
        out.kept_on_purpose.push(...left.slice(0, 1).map((p) => ({ key: p.key, why: `${cap1(hue)} stays: ${pair.why}` })));
        continue;
      }
      // retire the old accent's small carriers; its large ones stay
      out.warnings.push(`${cap1(hue)} now competes with the new color, with ${left.length} other carrier${left.length === 1 ? "" : "s"}`);
      for (const t of left.filter((p) => followers.includes(p)).slice(0, 2)) {
        swapFor(t, (c) => !carries(c, hue) && (isNeutral(c.color) || newHues.some((h) => carries(c, h))), `retires the ${hue}, which was competing`);
      }
      for (const p of left.filter((q) => !followers.includes(q))) out.kept_on_purpose.push({ key: p.key, why: "Large anchors don't follow small changes" });
    }
  }

  // B. a material new to the room needs a second carrier; the last carrier leaving orphans the rest
  if (to) {
    for (const m of [to.material, to.accentMaterial].filter(Boolean) as string[]) {
      if (/^(linen|wool|paper|plastic|fabric)$/.test(m)) continue;
      const n = after.filter((p) => hasMat(p, m)).length;
      if (n >= 2) continue;
      out.warnings.push(`${cap1(m.replace(/_/g, " "))} appears once; a second piece in it ties it in`);
      const t = followers.find((p) => !hasMat(p, m) && !used.has(p.key));
      if (t) swapFor(t, (c) => hasMat(c, m), `a second ${m.replace(/_/g, " ")} piece, so it isn't orphaned`);
    }
  }

  // F. a removal that took an accent's carrier
  if (from && !to) {
    for (const hue of [from.color, from.accent].filter(Boolean).map((h) => hueFamily(h!)).filter(Boolean) as string[]) {
      const left = after.filter((p) => carries(p, hue));
      if (left.length && left.length < 3) {
        out.warnings.push(`${cap1(hue)} is down to ${left.length} carrier${left.length === 1 ? "" : "s"}`);
        const t = followers.find((p) => !carries(p, hue));
        if (t) swapFor(t, (c) => carries(c, hue), `replaces the ${hue} echo that left`);
      }
    }
  }

  for (const p of others.filter((q) => q.lock !== "free").slice(0, 2)) {
    if (!out.kept_on_purpose.some((k) => k.key === p.key)) out.kept_on_purpose.push({ key: p.key, why: "Yours: kept as it is" });
  }
  if (opts.mode === "keep") {
    out.proposals = [];
    out.total_cost = 0;
  }
  return out;
}

const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** How close a candidate's colors are to a set of target colors (lower is closer), for picking echoes. */
export const nearestTo = (c: Candidate, targets: string[]) => Math.min(...targets.map((t) => Math.min(distance(c.color, t), c.accent ? distance(c.accent, t) : Infinity)));
