import type { RoomItem, RoomSpec } from "@/lib/scan/spec";
import { PRODUCT, kindOf, type Product } from "./catalog";

// A room's Plug & Play layout: every piece in play, where it stands, and what
// it is (one of their own, a sample product, or something they're bringing).
// Plan coordinates as in lib/scan/spec.ts: meters, x and y on the floor,
// rotation in degrees counterclockwise with the front facing +y at 0.

export interface Piece {
  key: string;
  source: "room" | "catalog" | "brought";
  // the scanned item (source "room")
  item?: string;
  // the sample product shown: a catalog piece, or one of theirs swapped out
  product?: string;
  // a piece they're bringing, as they typed it
  brought?: string;
  x: number;
  y: number;
  rot: number;
  elev: number;
  // the wall it hangs on, for wall-mounted pieces
  wall?: number;
  // false while it waits in the "To find a spot for" tray
  placed: boolean;
}

export interface Layout {
  v: 1;
  pieces: Piece[];
}

export interface Shape {
  name: string;
  w: number;
  d: number;
  h: number;
  mount: "floor" | "wall";
  // rugs: other pieces stand on them
  flat: boolean;
  category: string;
  color: string;
  product?: Product;
  // part of the room itself (cladding, a fireplace, a mounted TV): stays on its wall, never picked up
  fixed: boolean;
}

export interface Rect {
  x: number;
  y: number;
  rot: number;
  w: number;
  d: number;
  // architecture or a doorway: never acceptable to overlap, even as a last resort
  hard?: boolean;
}

export interface Wall {
  i: number;
  ax: number;
  ay: number;
  // unit direction along the wall and the inward normal
  dx: number;
  dy: number;
  nx: number;
  ny: number;
  len: number;
}

const WALL_HUNG = new Set(["artwork", "mirror", "curtains", "art"]);

export const storageKey = (id: string) => `homebody-layout-${id}`;

export function wallsOf(footprint: { x: number; y: number }[]): Wall[] {
  return footprint.map((a, i) => {
    const b = footprint[(i + 1) % footprint.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    // counterclockwise footprint: the interior is on the left
    return { i, ax: a.x, ay: a.y, dx, dy, nx: -dy, ny: dx, len };
  });
}

const along = (w: Wall, x: number, y: number) => (x - w.ax) * w.dx + (y - w.ay) * w.dy;
const away = (w: Wall, x: number, y: number) => (x - w.ax) * w.nx + (y - w.ay) * w.ny;

function nearestWall(walls: Wall[], x: number, y: number, only?: (w: Wall) => boolean) {
  let best: { wall: Wall; dist: number } | null = null;
  for (const w of walls) {
    if (only && !only(w)) continue;
    const t = Math.max(0, Math.min(w.len, along(w, x, y)));
    const dist = Math.hypot(w.ax + w.dx * t - x, w.ay + w.dy * t - y);
    if (!best || dist < best.dist) best = { wall: w, dist };
  }
  return best;
}

function inside(poly: { x: number; y: number }[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

export function corners(x: number, y: number, rot: number, w: number, d: number) {
  const r = (rot * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const lx = (sx * w) / 2, ly = (sy * d) / 2;
    return { x: x + lx * c - ly * s, y: y + lx * s + ly * c };
  });
}

/** Wall-facing rotation: the front faces into the room. */
const facing = (w: Wall) => (Math.atan2(-w.nx, w.ny) * 180) / Math.PI;

export const SNAP = 0.12;

export interface Settled {
  x: number;
  y: number;
  rot: number;
  wall?: number;
  // which walls it ended up flush against
  snapped: boolean;
}

/**
 * Where a piece can actually go near (x, y): floor pieces are kept inside the
 * walls and snap flush when they come within SNAP of one; wall pieces slide
 * along the nearest allowed wall, facing into the room.
 */
export function settle(
  shape: Shape, x: number, y: number, rot: number,
  footprint: { x: number; y: number }[], walls: Wall[], allowWall?: (i: number) => boolean,
): Settled {
  if (shape.mount === "wall") {
    const near = nearestWall(walls, x, y, (w) => w.len >= shape.w * 0.6 && (!allowWall || allowWall(w.i)));
    if (!near) return { x, y, rot, snapped: false };
    const w = near.wall;
    const half = Math.min(shape.w / 2, w.len / 2);
    const t = Math.max(half, Math.min(w.len - half, along(w, x, y)));
    const off = shape.d / 2 + 0.004;
    return { x: w.ax + w.dx * t + w.nx * off, y: w.ay + w.dy * t + w.ny * off, rot: facing(w), wall: w.i, snapped: true };
  }

  // bring the center back inside first, then push every corner inside
  if (!inside(footprint, x, y)) {
    const near = nearestWall(walls, x, y);
    if (near) {
      const w = near.wall;
      const t = Math.max(0, Math.min(w.len, along(w, x, y)));
      x = w.ax + w.dx * t + w.nx * 0.05;
      y = w.ay + w.dy * t + w.ny * 0.05;
    }
  }
  for (let pass = 0; pass < 4; pass++) {
    // the deepest corner past each wall sets how far that wall pushes back (once, not per corner)
    const push = new Map<Wall, number>();
    for (const c of corners(x, y, rot, shape.w, shape.d)) {
      if (inside(footprint, c.x, c.y)) continue;
      const near = nearestWall(walls, c.x, c.y);
      if (!near) continue;
      const pen = -away(near.wall, c.x, c.y) + 0.002;
      if (pen > (push.get(near.wall) ?? 0)) push.set(near.wall, pen);
    }
    if (!push.size) break;
    for (const [w, pen] of push) {
      x += w.nx * pen;
      y += w.ny * pen;
    }
  }

  // flush against any wall it's close to (only walls the piece's side actually runs along)
  let snapped = false;
  for (const w of walls) {
    const cs = corners(x, y, rot, shape.w, shape.d);
    const gap = Math.min(...cs.map((c) => away(w, c.x, c.y)));
    if (gap <= 0.001 || gap > SNAP) continue;
    const ts = cs.map((c) => along(w, c.x, c.y));
    if (Math.max(...ts) < 0 || Math.min(...ts) > w.len) continue;
    x -= w.nx * (gap - 0.002);
    y -= w.ny * (gap - 0.002);
    snapped = true;
  }
  return { x, y, rot, snapped };
}

// Separating-axis test for two rotated rectangles on the floor
export function overlaps(a: { x: number; y: number; rot: number; w: number; d: number }, b: typeof a, slack = 0.01) {
  const ca = corners(a.x, a.y, a.rot, a.w - slack, a.d - slack);
  const cb = corners(b.x, b.y, b.rot, b.w - slack, b.d - slack);
  for (const r of [a.rot, a.rot + 90, b.rot, b.rot + 90]) {
    const ax = Math.cos((r * Math.PI) / 180), ay = Math.sin((r * Math.PI) / 180);
    const pa = ca.map((c) => c.x * ax + c.y * ay);
    const pb = cb.map((c) => c.x * ax + c.y * ay);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

// ---- What each piece is ----

/** "Cedar chest, about 40 × 20 in" → a name and a size in meters, guessing what's missing. */
export function parseBrought(text: string): { name: string; w: number; d: number; h: number } {
  const name = text.split(/,|\(| - | — /)[0].trim() || text.trim();
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:[×xX*]|by)\s*(\d+(?:\.\d+)?)(?:\s*(?:[×xX*]|by)\s*(\d+(?:\.\d+)?))?\s*(in\b|inch|inches|"|cm|m\b|ft|feet|')?/);
  const unit = m?.[4] ?? "";
  const per = /cm/.test(unit) ? 0.01 : /^m$/.test(unit) ? 1 : /ft|feet|'/.test(unit) ? 0.3048 : 0.0254;
  const guess = { w: 0.9, d: 0.5, h: 0.75 };
  if (!m) return { name, ...guess };
  const w = Number(m[1]) * per, d = Number(m[2]) * per;
  const h = m[3] ? Number(m[3]) * per : Math.min(Math.max(w, d) * 0.6, 0.9);
  const ok = (v: number, lo: number, hi: number, dflt: number) => (v >= lo && v <= hi ? v : dflt);
  return { name, w: ok(w, 0.15, 4, guess.w), d: ok(d, 0.1, 3, guess.d), h: ok(h, 0.1, 2.5, guess.h) };
}

export function shapeOf(p: Piece, items: Map<string, RoomItem>): Shape {
  const product = p.product ? PRODUCT.get(p.product) : undefined;
  const item = p.item ? items.get(p.item) : undefined;
  if (product) {
    const wallKind = product.category === "art";
    return {
      name: product.name, w: product.w, d: product.d, h: product.h, mount: wallKind ? "wall" : "floor",
      flat: product.category === "rug", category: product.category, color: product.color, product, fixed: false,
    };
  }
  if (item) {
    return {
      name: item.name, w: item.width, d: item.depth, h: item.height, mount: p.wall !== undefined ? "wall" : "floor",
      flat: item.category === "rug", category: item.category, color: item.primary_color, fixed: isFixed(item),
    };
  }
  const b = parseBrought(p.brought ?? "");
  return { name: b.name, w: b.w, d: b.d, h: b.h, mount: "floor", flat: false, category: "other", color: "#cfdcd5", fixed: false };
}

// Architecture the scan lists as items: wall cladding and accent walls, fireplaces, built-in or floating
// shelves, a TV or AC mounted on the wall. A designer would never let a client carry these around.
const ARCHITECTURE = /\b(panel(l?ing)?|cladding|accent wall|feature wall|slats?|battens?|wainscot\w*|fireplace|mantel\w*|hearth|built[- ]?ins?|floating shelf|wall[- ]mounted|mounted|air ?con\w*|split[- ]system|radiator|alcove|niche)\b/i;

export function isFixed(item: RoomItem): boolean {
  if (ARCHITECTURE.test(item.name) || /\bbuilt[- ]?in\b|\bwall[- ]mounted\b/i.test(item.notes)) return true;
  if (item.category === "appliance" && item.elevation > 0.8) return true;
  if (item.category === "tv" && item.elevation > 0.3) return true;
  // floor-to-ceiling and paper-thin: a surface, not a piece
  if (item.category === "other" && item.depth <= 0.12 && item.height >= 1.8) return true;
  return false;
}

/** The wall an item is fixed to or hangs on (its center within 0.4 m). */
export function wallOf(item: { x: number; y: number }, walls: Wall[], within = 0.4): number | undefined {
  const near = nearestWall(walls, item.x, item.y);
  return near && near.dist < within ? near.wall.i : undefined;
}

/** In front of each door, a patch of floor kept clear so it can still open. */
export function doorZones(spec: RoomSpec, walls: Wall[]): Rect[] {
  return spec.openings.flatMap((o) => {
    const w = walls[o.wall];
    if (!w || !(o.type === "door" || o.type === "glass_door" || o.type === "opening")) return [];
    const t = o.offset + o.width / 2;
    const depth = Math.min(o.width, 0.9);
    return [{
      x: w.ax + w.dx * t + w.nx * (depth / 2), y: w.ay + w.dy * t + w.ny * (depth / 2),
      rot: (Math.atan2(-w.nx, w.ny) * 180) / Math.PI, w: o.width, d: depth, hard: true,
    }];
  });
}

/** What a new or moved floor piece can't sit on: other standing pieces, low fixed architecture, door clearances. */
export function blockers(pieces: Piece[], shapes: Record<string, Shape>, zones: Rect[], except?: string): Rect[] {
  const out: Rect[] = [...zones];
  for (const o of pieces) {
    const s = shapes[o.key];
    if (!o.placed || o.key === except || !s || s.flat) continue;
    if (s.fixed ? o.elev < 0.9 : s.mount === "floor") out.push({ x: o.x, y: o.y, rot: o.rot, w: s.w, d: Math.max(s.d, 0.05), hard: s.fixed });
  }
  return out;
}

export const clashes = (r: Rect, others: Rect[]) => others.some((o) => overlaps(r, o));

function inRect(x: number, y: number, o: Rect) {
  const a = (-o.rot * Math.PI) / 180;
  const dx = x - o.x, dy = y - o.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= o.w / 2 && Math.abs(ly) <= o.d / 2;
}

/** The share of r's footprint that sits on any of the others, sampled on an 8 × 5 grid. */
function covered(r: Rect, others: Rect[]) {
  if (!others.length) return 0;
  const a = (r.rot * Math.PI) / 180;
  let hit = 0;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) {
    const lx = ((i + 0.5) / 8 - 0.5) * r.w, ly = ((j + 0.5) / 5 - 0.5) * r.d;
    const x = r.x + lx * Math.cos(a) - ly * Math.sin(a), y = r.y + lx * Math.sin(a) + ly * Math.cos(a);
    if (others.some((o) => inRect(x, y, o))) hit++;
  }
  return hit / 40;
}

/**
 * A clear spot for a floor piece: the open floor nearest (x, y), trying each quarter turn. With nothing clear,
 * it goes back to a wall anyway and says so (`crowded`).
 */
export function clearSpot(
  shape: Shape, near: { x: number; y: number }, rot: number,
  footprint: { x: number; y: number }[], walls: Wall[], others: Rect[],
): Settled & { crowded: boolean } {
  const xs = footprint.map((p) => p.x), ys = footprint.map((p) => p.y);
  const tries: { x: number; y: number; d: number }[] = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.15)
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.15) tries.push({ x, y, d: Math.hypot(x - near.x, y - near.y) });
  tries.sort((a, b) => a.d - b.d);
  const turns = [rot, rot + 90, rot + 180, rot + 270].map((r) => ((r % 360) + 360) % 360);
  for (const t of tries) {
    for (const r of turns) {
      const s = settle(shape, t.x, t.y, r, footprint, walls);
      if (Math.hypot(s.x - t.x, s.y - t.y) > 0.3) continue; // pushed far off this spot: try the next
      if (!clashes({ x: s.x, y: s.y, rot: r, w: shape.w, d: shape.d }, others)) return { ...s, rot: r, crowded: false };
    }
  }
  // nowhere clear: back against a wall, facing in, wherever it crowds the fewest pieces and never
  // architecture or a doorway
  let best: { s: Settled; rot: number; score: number } | null = null;
  for (const w of walls) {
    const face = (Math.atan2(-w.nx, w.ny) * 180) / Math.PI;
    for (let t = shape.w / 2; t <= w.len - shape.w / 2 + 1e-6; t += 0.1) {
      const s = settle(shape, w.ax + w.dx * t + w.nx * (shape.d / 2 + 0.01), w.ay + w.dy * t + w.ny * (shape.d / 2 + 0.01), face, footprint, walls);
      const r = { x: s.x, y: s.y, rot: face, w: shape.w, d: shape.d };
      const hits = others.filter((o) => overlaps(r, o));
      if (hits.some((o) => o.hard)) continue;
      // how much of its footprint lands on something (sampled), then how far from the middle
      const score = covered(r, hits) * 100 + Math.hypot(s.x - near.x, s.y - near.y);
      if (!best || score < best.score) best = { s, rot: face, score };
    }
  }
  if (best) return { ...best.s, rot: best.rot, crowded: true };
  const c = roomCenter(footprint);
  return { ...settle(shape, c.x, c.y, rot, footprint, walls), crowded: true };
}

/** Which wall a scanned item hangs on, using the builder's rule (blender/build_room.py). */
export function hungOn(item: RoomItem, walls: Wall[]): number | undefined {
  if (!(item.elevation > 0.4 || WALL_HUNG.has(item.category))) return undefined;
  const near = nearestWall(walls, item.x, item.y);
  return near && near.dist < 0.35 ? near.wall.i : undefined;
}

export function roomCenter(footprint: { x: number; y: number }[]) {
  const xs = footprint.map((p) => p.x), ys = footprint.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);

interface Inputs {
  spec: RoomSpec;
  bins: Record<string, string | undefined>;
  absent: string[];
  brought: string[];
}

/** The starting layout: kept pieces where they are, moved and brought pieces in the tray, removed ones gone. */
export function initialLayout({ spec, bins, absent, brought }: Inputs): Layout {
  const walls = wallsOf(spec.footprint);
  const c = roomCenter(spec.footprint);
  const pieces: Piece[] = [];
  for (const it of spec.items) {
    if (absent.includes(it.id) || bins[it.id] === "remove") continue;
    const fixed = isFixed(it);
    pieces.push({
      key: it.id, source: "room", item: it.id, x: it.x, y: it.y, rot: it.rotation, elev: it.elevation,
      wall: fixed ? wallOf(it, walls) : hungOn(it, walls), placed: fixed || bins[it.id] !== "move",
    });
  }
  brought.forEach((text, i) => {
    pieces.push({ key: `b-${slug(text) || i}`, source: "brought", brought: text, x: c.x, y: c.y, rot: 0, elev: 0, placed: false });
  });
  return { v: 1, pieces };
}

/**
 * A saved layout brought up to date with the latest sorting: pieces sorted Remove
 * since then leave, new scanned or brought pieces join, everything else stays put.
 */
export function reconcile(saved: Layout, fresh: Layout, inputs: Inputs): Layout {
  const items = new Set(inputs.spec.items.map((i) => i.id));
  const gone = (p: Piece) =>
    p.source === "room" && (!p.item || !items.has(p.item) || inputs.absent.includes(p.item) || inputs.bins[p.item] === "remove");
  const kept = saved.pieces.filter((p) => !gone(p) && (p.source !== "catalog" || (p.product && PRODUCT.has(p.product))));
  const have = new Set(kept.map((p) => p.key));
  // fixed architecture always stands where the scan put it, whatever an older layout says
  const walls = wallsOf(inputs.spec.footprint);
  const byId = new Map(inputs.spec.items.map((i) => [i.id, i]));
  const pinned = kept.map((p) => {
    const it = p.item ? byId.get(p.item) : undefined;
    return it && isFixed(it) && !p.product
      ? { ...p, x: it.x, y: it.y, rot: it.rotation, elev: it.elevation, wall: wallOf(it, walls), placed: true }
      : p;
  });
  return { v: 1, pieces: [...pinned, ...fresh.pieces.filter((p) => !have.has(p.key))] };
}

/**
 * Pin the pieces the room model marks as built in (glb extra homebody_fixed): back where the scan put them,
 * on their wall, in the room. Returns the same layout when nothing changes.
 */
export function pinFixed(layout: Layout, spec: RoomSpec, fixed: Map<string, number | undefined>): Layout {
  const walls = wallsOf(spec.footprint);
  const byId = new Map(spec.items.map((i) => [i.id, i]));
  let changed = false;
  const pieces = layout.pieces.map((p) => {
    const it = p.item ? byId.get(p.item) : undefined;
    if (!it || !fixed.has(it.id) || p.product) return p;
    const wall = fixed.get(it.id) ?? wallOf(it, walls);
    if (p.placed && p.x === it.x && p.y === it.y && p.rot === it.rotation && p.elev === it.elevation && p.wall === wall) return p;
    changed = true;
    return { ...p, x: it.x, y: it.y, rot: it.rotation, elev: it.elevation, wall, placed: true };
  });
  return changed ? { ...layout, pieces } : layout;
}

export function readLayout(id: string): Layout | null {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(id)) ?? "null");
    return raw && raw.v === 1 && Array.isArray(raw.pieces) ? (raw as Layout) : null;
  } catch {
    return null;
  }
}

export function writeLayout(id: string, layout: Layout) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(layout));
  } catch {}
}

export const kindOfPiece = (s: Shape) => kindOf(s.category);

/** Running cost: sample products in the room; their own pieces and what they bring cost nothing. */
export function totalCost(layout: Layout) {
  let total = 0, count = 0;
  for (const p of layout.pieces) {
    const pr = p.product ? PRODUCT.get(p.product) : undefined;
    if (pr) {
      total += pr.price;
      count++;
    }
  }
  return { total, count };
}
