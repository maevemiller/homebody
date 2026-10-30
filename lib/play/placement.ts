import type { RoomSpec } from "@/lib/scan/spec";
import { kindOf } from "./catalog";
import { blockers, clashes, overlaps, settle, wallsOf, type Piece, type Rect, type Shape, type Wall } from "./layout";

// Where a designer would put a new piece, not just where there's floor (docs/reference/interior-design/
// craft-standards.md): seating faces or frames the focal point (a TV wall, a fireplace, the main window);
// 36" walkways; 36" from a dining table's edge behind its chairs; a coffee table 14–18" in front of the
// sofa; lamps beside seating; shelves backed against a wall and clear of windows. Never on other furniture,
// never in a doorway. Returns null when nowhere is any good: the caller sends the piece to the tray.

const WALK = 0.91; // 36"
const SQUEEZE = 0.76; // 30": anything tighter is a pinch point
const DINING_CLEAR = 0.91; // table edge to the wall behind a chair

export interface Focal {
  x: number;
  y: number;
  // the direction the focal point faces into the room
  nx: number;
  ny: number;
  what: string;
}

interface Ctx {
  spec: RoomSpec;
  footprint: { x: number; y: number }[];
  pieces: Piece[];
  shapes: Record<string, Shape>;
  zones: Rect[];
}

const front = (rot: number) => ({ x: -Math.sin((rot * Math.PI) / 180), y: Math.cos((rot * Math.PI) / 180) });
const inflate = (r: Rect, g: number): Rect => ({ ...r, w: r.w + 2 * g, d: r.d + 2 * g });
const rectOf = (p: Piece, s: Shape): Rect => ({ x: p.x, y: p.y, rot: p.rot, w: s.w, d: Math.max(s.d, 0.05) });

/** The room's one focal point: a TV, then a fireplace, then the widest window. */
export function focalPoint(spec: RoomSpec, walls: Wall[], pieces: Piece[], shapes: Record<string, Shape>): Focal | null {
  const placed = pieces.filter((p) => p.placed && shapes[p.key]);
  const named = (re: RegExp, cat?: string) =>
    placed.find((p) => (cat && shapes[p.key].category === cat) || re.test(shapes[p.key].name));
  const tv = named(/\btv\b|television/i, "tv");
  const fire = named(/fireplace|hearth/i);
  const hit = tv ?? fire;
  if (hit) {
    const f = front(hit.rot);
    return { x: hit.x, y: hit.y, nx: f.x, ny: f.y, what: tv ? "tv" : "fireplace" };
  }
  const win = [...spec.openings].filter((o) => o.type === "window" || o.type === "glass_door").sort((a, b) => b.width - a.width)[0];
  const w = win && walls[win.wall];
  if (!win || !w) return null;
  const t = win.offset + win.width / 2;
  return { x: w.ax + w.dx * t, y: w.ay + w.dy * t, nx: w.nx, ny: w.ny, what: "window" };
}

/** The main seat: the widest sofa, else the widest chair. */
function mainSeat(pieces: Piece[], shapes: Record<string, Shape>) {
  const seats = pieces.filter((p) => p.placed && shapes[p.key] && ["sofa", "chair"].includes(kindOf(shapes[p.key].category) ?? ""));
  seats.sort((a, b) => (kindOf(shapes[b.key].category) === "sofa" ? 1 : 0) - (kindOf(shapes[a.key].category) === "sofa" ? 1 : 0) || shapes[b.key].w - shapes[a.key].w);
  return seats[0];
}

// distance from a point to the nearest wall, and how far the piece's back is from one
function wallGap(walls: Wall[], x: number, y: number) {
  let best = Infinity;
  for (const w of walls) {
    const t = Math.max(0, Math.min(w.len, (x - w.ax) * w.dx + (y - w.ay) * w.dy));
    best = Math.min(best, Math.hypot(w.ax + w.dx * t - x, w.ay + w.dy * t - y));
  }
  return best;
}

export function bestSpot(piece: Piece, shape: Shape, ctx: Ctx): { x: number; y: number; rot: number } | null {
  const { spec, footprint, pieces, shapes, zones } = ctx;
  const walls = wallsOf(footprint);
  const kind = kindOf(shape.category) ?? "other";
  const others = blockers(pieces, shapes, zones, piece.key);
  const focal = focalPoint(spec, walls, pieces.filter((p) => p.key !== piece.key), shapes);
  const seat = kind === "sofa" ? undefined : mainSeat(pieces.filter((p) => p.key !== piece.key), shapes);
  const seatShape = seat ? shapes[seat.key] : undefined;

  // dining tables keep 36" clear all round for their chairs; a sofa stays out of the dining end altogether
  const dining = pieces
    .filter((p) => p.placed && p.key !== piece.key && shapes[p.key]?.category === "dining_table")
    .map((p) => inflate(rectOf(p, shapes[p.key]), kind === "sofa" ? DINING_CLEAR + 0.4 : DINING_CLEAR));
  // other standing furniture, for walkway checks (not low architecture or doorways, which are hard blocks)
  const furniture = others.filter((o) => !o.hard);
  const windows = spec.openings.filter((o) => o.type === "window" || o.type === "glass_door");

  const xs = footprint.map((p) => p.x), ys = footprint.map((p) => p.y);
  const step = 0.15;
  const turns = [0, 90, 180, 270];
  let best: { x: number; y: number; rot: number; score: number } | null = null;

  for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += step) {
      const rots = [...turns];
      // seating may also turn to face the focal point exactly (to the nearest 15°)
      if (focal && (kind === "sofa" || kind === "chair")) {
        const a = (Math.atan2(-(focal.x - x), focal.y - y) * 180) / Math.PI;
        rots.push(Math.round(a / 15) * 15);
      }
      if (seat && (kind === "table" || kind === "rug")) rots.push(seat.rot);
      for (const r0 of rots) {
        const rot = ((r0 % 360) + 360) % 360;
        const s = settle(shape, x, y, rot, footprint, walls);
        if (Math.hypot(s.x - x, s.y - y) > 0.2) continue;
        const me: Rect = { x: s.x, y: s.y, rot, w: shape.w, d: shape.d };
        if (!shape.flat && clashes(me, others)) continue;
        if (!shape.flat && dining.some((z) => overlaps(me, z))) continue;
        const score = scoreSpot(me, s.snapped);
        if (score === null) continue;
        if (!best || score < best.score) best = { x: s.x, y: s.y, rot, score };
      }
    }
  }
  return best ? { x: best.x, y: best.y, rot: best.rot } : null;

  // lower is better; null rules the spot out
  function scoreSpot(me: Rect, flush: boolean): number | null {
    const f = front(me.rot);
    let score = 0;

    // walkways: a gap under 30" to another piece is a pinch point, under 36" a tight one.
    // Tables and lamps belong right beside seating, so they're exempt from it there.
    const pairs = kind === "table" || kind === "lamp";
    for (const o of furniture) {
      if (pairs && seat && Math.hypot(o.x - seat.x, o.y - seat.y) < 0.01) continue;
      if (overlaps(inflate(me, 0.04), o)) {
        if (!pairs) score += 1.5; // pressed up against another piece
        continue;
      }
      if (overlaps(inflate(me, SQUEEZE / 2), o)) score += pairs ? 0.3 : 3;
      else if (overlaps(inflate(me, WALK / 2), o)) score += pairs ? 0 : 0.8;
    }
    // a little way off a wall is wasted floor and a pinch: flush or a full walkway
    const gapWall = wallGap(walls, me.x, me.y) - Math.min(me.w, me.d) / 2;
    if (!flush && gapWall > 0.05 && gapWall < SQUEEZE) score += shape.flat ? 0 : 1.2;

    // the piece's back: is it against a wall?
    const back = { x: me.x - f.x * (me.d / 2 + 0.08), y: me.y - f.y * (me.d / 2 + 0.08) };
    const backToWall = wallGap(walls, back.x, back.y) < 0.15 && flush;
    // a tall piece backed onto a window wall blocks the light
    const blocksWindow = (me2: Rect) =>
      windows.some((o) => {
        const w = walls[o.wall];
        if (!w) return false;
        const along = (me2.x - w.ax) * w.dx + (me2.y - w.ay) * w.dy;
        const off = (me2.x - w.ax) * w.nx + (me2.y - w.ay) * w.ny;
        return off < me2.d / 2 + 0.3 && along + me2.w / 2 > o.offset && along - me2.w / 2 < o.offset + o.width;
      });

    switch (kind) {
      case "sofa":
      case "chair": {
        if (focal) {
          const vx = focal.x - me.x, vy = focal.y - me.y;
          const dist = Math.hypot(vx, vy) || 1;
          const face = (f.x * vx + f.y * vy) / dist;
          if (kind === "sofa") {
            if (face < 0.5) return null; // a sofa faces the focal point
            score += (1 - face) * 8;
            score += Math.abs(Math.min(Math.max(dist, 2.0), 3.2) - dist) * 2; // a comfortable viewing distance
          } else {
            // chairs face it, or frame it from the side
            if (face < -0.1) return null;
            score += (1 - Math.max(face, 0.6)) * 4;
            score += Math.abs(Math.min(Math.max(dist, 1.6), 3.2) - dist) * 1.5;
          }
          // and they don't sit in front of it
          const toFocal = (me.x - focal.x) * focal.nx + (me.y - focal.y) * focal.ny;
          if (toFocal < 0.9) return null;
        }
        // a chair keeps company with the main seat
        if (kind === "chair" && seat) score += Math.max(0, Math.hypot(me.x - seat.x, me.y - seat.y) - 2) * 0.8;
        if (backToWall) score -= 0.8;
        if (kind === "sofa" && shape.h > 0.9 && blocksWindow(me)) score += 2;
        break;
      }
      case "table": {
        if (seat && seatShape) {
          // 14–18" in front of the seat, centered on it, turned the same way
          const sf = front(seat.rot);
          const gap = 0.4;
          const ix = seat.x + sf.x * (seatShape.d / 2 + gap + shape.d / 2);
          const iy = seat.y + sf.y * (seatShape.d / 2 + gap + shape.d / 2);
          score += Math.hypot(me.x - ix, me.y - iy) * 4;
          if (Math.abs(((me.rot - seat.rot) % 180 + 180) % 180) > 1) score += 1;
        }
        break;
      }
      case "lamp": {
        // beside an end of the seat, ideally in a corner
        if (seat && seatShape) {
          const ax = Math.cos((seat.rot * Math.PI) / 180), ay = Math.sin((seat.rot * Math.PI) / 180);
          const ends = [1, -1].map((k) => ({ x: seat.x + ax * k * (seatShape.w / 2 + 0.3), y: seat.y + ay * k * (seatShape.w / 2 + 0.3) }));
          score += Math.min(...ends.map((e) => Math.hypot(me.x - e.x, me.y - e.y))) * 3;
        }
        if (wallGap(walls, me.x, me.y) > 0.6) score += 0.5;
        break;
      }
      case "shelf": {
        if (!backToWall) return null; // a bookcase stands against a wall
        if (blocksWindow(me)) return null;
        if (focal && Math.hypot(me.x - focal.x, me.y - focal.y) < 1) score += 1;
        break;
      }
      case "rug": {
        // under the seating group, between the seat and the focal point
        const anchor = seat ?? null;
        if (anchor && focal) {
          const cx = (anchor.x + focal.x) / 2, cy = (anchor.y + focal.y) / 2;
          score += Math.hypot(me.x - cx, me.y - cy) * 2;
          if (Math.abs(((me.rot - anchor.rot) % 180 + 180) % 180) > 1) score += 1.5;
        } else if (anchor) {
          score += Math.hypot(me.x - anchor.x, me.y - anchor.y);
        }
        // 12–18" of floor showing at the walls
        if (wallGap(walls, me.x, me.y) < Math.min(me.w, me.d) / 2 + 0.25) score += 2;
        break;
      }
      default: {
        // pieces they bring: against a wall, out of the way
        if (!backToWall) score += 1;
        break;
      }
    }
    return score;
  }
}
