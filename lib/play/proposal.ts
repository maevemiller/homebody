import type { RoomItem, RoomSpec } from "@/lib/scan/spec";
import { failures, hardFailures, mainSeatOf, validate, type Finding } from "@/lib/design/rules";
import { PRODUCTS, roleOfProduct, type Product } from "./catalog";
import { doorZones, shapeOf, wallsOf, type Layout, type Piece, type Shape, type Wall } from "./layout";
import { bestSpot } from "./placement";
import { ceilingLights, roleOfShape, toDesign, toRoom } from "./design";
import { neverMaterials, type BriefRead, type Prefs } from "./prefs";
import { rank, rankReason, type RankCtx } from "./rank";
import type { TasteState } from "@/lib/taste/visual";

// The room starts furnished: a designer's first proposal from the confirmed brief and the room. Kept pieces
// stay where they are and removed ones are gone; "Keep, move it" pieces get a spot first; then each gap in the
// program is filled from the catalog in order (seating, rug, tables, light, storage, the walls), placed by
// function (placement.ts), and checked against the 15 rules (lib/design/rules.ts): a piece that adds a hard
// failure is never proposed, and one that adds a soft failure gives way to the next candidate that doesn't.

export interface Slot {
  role: string;
  // why the room needs it, in the designer's words
  need: string;
}

export interface ProposalResult {
  layout: Layout;
  added: { key: string; product: string; why: string }[];
  moved: string[];
  skipped: { role: string; why: string }[];
  findings: Finding[];
}

type RoomKind = "living" | "bedroom" | "office";

export function roomKind(spec: RoomSpec, brief: BriefRead): RoomKind {
  const name = `${spec.name} ${spec.summary ?? ""}`.toLowerCase();
  if (/\bbed ?room\b|\bbed\b/.test(name)) return "bedroom";
  if (/\boffice|study\b/.test(name)) return "office";
  if (/\b(home office|study)\b/.test(brief.program.join(" ")) && !/living|lounge|sofa/.test(name)) return "office";
  return "living";
}

const area = (spec: RoomSpec) => {
  const fp = spec.footprint;
  let a = 0;
  for (let i = 0; i < fp.length; i++) {
    const p = fp[i], q = fp[(i + 1) % fp.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
};

/** What the room needs to do its job, from its type, its size and the brief's program lines. */
export function program(spec: RoomSpec, brief: BriefRead): Slot[] {
  const kind = roomKind(spec, brief);
  const said = `${brief.program.join(" ")} ${brief.text}`;
  const big = area(spec) > 14;
  const slots: Slot[] =
    kind === "bedroom"
      ? [
          { role: "rug", need: "something soft underfoot beside the bed" },
          { role: "side_table", need: "a landing spot by the bed (rule 3)" },
          { role: "lamp", need: "a second light at a lower height (rule 11)" },
          { role: "storage", need: "somewhere for clothes to live" },
          { role: "art", need: "something at eye level (rule 12)" },
        ]
      : kind === "office"
        ? [
            { role: "desk", need: "a proper place to work" },
            { role: "chair", need: "a second seat for reading or a break" },
            { role: "lamp", need: "task light at the desk (rule 11)" },
            { role: "shelf", need: "storage within reach of the desk" },
            { role: "rug", need: "to soften the room and the sound" },
            { role: "art", need: "something at eye level (rule 12)" },
          ]
        : [
            { role: "sofa", need: "the main seat, facing the focal point (rule 2)" },
            { role: "chair", need: "a second seat for conversation (rule 3)" },
            { role: "rug", need: "to anchor the seating group (rule 5)" },
            { role: "coffee_table", need: "a surface in reach of the sofa (rule 4)" },
            { role: "side_table", need: "a landing spot for the chair (rule 3)" },
            { role: "lamp", need: "a reading light by the main seat (rules 3 and 11)" },
            { role: "art", need: "something at eye level (rule 12)" },
          ];
  if (kind === "living") {
    if (/\b(work|desk|laptop|from home|wfh|zoom|calls)\b/.test(said) && big) slots.push({ role: "desk", need: "your brief: a place to work" });
    if (/\b(books?|library|reading)\b/.test(said)) slots.push({ role: "shelf", need: "your brief: somewhere for books" });
    if (/\b(storage|clutter|toys|hide)\b/.test(said)) slots.push({ role: "storage", need: "your brief: storage that hides things" });
    if (/\b(host|guests|entertain|friends over|dinner parties)\b/.test(said) && big) slots.push({ role: "chair", need: "your brief: seats for guests" });
  }
  return slots;
}

const ROOM_ROLE_SKIP = new Set(["other", "dining_chair", "dining_table"]);

/** The program minus what's already there (theirs, kept or moved, and anything already proposed). */
export function gaps(slots: Slot[], have: string[]): Slot[] {
  const left = [...have];
  return slots.filter((s) => {
    const i = left.indexOf(s.role);
    if (i >= 0) {
      left.splice(i, 1);
      return false;
    }
    return true;
  });
}

interface Input {
  spec: RoomSpec;
  layout: Layout;
  items: Map<string, RoomItem>;
  bins: Record<string, string | undefined>;
  brief: BriefRead;
  prefs: Prefs;
  taste?: TasteState;
  wall?: string;
  // pieces the room model marks as built in
  builtIn?: Set<string>;
}

let seq = 0;
const newKey = () => `c-${Date.now().toString(36)}${(seq++).toString(36)}`;

/** A clear stretch of wall for a hung piece: behind the main seat if there's room, else the longest clear wall. */
function hangSpot(spec: RoomSpec, walls: Wall[], pieces: Piece[], shapes: Record<string, Shape>, shape: Shape) {
  const elev = Math.max(0.9, 1.47 - shape.h / 2);
  const hung = pieces.filter((o) => o.placed && o.wall !== undefined && shapes[o.key]);
  const floor = pieces.filter((o) => o.placed && shapes[o.key] && shapes[o.key].mount === "floor" && !shapes[o.key].flat);
  const seat = mainSeatOf(toDesign(pieces, shapes, new Map()));
  let best: { x: number; y: number; rot: number; wall: number; elev: number; score: number } | null = null;
  for (const w of walls) {
    if (w.len < shape.w + 0.3) continue;
    for (let t = shape.w / 2 + 0.15; t <= w.len - shape.w / 2 - 0.15; t += 0.1) {
      const blocked = spec.openings.some((op) => op.wall === w.i && t + shape.w / 2 > op.offset - 0.08 && t - shape.w / 2 < op.offset + op.width + 0.08 && elev < op.sill + op.height && elev + shape.h > op.sill);
      if (blocked) continue;
      const clash = hung.some((o) => {
        if (o.wall !== w.i) return false;
        const os = shapes[o.key];
        const along = (o.x - w.ax) * w.dx + (o.y - w.ay) * w.dy;
        return Math.abs(along - t) - (os.w + shape.w) / 2 < 0.12 && Math.min(o.elev + os.h, elev + shape.h) - Math.max(o.elev, elev) > -0.05;
      });
      if (clash) continue;
      const x = w.ax + w.dx * t + w.nx * (shape.d / 2 + 0.004), y = w.ay + w.dy * t + w.ny * (shape.d / 2 + 0.004);
      // anything tall standing in front of it hides it
      const hidden = floor.some((o) => shapes[o.key].h > elev - 0.05 && Math.hypot(o.x - x, o.y - y) < shapes[o.key].w / 2 + shape.w / 2 && ((o.x - w.ax) * w.nx + (o.y - w.ay) * w.ny) < 0.8);
      if (hidden) continue;
      let score = Math.abs(t - w.len / 2) * 0.5;
      if (seat) score += Math.hypot(seat.x - x, seat.y - y) * 0.6;
      if (!best || score < best.score) best = { x, y, rot: (Math.atan2(-w.nx, w.ny) * 180) / Math.PI, wall: w.i, elev, score };
    }
  }
  return best;
}

/** Size limits that make a candidate right for this room and this group, before placement is even tried. */
function fits(p: Product, role: string, spec: RoomSpec, design: ReturnType<typeof toDesign>): boolean {
  const xs = spec.footprint.map((q) => q.x), ys = spec.footprint.map((q) => q.y);
  const long = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const short = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (role === "sofa") return p.w <= long * 0.75 && p.d <= short * 0.42;
  if (role === "rug") return p.w <= long - 0.6 && p.d <= short - 0.5;
  if (role === "coffee_table") {
    const sofa = design.find((q) => q.role === "sofa");
    if (!sofa) return true;
    const ratio = Math.max(p.w, p.d) / sofa.w;
    return ratio >= 0.4 && ratio <= 0.78;
  }
  if (role === "chair") return p.sub !== "dining_chair";
  return true;
}

/**
 * Furnish the room: place the "move it" pieces, then fill each gap with the best-ranked product that places well
 * and keeps the rules. Pieces she chose or kept are never touched.
 */
export function propose({ spec, layout, items, bins, brief, prefs, taste, wall, builtIn }: Input): ProposalResult {
  const walls = wallsOf(spec.footprint);
  const zones = doorZones(spec, walls);
  let pieces = layout.pieces.map((p) => ({ ...p }));
  const shapeFor = (p: Piece) => {
    const s = shapeOf(p, items);
    return p.item && builtIn?.has(p.item) && !p.product ? { ...s, fixed: true } : s;
  };
  const shapesOf = (ps: Piece[]) => Object.fromEntries(ps.map((p) => [p.key, shapeFor(p)])) as Record<string, Shape>;
  const household = brief.household;
  const check = (ps: Piece[]) => {
    const sh = shapesOf(ps);
    return validate(toRoom(spec, ps, sh, { wall, household }), toDesign(ps, sh, items, bins), ceilingLights(spec));
  };
  const moved: string[] = [];

  // 1. their "Keep, move it" pieces first: they're already paid for
  for (const p of pieces.filter((q) => !q.placed && q.source === "room")) {
    const sh = shapesOf(pieces);
    const shape = sh[p.key];
    if (!shape || shape.fixed || shape.mount === "wall") continue;
    const at = bestSpot(p, shape, { spec, footprint: spec.footprint, pieces, shapes: sh, zones });
    if (!at) continue;
    pieces = pieces.map((q) => (q.key === p.key ? { ...q, ...at, wall: undefined, elev: 0, placed: true, why: "Yours, moved to where it works best" } : q));
    moved.push(p.key);
  }

  // 2. what's missing
  const sh0 = shapesOf(pieces);
  const have = pieces.filter((p) => !sh0[p.key]?.fixed).map((p) => roleOfShape(sh0[p.key])).filter((r) => !ROOM_ROLE_SKIP.has(r));
  const todo = gaps(program(spec, brief), have);
  const design0 = toDesign(pieces, sh0, items, bins);
  const anchors = [...design0.filter((d) => d.lock !== "free").sort((a, b) => b.w * b.h - a.w * a.h).map((d) => d.color).slice(0, 3), wall ?? spec.walls.color];
  const ctx: RankCtx = { taste, prefs, brief, anchors, never: neverMaterials(brief) };
  const inRoom = new Set(pieces.flatMap((p) => (p.product ? [p.product] : [])));
  const added: ProposalResult["added"] = [];
  const skipped: ProposalResult["skipped"] = [];
  // rug before the tables, so the coffee table lands on it; walls last, once the floor is set
  const ORDER = ["sofa", "desk", "chair", "rug", "coffee_table", "side_table", "lamp", "storage", "shelf", "art"];
  todo.sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));

  for (const slot of todo) {
    const design = toDesign(pieces, shapesOf(pieces), items, bins);
    const pool = PRODUCTS.filter((p) => roleOfProduct(p) === slot.role && !inRoom.has(p.id) && fits(p, slot.role, spec, design))
      .map((p) => ({ p, score: rank(p, ctx) }))
      .filter((x) => x.score > -50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const before = check(pieces);
    const hardBefore = hardFailures(before).length;
    const softBefore = new Set(failures(before).map((f) => f.rule));
    let fallback: { pieces: Piece[]; key: string; product: Product; why: string } | null = null;
    let done = false;
    for (const { p } of pool) {
      const piece: Piece = { key: newKey(), source: "catalog", product: p.id, x: 0, y: 0, rot: 0, elev: 0, placed: true, proposed: true };
      const shape = shapeOf(piece, items);
      const sh = { ...shapesOf(pieces), [piece.key]: shape };
      const withMe = [...pieces, piece];
      const at = shape.mount === "wall"
        ? hangSpot(spec, walls, pieces, sh, shape)
        : (() => {
            const s = bestSpot(piece, shape, { spec, footprint: spec.footprint, pieces: withMe, shapes: sh, zones });
            return s ? { ...s, wall: undefined, elev: 0 } : null;
          })();
      if (!at) continue;
      const reason = rankReason(p, ctx);
      const why = `${cap(slot.need)}${reason ? `; ${reason}` : ""}`;
      const next = [...pieces, { ...piece, x: at.x, y: at.y, rot: at.rot, wall: at.wall, elev: at.elev, why }];
      const after = check(next);
      if (hardFailures(after).length > hardBefore) continue;
      // a new soft failure that names this piece: try the next one, but keep this as a fallback
      const mine = failures(after).filter((f) => !softBefore.has(f.rule) && f.keys?.includes(piece.key) && [3, 4, 5, 6, 10, 12, 14].includes(f.rule));
      if (mine.length) {
        fallback ??= { pieces: next, key: piece.key, product: p, why };
        continue;
      }
      pieces = next;
      inRoom.add(p.id);
      added.push({ key: piece.key, product: p.id, why });
      done = true;
      break;
    }
    if (!done && fallback) {
      pieces = fallback.pieces;
      inRoom.add(fallback.product.id);
      added.push({ key: fallback.key, product: fallback.product.id, why: fallback.why });
      done = true;
    }
    if (!done) skipped.push({ role: slot.role, why: pool.length ? "no spot that keeps the walkways and doors clear" : "nothing in the catalog fits" });
  }

  return { layout: { ...layout, pieces, proposedAt: new Date().toISOString() }, added, moved, skipped, findings: check(pieces) };
}

/** Proposed pieces she hasn't chosen or touched, for re-proposing after the taste changes. */
export const unchosen = (l: Layout) => l.pieces.filter((p) => p.proposed && !p.chosen);

/** Take the proposal's untouched pieces back out, so a fresh proposal can fill those gaps again. */
export const withoutUnchosen = (l: Layout): Layout => ({ ...l, pieces: l.pieces.filter((p) => !(p.proposed && !p.chosen)) });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
