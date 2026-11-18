import { corners, overlaps, wallsOf, type Rect, type Wall } from "@/lib/play/layout";
import { chroma, hexToLab, hueFamily, isNeutral, undertone, valueOf } from "./color";

// The 15 rules (docs/reference/design-principles/README.md) as code validators. Each returns a finding: pass,
// fail, or null when the room doesn't carry the data to judge it (no lamps in the scan's lighting, no fabric
// ratings). Proposals are checked against these before they're shown, and failures say exactly what's wrong.
// Units: meters. Numbers are the README's defaults.

export const IN = 0.0254;
export const R = {
  WALK_MAIN: 36 * IN,
  WALK_SECONDARY: 30 * IN,
  DOOR_LANDING: 36 * IN,
  CONVO_MAX: 10 * 12 * IN,
  LANDING_REACH: 24 * IN,
  LAMP_REACH: 48 * IN,
  COFFEE_RATIO: [1 / 2, 2 / 3] as const,
  COFFEE_GAP: [14 * IN, 18 * IN] as const,
  RUG_WALL_GAP: [12 * IN, 18 * IN] as const,
  FRONT_OF_STORAGE: 36 * IN,
  ART_CENTER: [57 * IN, 60 * IN] as const,
  BALANCE_MAX: 0.6,
  MAX_HUES: 3,
  MAX_WOODS: 3,
  MAX_METALS: 2,
  MIN_LIGHTS: 3,
} as const;

/** What a rule needs to know about each piece, whatever it is (theirs, a product, something brought). */
export interface DPiece {
  key: string;
  name: string;
  // a design role: sofa, chair, coffee_table, side_table, rug, lamp, shelf, storage, desk, art, dining_table, other
  role: string;
  x: number;
  y: number;
  rot: number;
  w: number;
  d: number;
  h: number;
  elev: number;
  mount: "floor" | "wall";
  flat: boolean;
  color: string;
  accent?: string;
  material: string;
  accentMaterial?: string;
  // "keep_here" (theirs, staying put), "keep_move" (theirs, may move), "free" (proposed or catalog)
  lock: "keep_here" | "keep_move" | "free";
  // the reason it's there (rule 15): every proposed piece carries one
  why?: string;
  hero?: boolean;
  fixed?: boolean;
}

export interface DRoom {
  footprint: { x: number; y: number }[];
  doors: Rect[];
  focal: { x: number; y: number; nx: number; ny: number; what: string } | null;
  wall: string;
  floor: string;
  // style leaning for the color rules: eclectic and maximalist get looser limits
  loose?: boolean;
  household?: { pets?: boolean; kids?: boolean; mobility?: boolean };
  // where the scan put each "keep here" piece, for rule 15
  original?: Record<string, { x: number; y: number; rot: number }>;
}

export interface Finding {
  rule: number;
  title: string;
  // null: not enough to judge
  ok: boolean | null;
  // hard: a proposal that breaks it isn't shown; soft: it's said, and the ripple engine may fix it
  hard: boolean;
  note: string;
  keys?: string[];
}

export const RULE_TITLES: Record<number, string> = {
  1: "Clear paths", 2: "One focal point, faced", 3: "Conversation distance", 4: "Coffee and side tables to scale",
  5: "Rugs big enough", 6: "Clearances around use", 7: "Color roles", 8: "Accent repetition", 9: "One undertone story",
  10: "Material discipline", 11: "Light in layers", 12: "Things on walls at the right height", 13: "Balance and weight",
  14: "Fit the person", 15: "Respect what's kept, and justify every choice",
};

const f = (rule: number, ok: boolean | null, note: string, hard = false, keys?: string[]): Finding => ({ rule, title: RULE_TITLES[rule], ok, hard, note, keys });
const cm = (m: number) => `${Math.round(m * 100)} cm`;
const inch = (m: number) => `${Math.round(m / IN)}"`;
const rect = (p: DPiece): Rect => ({ x: p.x, y: p.y, rot: p.rot, w: p.w, d: Math.max(p.d, 0.05) });
const front = (rot: number) => ({ x: -Math.sin((rot * Math.PI) / 180), y: Math.cos((rot * Math.PI) / 180) });
const standing = (ps: DPiece[]) => ps.filter((p) => p.mount === "floor" && !p.flat);
const SEATS = new Set(["sofa", "chair"]);
const SURFACES = new Set(["coffee_table", "side_table", "desk", "storage", "dining_table"]);

/** Shortest gap between two rotated rectangles (0 when they touch or overlap). */
export function gapBetween(a: Rect, b: Rect): number {
  if (overlaps(a, b, 0)) return 0;
  const ca = corners(a.x, a.y, a.rot, a.w, a.d), cb = corners(b.x, b.y, b.rot, b.w, b.d);
  const segDist = (p: { x: number; y: number }, s: { x: number; y: number }, e: { x: number; y: number }) => {
    const dx = e.x - s.x, dy = e.y - s.y;
    const t = Math.max(0, Math.min(1, ((p.x - s.x) * dx + (p.y - s.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(s.x + dx * t - p.x, s.y + dy * t - p.y);
  };
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    for (const p of ca) best = Math.min(best, segDist(p, cb[i], cb[(i + 1) % 4]));
    for (const p of cb) best = Math.min(best, segDist(p, ca[i], ca[(i + 1) % 4]));
  }
  return best;
}

function insidePoly(poly: { x: number; y: number }[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

function inRect(x: number, y: number, o: Rect, grow = 0) {
  const a = (-o.rot * Math.PI) / 180;
  const dx = x - o.x, dy = y - o.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= o.w / 2 + grow && Math.abs(ly) <= o.d / 2 + grow;
}

function wallDist(walls: Wall[], x: number, y: number) {
  let best = Infinity;
  for (const w of walls) {
    const t = Math.max(0, Math.min(w.len, (x - w.ax) * w.dx + (y - w.ay) * w.dy));
    best = Math.min(best, Math.hypot(w.ax + w.dx * t - x, w.ay + w.dy * t - y));
  }
  return best;
}

/** The main seat: the widest sofa, else the widest chair. */
export const mainSeatOf = (ps: DPiece[]) =>
  [...ps.filter((p) => SEATS.has(p.role))].sort((a, b) => (b.role === "sofa" ? 1 : 0) - (a.role === "sofa" ? 1 : 0) || b.w - a.w)[0];

// ---- 1. Clear paths: a 30" walkway connects every door, and none is blocked ----

/**
 * Walkable floor on a 10 cm grid: cells at least half a walkway from every standing piece and wall. Doors must
 * be connected through it. Returns the doors that can't reach the others and the pieces nearest the pinch.
 */
function paths(room: DRoom, ps: DPiece[]) {
  const step = 0.1;
  const fp = room.footprint;
  const walls = wallsOf(fp);
  const xs = fp.map((p) => p.x), ys = fp.map((p) => p.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const nx = Math.ceil((Math.max(...xs) - x0) / step), ny = Math.ceil((Math.max(...ys) - y0) / step);
  const half = R.WALK_SECONDARY / 2;
  const solid = standing(ps).filter((p) => !(p.fixed && p.elev > 0.9)).map(rect);
  const open = new Uint8Array(nx * ny);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const x = x0 + (i + 0.5) * step, y = y0 + (j + 0.5) * step;
      if (!insidePoly(fp, x, y) || wallDist(walls, x, y) < half - 0.05) continue;
      if (solid.some((r) => inRect(x, y, r, half))) continue;
      open[i * ny + j] = 1;
    }
  // each door's entry cell: a little way into the room, in front of the door
  const entries = room.doors.map((d) => {
    const i = Math.floor((d.x - x0) / step), j = Math.floor((d.y - y0) / step);
    let best: number | null = null, bd = Infinity;
    for (let di = -6; di <= 6; di++)
      for (let dj = -6; dj <= 6; dj++) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny || !open[a * ny + b]) continue;
        const dd = di * di + dj * dj;
        if (dd < bd) { bd = dd; best = a * ny + b; }
      }
    return best;
  });
  const reach = (from: number) => {
    const seen = new Uint8Array(nx * ny);
    const q = [from];
    seen[from] = 1;
    while (q.length) {
      const c = q.pop()!;
      const i = Math.floor(c / ny), j = c % ny;
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const k = a * ny + b;
        if (!open[k] || seen[k]) continue;
        seen[k] = 1;
        q.push(k);
      }
    }
    return seen;
  };
  const blocked: number[] = entries.flatMap((e, i) => (e === null ? [i] : []));
  const first = entries.find((e) => e !== null);
  if (first !== undefined && first !== null) {
    const seen = reach(first);
    entries.forEach((e, i) => { if (e !== null && !seen[e]) blocked.push(i); });
  }
  // open floor share, for the "room to move" note
  let openCells = 0;
  for (const v of open) openCells += v;
  return { blocked, openShare: openCells / Math.max(1, nx * ny) };
}

export function rule1(room: DRoom, ps: DPiece[]): Finding {
  const inDoor = standing(ps).filter((p) => !p.fixed && room.doors.some((d) => overlaps(rect(p), d)));
  if (inDoor.length) return f(1, false, `${inDoor.map((p) => p.name).join(", ")} in a door's ${inch(R.DOOR_LANDING)} landing`, true, inDoor.map((p) => p.key));
  if (room.doors.length < 2) return f(1, true, "The door's landing is clear");
  const { blocked } = paths(room, ps);
  if (blocked.length) return f(1, false, `No ${inch(R.WALK_SECONDARY)} walkway reaches ${blocked.length === 1 ? "one of the doors" : `${blocked.length} doors`}`, true);
  return f(1, true, `A ${inch(R.WALK_SECONDARY)}+ walkway joins every door`);
}

// ---- 2. One focal point, faced ----

export function rule2(room: DRoom, ps: DPiece[]): Finding {
  const seat = mainSeatOf(ps);
  if (!room.focal || !seat) return f(2, null, room.focal ? "No main seat yet" : "No focal point found (TV, fireplace or main window)");
  const fr = front(seat.rot);
  const vx = room.focal.x - seat.x, vy = room.focal.y - seat.y;
  const ang = (Math.acos(Math.max(-1, Math.min(1, (fr.x * vx + fr.y * vy) / (Math.hypot(vx, vy) || 1)))) * 180) / Math.PI;
  const tall = standing(ps).filter((p) => p !== seat && p.h > 1.2 && segmentHits(seat, room.focal!, rect(p)));
  if (ang > 45) return f(2, false, `The ${seat.name.toLowerCase()} turns ${Math.round(ang)}° from the ${room.focal.what}`, false, [seat.key]);
  if (tall.length) return f(2, false, `${tall[0].name} stands between the seat and the ${room.focal.what}`, false, [tall[0].key]);
  return f(2, true, `The main seat faces the ${room.focal.what} (${Math.round(ang)}°)`);
}

function segmentHits(a: { x: number; y: number }, b: { x: number; y: number }, r: Rect) {
  for (let t = 0.15; t < 0.95; t += 0.05) if (inRect(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r)) return true;
  return false;
}

// ---- 3. Conversation distance, landing surfaces, a reading lamp ----

export function rule3(_room: DRoom, ps: DPiece[]): Finding {
  const seats = ps.filter((p) => SEATS.has(p.role) && p.mount === "floor");
  const main = mainSeatOf(ps);
  if (!main) return f(3, null, "No seating yet");
  const far = seats.filter((s) => s !== main && Math.hypot(s.x - main.x, s.y - main.y) > R.CONVO_MAX);
  if (far.length) return f(3, false, `${far[0].name} is more than 10 ft from the main seat`, false, far.map((p) => p.key));
  const surfaces = ps.filter((p) => SURFACES.has(p.role));
  const dry = seats.filter((s) => !surfaces.some((t) => gapBetween(rect(s), rect(t)) <= R.LANDING_REACH));
  if (dry.length) return f(3, false, `Nowhere to set a cup down by the ${dry[0].name.toLowerCase()}`, false, dry.map((p) => p.key));
  const lamps = ps.filter((p) => p.role === "lamp");
  if (!lamps.some((l) => gapBetween(rect(main), rect(l)) <= R.LAMP_REACH))
    return f(3, false, `No lamp within reach of the ${main.name.toLowerCase()}`, false, [main.key]);
  return f(3, true, "Seats within 10 ft, each with a surface in reach, and a lamp by the main seat");
}

// ---- 4. Coffee table to scale: 1/2–2/3 of the sofa, 14–18" from the seat ----

export function rule4(_room: DRoom, ps: DPiece[]): Finding {
  const sofa = ps.find((p) => p.role === "sofa");
  const table = sofa && ps.filter((p) => p.role === "coffee_table").sort((a, b) => Math.hypot(a.x - sofa.x, a.y - sofa.y) - Math.hypot(b.x - sofa.x, b.y - sofa.y))[0];
  if (!sofa || !table) return f(4, null, sofa ? "No coffee table" : "No sofa");
  const ratio = Math.max(table.w, table.d) / sofa.w;
  const gap = gapBetween(rect(sofa), rect(table));
  const issues: string[] = [];
  // a little slack: real pieces come in fixed sizes
  if (ratio < R.COFFEE_RATIO[0] - 0.06) issues.push(`the coffee table is ${Math.round(ratio * 100)}% of the sofa's length (aim for 1/2–2/3)`);
  if (ratio > R.COFFEE_RATIO[1] + 0.08) issues.push(`the coffee table is ${Math.round(ratio * 100)}% of the sofa's length (aim for 1/2–2/3)`);
  if (gap > 0.7) issues.push(`it's ${cm(gap)} from the sofa, too far to reach`);
  else if (gap < R.COFFEE_GAP[0] - 0.06) issues.push(`only ${inch(gap)} from the sofa (aim for 14–18")`);
  else if (gap > R.COFFEE_GAP[1] + 0.12) issues.push(`${inch(gap)} from the sofa (aim for 14–18")`);
  if (issues.length) return f(4, false, cap(issues.join("; ")), false, [table.key]);
  return f(4, true, `Coffee table ${Math.round(ratio * 100)}% of the sofa, ${inch(gap)} from its edge`);
}

// ---- 5. Rugs: front legs of every seat on it, 12–18" of floor at the walls ----

export function rule5(room: DRoom, ps: DPiece[]): Finding {
  const rug = ps.filter((p) => p.role === "rug").sort((a, b) => b.w * b.d - a.w * a.d)[0];
  if (!rug) return f(5, null, "No rug");
  const r = rect(rug);
  const walls = wallsOf(room.footprint);
  const seats = ps.filter((p) => SEATS.has(p.role) && Math.hypot(p.x - rug.x, p.y - rug.y) < 3);
  const off = seats.filter((s) => {
    const fr = front(s.rot);
    const ax = Math.cos((s.rot * Math.PI) / 180), ay = Math.sin((s.rot * Math.PI) / 180);
    // the two front legs, a few cm in from the front corners
    return [-1, 1].some((k) => !inRect(s.x + fr.x * (s.d / 2 - 0.08) + ax * k * (s.w / 2 - 0.08), s.y + fr.y * (s.d / 2 - 0.08) + ay * k * (s.w / 2 - 0.08), r));
  });
  const edge = Math.min(...corners(rug.x, rug.y, rug.rot, rug.w, rug.d).map((c) => wallDist(walls, c.x, c.y)));
  if (off.length) return f(5, false, `The ${off[0].name.toLowerCase()}'s front legs are off the rug`, false, [rug.key, ...off.map((p) => p.key)]);
  if (edge < R.RUG_WALL_GAP[0] - 0.12) return f(5, false, `The rug runs to within ${cm(edge)} of a wall (leave 12–18")`, false, [rug.key]);
  return f(5, true, seats.length ? "Every seat's front legs are on the rug" : "The rug leaves floor at the walls");
}

// ---- 6. Clearances around use: in front of storage and desks ----

export function rule6(_room: DRoom, ps: DPiece[]): Finding {
  const others = standing(ps);
  const tight = ps.filter((p) => (p.role === "storage" || p.role === "desk" || p.role === "shelf") && p.mount === "floor").filter((p) => {
    const fr = front(p.rot);
    const zone: Rect = { x: p.x + fr.x * (p.d / 2 + R.FRONT_OF_STORAGE / 2), y: p.y + fr.y * (p.d / 2 + R.FRONT_OF_STORAGE / 2), rot: p.rot, w: p.w * 0.8, d: R.FRONT_OF_STORAGE - 0.1 };
    // a desk's own chair is allowed in front of it
    return others.some((o) => o !== p && !(p.role === "desk" && o.role === "chair") && overlaps(zone, rect(o)));
  });
  if (tight.length) return f(6, false, `Less than 36" in front of the ${tight[0].name.toLowerCase()}`, false, tight.map((p) => p.key));
  return f(6, true, "Room to open drawers and pull out a chair");
}

// ---- 7. Color roles: light, mid and dark; ≤ 3 hue families; large areas quieter than accents ----

/** A piece's visible area, roughly: its front face plus, for low and flat pieces, its top. */
export const areaOf = (p: DPiece) => (p.flat ? p.w * p.d * 0.6 : p.w * p.h + (p.h < 0.6 ? p.w * p.d * 0.4 : 0));

export function rule7(room: DRoom, ps: DPiece[]): Finding {
  const swatches = [{ hex: room.wall, area: 20 }, { hex: room.floor, area: 10 }, ...ps.map((p) => ({ hex: p.color, area: areaOf(p) })), ...ps.filter((p) => p.accent).map((p) => ({ hex: p.accent!, area: areaOf(p) * 0.15 }))];
  const values = new Set(swatches.map((s) => valueOf(s.hex)));
  const hues = new Set(swatches.map((s) => hueFamily(s.hex)).filter(Boolean));
  const maxHues = room.loose ? 5 : R.MAX_HUES;
  const missing = (["light", "mid", "dark"] as const).filter((v) => !values.has(v));
  if (hues.size > maxHues) return f(7, false, `${hues.size} color families (${[...hues].join(", ")}); keep to ${maxHues}`);
  // the biggest colored surface should be quieter than the smallest accent
  const big = ps.filter((p) => !isNeutral(p.color)).sort((a, b) => areaOf(b) - areaOf(a));
  if (big.length >= 2) {
    const c0 = chroma(hexToLab(big[0].color)), c1 = chroma(hexToLab(big[big.length - 1].color));
    if (areaOf(big[0]) > areaOf(big[big.length - 1]) * 3 && c0 > c1 + 12) return f(7, false, `The ${big[0].name.toLowerCase()} is louder than the accents; large areas should be the quieter color`, false, [big[0].key]);
  }
  if (missing.length) return f(7, false, `No ${missing.join(" or ")} value in the room${missing.includes("dark") ? "; a dark note grounds it" : ""}`);
  return f(7, true, `Light, mid and dark all present; ${hues.size || "no"} color ${hues.size === 1 ? "family" : "families"}`);
}

// ---- 8. Accent repetition: each accent hue in ≥ 3 places, ≥ 2 heights ----

/** Wood, leather, jute, rattan and metals carry their own color: a material, not a painted accent. */
export const isNaturalMaterial = (m?: string) => !!m && /oak|walnut|reclaimed|wood|teak|pine|leather|jute|rattan|wicker|brass|steel|chrome|metal|limestone|stone|terrazzo|plant|foliage/.test(m);

/** The colors a piece shows as color (its accent hues), leaving out what its natural materials give it. */
export const paintedColors = (p: { color: string; accent?: string; material: string; accentMaterial?: string }) =>
  [isNaturalMaterial(p.material) ? null : p.color, p.accent && !isNaturalMaterial(p.accentMaterial) ? p.accent : null].filter(Boolean) as string[];

export function accentCarriers(ps: DPiece[]) {
  const by = new Map<string, DPiece[]>();
  for (const p of ps) {
    for (const hex of paintedColors(p)) {
      const h = hueFamily(hex);
      if (!h) continue;
      const list = by.get(h) ?? [];
      if (!list.includes(p)) list.push(p);
      by.set(h, list);
    }
  }
  return by;
}

export function rule8(_room: DRoom, ps: DPiece[]): Finding {
  const lonely: string[] = [];
  const keys: string[] = [];
  for (const [hue, carriers] of accentCarriers(ps)) {
    if (carriers.some((c) => c.hero)) continue;
    const heights = new Set(carriers.map((c) => (c.elev + c.h / 2 > 1.2 ? "high" : c.elev + c.h / 2 > 0.6 ? "mid" : "low")));
    if (carriers.length < 3 || heights.size < 2) {
      lonely.push(`${hue} (${carriers.length}×)`);
      keys.push(...carriers.map((c) => c.key));
    }
  }
  if (lonely.length) return f(8, false, `Accent${lonely.length > 1 ? "s" : ""} not repeated: ${lonely.join(", ")}; repeat in 3 places at 2 heights`, false, keys);
  return f(8, true, "Every accent repeats");
}

// ---- 9. One undertone story among the neutrals ----

export function rule9(room: DRoom, ps: DPiece[]): Finding {
  const neutrals = [room.wall, room.floor, ...ps.filter((p) => isNeutral(p.color)).map((p) => p.color)];
  const warm = neutrals.filter((h) => undertone(h) === "warm").length;
  const cool = neutrals.filter((h) => undertone(h) === "cool").length;
  const minority = Math.min(warm, cool);
  if (minority === 1 && warm + cool >= 4) return f(9, false, `One ${warm < cool ? "warm" : "cool"} neutral against ${Math.max(warm, cool)} ${warm < cool ? "cool" : "warm"} ones: repeat it or let it go`);
  return f(9, true, warm >= cool ? "Warm neutrals throughout" : "Cool neutrals throughout");
}

// ---- 10. Material discipline: ≤ 3 woods, ≤ 2 metals, nothing orphaned ----

export const WOODS = new Set(["white_oak", "walnut", "reclaimed", "wood_light", "wood_mid", "wood_dark", "teak", "pine"]);
export const METALS = new Set(["brass", "black_steel", "metal_brass", "metal_chrome", "metal_black", "chrome", "nickel"]);
const familyOfMaterial = (m: string) => (/wood|oak|walnut|reclaimed/.test(m) ? m.replace(/^wood_/, "") : m);

export function rule10(_room: DRoom, ps: DPiece[]): Finding {
  const mats = new Map<string, DPiece[]>();
  for (const p of ps) for (const m of [p.material, p.accentMaterial].filter(Boolean) as string[]) {
    const k = familyOfMaterial(m);
    mats.set(k, [...new Set([...(mats.get(k) ?? []), p])]);
  }
  const woods = [...mats.keys()].filter((m) => WOODS.has(m) || WOODS.has(`wood_${m}`) || /oak|walnut|reclaimed/.test(m));
  const metals = [...mats.keys()].filter((m) => METALS.has(m) && !/black/.test(m));
  if (woods.length > R.MAX_WOODS) return f(10, false, `${woods.length} wood tones; keep to 3 with one dominant`, false, woods.flatMap((w) => mats.get(w)!.map((p) => p.key)));
  if (metals.length > R.MAX_METALS) return f(10, false, `${metals.length} metals besides black; keep to 2`, false);
  const orphans = [...mats.entries()].filter(([m, c]) => c.length === 1 && (WOODS.has(m) || METALS.has(m) || /oak|walnut|reclaimed|brass|limestone|leather/.test(m)));
  if (orphans.length) return f(10, false, `${orphans.map(([m]) => m.replace(/_/g, " ")).join(", ")} appear${orphans.length === 1 ? "s" : ""} only once`, false, orphans.map(([, c]) => c[0].key));
  return f(10, true, `${woods.length} wood${woods.length === 1 ? "" : "s"}, ${metals.length} metal${metals.length === 1 ? "" : "s"}, each repeated`);
}

// ---- 11. Light in layers ----

export function rule11(_room: DRoom, ps: DPiece[], ceilingLights = 0): Finding {
  const lamps = ps.filter((p) => p.role === "lamp").length;
  const sources = lamps + ceilingLights;
  if (sources < R.MIN_LIGHTS) return f(11, false, `${sources} light source${sources === 1 ? "" : "s"}; a room wants 3 at 2 heights`);
  return f(11, true, `${sources} light sources`);
}

// ---- 12. Art centred 57–60" ----

export function rule12(_room: DRoom, ps: DPiece[]): Finding {
  const art = ps.filter((p) => p.role === "art" && p.mount === "wall");
  if (!art.length) return f(12, null, "Nothing on the walls");
  const off = art.filter((a) => {
    const c = a.elev + a.h / 2;
    return c < R.ART_CENTER[0] - 0.15 || c > R.ART_CENTER[1] + 0.2;
  });
  if (off.length) return f(12, false, `${off[0].name} hangs at ${inch(off[0].elev + off[0].h / 2)} to its center (aim for 57–60")`, false, off.map((p) => p.key));
  return f(12, true, "Art hangs at eye level");
}

// ---- 13. Balance across the focal axis ----

export const weightOf = (p: DPiece) => {
  const L = hexToLab(p.color)[0];
  return p.w * p.h * (p.flat ? 0.2 : 1) * (1.4 - L / 100) * (1 + chroma(hexToLab(p.color)) / 100);
};

export function rule13(room: DRoom, ps: DPiece[]): Finding {
  const xs = room.footprint.map((p) => p.x), ys = room.footprint.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  // the focal axis runs from the focal point straight into the room; without one, the room's long axis
  const axis = room.focal ? { x: room.focal.nx, y: room.focal.ny } : Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys) ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const o = room.focal ?? { x: cx, y: cy };
  let left = 0, right = 0;
  for (const p of ps.filter((q) => !q.fixed)) {
    const side = (p.x - o.x) * axis.y - (p.y - o.y) * axis.x;
    if (side > 0) left += weightOf(p);
    else right += weightOf(p);
  }
  const share = Math.max(left, right) / Math.max(1e-6, left + right);
  if (share > R.BALANCE_MAX + 0.05) return f(13, false, `${Math.round(share * 100)}% of the visual weight sits on one side`);
  return f(13, true, `Weight split ${Math.round(share * 100)}/${Math.round((1 - share) * 100)}`);
}

// ---- 14. Fit the person: fabrics for pets and kids ----

export function rule14(room: DRoom, ps: DPiece[]): Finding {
  const h = room.household;
  if (!h || (!h.pets && !h.kids)) return f(14, null, "Nothing known about pets or kids");
  const bad = ps.filter((p) => p.lock === "free" && ((h.pets && /boucle|jute/.test(p.material)) || (h.kids && /linen/.test(p.material) && valueOf(p.color) === "light" && p.role === "sofa")));
  if (bad.length) return f(14, false, `${bad[0].name}: ${h.pets && /boucle|jute/.test(bad[0].material) ? "loop weaves snag on claws" : "pale linen with kids"}`, false, bad.map((p) => p.key));
  return f(14, true, "Fabrics suit the household");
}

// ---- 15. Respect what's kept; every proposed piece has a reason ----

export function rule15(room: DRoom, ps: DPiece[]): Finding {
  const moved = ps.filter((p) => p.lock === "keep_here" && room.original?.[p.key] && Math.hypot(p.x - room.original[p.key].x, p.y - room.original[p.key].y) > 0.02);
  if (moved.length) return f(15, false, `${moved[0].name} was to stay where it is`, true, moved.map((p) => p.key));
  const silent = ps.filter((p) => p.lock === "free" && !p.why);
  if (silent.length) return f(15, false, `${silent.length} piece${silent.length === 1 ? "" : "s"} without a stated reason`, false, silent.map((p) => p.key));
  return f(15, true, "Kept pieces untouched; every new piece has a reason");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Run every rule. `ceilingLights`: pendants and ceiling fixtures the scan found. */
export function validate(room: DRoom, ps: DPiece[], ceilingLights = 0): Finding[] {
  return [
    rule1(room, ps), rule2(room, ps), rule3(room, ps), rule4(room, ps), rule5(room, ps), rule6(room, ps), rule7(room, ps),
    rule8(room, ps), rule9(room, ps), rule10(room, ps), rule11(room, ps, ceilingLights), rule12(room, ps), rule13(room, ps),
    rule14(room, ps), rule15(room, ps),
  ];
}

export const hardFailures = (fs: Finding[]) => fs.filter((x) => x.hard && x.ok === false);
export const failures = (fs: Finding[]) => fs.filter((x) => x.ok === false);
