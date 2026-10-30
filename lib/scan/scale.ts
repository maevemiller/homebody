import { RoomSpec } from "./spec";

// The scale check: when a photo-built room had no real measurement, the owner
// confirms or corrects one door's height and the whole room is scaled to match.

export const STANDARD_DOOR_M = 80 * 0.0254; // 80 in, the usual US interior door

/** Reads one length like "7 ft", "6'8\"", "84 in", "203 cm" or "2.1 m" into meters, or null. */
export function parseLength(text: string): number | null {
  const t = text.toLowerCase().replace(/[′’]/g, "'").replace(/[″”]/g, '"').trim();
  const ftIn = /(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')\s*(?:(\d+(?:\.\d+)?)\s*(?:in|inches|")?)?/.exec(t);
  if (ftIn) return Number(ftIn[1]) * 0.3048 + Number(ftIn[2] ?? 0) * 0.0254;
  const unit = /(\d+(?:\.\d+)?)\s*(in|inches|"|cm|mm|m|metres?|meters?)\b|(\d+(?:\.\d+)?)\s*"/.exec(t);
  if (unit) {
    const v = Number(unit[1] ?? unit[3]);
    const u = unit[2] ?? '"';
    if (u === "cm") return v / 100;
    if (u === "mm") return v / 1000;
    if (u.startsWith("m")) return v;
    return v * 0.0254;
  }
  // A bare number: guess the unit from how big it is
  const bare = /^(\d+(?:\.\d+)?)$/.exec(t);
  if (!bare) return null;
  const v = Number(bare[1]);
  if (v > 120) return v / 100; // centimeters
  if (v > 12) return v * 0.0254; // inches
  if (v > 4) return v * 0.3048; // feet
  return v; // meters
}

/** Scales every length in the spec by factor, keeping the room's proportions. */
export function scaleSpec(spec: RoomSpec, factor: number, reason: string): RoomSpec {
  const f = (v: number) => v * factor;
  return {
    ...spec,
    footprint: spec.footprint.map((p) => ({ x: f(p.x), y: f(p.y) })),
    ceiling_height: f(spec.ceiling_height),
    openings: spec.openings.map((o) => ({ ...o, offset: f(o.offset), width: f(o.width), height: f(o.height), sill: f(o.sill) })),
    items: spec.items.map((it) => ({
      ...it,
      x: f(it.x),
      y: f(it.y),
      width: f(it.width),
      depth: f(it.depth),
      height: f(it.height),
      elevation: f(it.elevation),
    })),
    scale_basis: `${spec.scale_basis} Rescaled ×${factor.toFixed(3)}: ${reason}.`,
  };
}

/** The owner's typed sides in meters; null or missing when they didn't know. Length is the longer side. */
export interface Sides {
  length?: number | null;
  width?: number | null;
}

/** Reads typed sides from the upload form, ignoring anything outside a plausible room. */
export function sidesFromForm(form: FormData): Sides | undefined {
  const read = (key: string) => {
    const v = Number(form.get(key));
    return form.get(key) && Number.isFinite(v) && v >= 1.5 && v <= 40 ? v : null;
  };
  const sides = { length: read("length"), width: read("width") };
  return sides.length || sides.width ? sides : undefined;
}

const span = (s: RoomSpec) => {
  const xs = s.footprint.map((p) => p.x);
  const ys = s.footprint.map((p) => p.y);
  return { lo: { x: Math.min(...xs), y: Math.min(...ys) }, hi: { x: Math.max(...xs), y: Math.max(...ys) } };
};

/**
 * Makes the room the size the owner typed: the walls stretch to the typed sides, and furniture and openings move with
 * them at their own sizes (furniture is read from standard sizes and is usually right; room depth is what photos
 * misjudge). Only when the read is off by more than a third overall does the whole room scale first, furniture too.
 */
export function fitToSides(spec: RoomSpec, sides: Sides | undefined): RoomSpec {
  let long = sides?.length || null;
  let short = sides?.width || null;
  if (long && short && short > long) [long, short] = [short, long];
  if (!long && !short) return spec;
  const b = span(spec);
  const size = { x: b.hi.x - b.lo.x, y: b.hi.y - b.lo.y };
  if (!(size.x > 0 && size.y > 0)) return spec;
  const xLong = size.x >= size.y;
  const ratios = [long && long / Math.max(size.x, size.y), short && short / Math.min(size.x, size.y)].filter((r): r is number => !!r);
  const factor = Math.exp(ratios.reduce((t, r) => t + Math.log(r), 0) / ratios.length);
  const typed = [long && `${long.toFixed(2)} m long`, short && `${short.toFixed(2)} m wide`].filter(Boolean).join(", ");
  const out = factor < 0.75 || factor > 4 / 3 ? scaleSpec(spec, factor, `the owner's sides (${typed}) were far from the read`) : spec;

  // Then stretch each known side the rest of the way
  const { lo, hi } = span(out);
  const now = { x: hi.x - lo.x, y: hi.y - lo.y };
  const want = { x: xLong ? long : short, y: xLong ? short : long };
  const rx = want.x ? want.x / now.x : 1;
  const ry = want.y ? want.y / now.y : 1;
  if (Math.abs(rx - 1) < 0.005 && Math.abs(ry - 1) < 0.005) return out;
  const fp = out.footprint;
  const footprint = fp.map((p) => ({ x: p.x * rx, y: p.y * ry }));
  const wallLen = (pts: { x: number; y: number }[], i: number) => {
    const a = pts[i];
    const c = pts[(i + 1) % pts.length];
    return a && c ? Math.hypot(c.x - a.x, c.y - a.y) : 0;
  };
  // Pieces whose near edge is within 0.3 m of a wall keep that distance, so a sofa or bed with its back on a wall
  // stays on it; the rest move in proportion, so a centered rug stays centered
  const NEAR = 0.3;
  const place = (v: number, half: number, a: number, z: number, r: number) => {
    const toA = v - half - a;
    const toZ = z - v - half;
    if (Math.min(toA, toZ) > NEAR) return a * r + (v - a) * r;
    return toA <= toZ ? a * r + (v - a) : z * r - (z - v);
  };
  const items = out.items.map((it) => {
    // half the piece's footprint along x and y, for its rotation
    const rad = (it.rotation * Math.PI) / 180;
    const c = Math.abs(Math.cos(rad));
    const sn = Math.abs(Math.sin(rad));
    const hx = (c * it.width + sn * it.depth) / 2;
    const hy = (sn * it.width + c * it.depth) / 2;
    return { ...it, x: place(it.x, hx, lo.x, hi.x, rx), y: place(it.y, hy, lo.y, hi.y, ry) };
  });
  const openings = out.openings.map((o) => {
    const was = wallLen(fp, o.wall);
    const len = wallLen(footprint, o.wall);
    if (!was || !len) return o;
    return { ...o, offset: Math.max(0, Math.min(o.offset * (len / was), len - o.width)) };
  });
  return {
    ...out,
    footprint,
    openings,
    items: items.map((it) => (it.category === "curtains" ? hangAtWindow(it, footprint, openings) : it)),
    scale_basis: `${out.scale_basis} Walls fitted to the owner's sides (${typed}).`,
  };
}

/** Curtains belong to a window: center them on the nearest window on their wall, at the same distance from the wall. */
function hangAtWindow<T extends { x: number; y: number }>(item: T, footprint: { x: number; y: number }[], openings: RoomSpec["openings"]): T {
  const walls = footprint.map((a, i) => {
    const b = footprint[(i + 1) % footprint.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const t = (item.x - a.x) * dir.x + (item.y - a.y) * dir.y;
    const off = Math.abs((item.x - a.x) * dir.y - (item.y - a.y) * dir.x);
    return { i, a, dir, t, off, len };
  });
  const wall = walls.filter((w) => w.t >= 0 && w.t <= w.len).sort((p, q) => p.off - q.off)[0];
  if (!wall) return item;
  const windows = openings.filter((o) => o.wall === wall.i && (o.type === "window" || o.type === "glass_door"));
  const mid = (o: (typeof openings)[number]) => o.offset + o.width / 2;
  const win = windows.sort((p, q) => Math.abs(mid(p) - wall.t) - Math.abs(mid(q) - wall.t))[0];
  if (!win) return item;
  const shift = mid(win) - wall.t;
  return { ...item, x: item.x + wall.dir.x * shift, y: item.y + wall.dir.y * shift };
}
