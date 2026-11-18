import type { RoomItem, RoomSpec } from "@/lib/scan/spec";
import type { DPiece, DRoom } from "@/lib/design/rules";
import type { Candidate } from "@/lib/design/ripple";
import { PRODUCTS, roleOfProduct, type Product } from "./catalog";
import { doorZones, wallsOf, type Piece, type Shape } from "./layout";
import { focalPoint } from "./placement";

// The bridge between Plug & Play's layout and the design engine (lib/design): every piece as a DPiece with a
// role, a lock and its colors and materials in catalog terms, and the room as a DRoom.

// the scan's categories as design roles
const ROLE_OF: Record<string, string> = {
  sofa: "sofa", sectional: "sofa", armchair: "chair", accent_chair: "chair", office_chair: "chair", bench: "chair",
  ottoman: "coffee_table", coffee_table: "coffee_table", side_table: "side_table", nightstand: "side_table", stool: "side_table",
  rug: "rug", floor_lamp: "lamp", table_lamp: "lamp", bookshelf: "shelf", shelving_unit: "shelf",
  tv_stand: "storage", console_table: "storage", cabinet: "storage", dresser: "storage", wardrobe: "storage",
  desk: "desk", artwork: "art", mirror: "art", dining_table: "dining_table", dining_chair: "dining_chair",
};

// the scan's materials as catalog materials, so counts across theirs and new pieces agree
const MATERIAL_OF: Record<string, string> = {
  fabric: "linen", velvet: "linen", boucle: "boucle", leather: "leather", wood_light: "white_oak", wood_mid: "white_oak",
  wood_dark: "walnut", metal_black: "black_steel", metal_brass: "brass", metal_chrome: "chrome", marble: "limestone",
  stone: "limestone", ceramic: "limestone", wicker: "jute", glass: "glass", painted: "paint", plastic: "plastic", foliage: "plant",
};
export const catalogMaterial = (m: string) => MATERIAL_OF[m] ?? m;

export function roleOfShape(s: Shape): string {
  if (s.product) return roleOfProduct(s.product);
  return ROLE_OF[s.category] ?? "other";
}

export function toDesign(
  pieces: Piece[], shapes: Record<string, Shape>, items: Map<string, RoomItem>, bins: Record<string, string | undefined> = {},
): DPiece[] {
  return pieces.filter((p) => p.placed && shapes[p.key]).map((p) => {
    const s = shapes[p.key];
    const it = p.item ? items.get(p.item) : undefined;
    const pr = s.product;
    const lock: DPiece["lock"] = p.source === "catalog" || p.product ? "free" : p.source === "room" && bins[p.item ?? ""] !== "move" ? "keep_here" : "keep_move";
    return {
      key: p.key, name: s.name, role: roleOfShape(s), x: p.x, y: p.y, rot: p.rot, w: s.w, d: s.d, h: s.h, elev: p.elev,
      mount: s.mount, flat: s.flat, color: pr?.color ?? s.color, accent: pr?.accent, material: pr?.material ?? catalogMaterial(it?.primary_material ?? "other"),
      accentMaterial: pr?.accentMaterial, lock, why: p.why ?? (p.source !== "catalog" ? "theirs" : undefined), fixed: s.fixed,
    };
  });
}

export function toRoom(spec: RoomSpec, pieces: Piece[], shapes: Record<string, Shape>, opts: { wall?: string; household?: DRoom["household"]; loose?: boolean } = {}): DRoom {
  const walls = wallsOf(spec.footprint);
  const original: DRoom["original"] = {};
  for (const it of spec.items) original[it.id] = { x: it.x, y: it.y, rot: it.rotation };
  return {
    footprint: spec.footprint, doors: doorZones(spec, walls), focal: focalPoint(spec, walls, pieces, shapes),
    wall: opts.wall ?? spec.walls.color, floor: spec.floor.color, household: opts.household, loose: opts.loose, original,
  };
}

/** Ceiling lights the scan found (pendants), for rule 11. */
export const ceilingLights = (spec: RoomSpec) => spec.items.filter((i) => i.category === "pendant_light").length;

export const asCandidate = (p: Product): Candidate => ({
  id: p.id, name: p.name, role: roleOfProduct(p), color: p.color, accent: p.accent, material: p.material, accentMaterial: p.accentMaterial, price: p.price,
});
export const CANDIDATES: Candidate[] = PRODUCTS.map(asCandidate);
