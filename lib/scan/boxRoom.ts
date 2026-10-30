import { RoomSpec } from "./spec";

// "Just the measurements" builds a plain box room from what the owner typed,
// without reading any photos. Shape, doors and windows are guesses, so the
// room is marked approximate wherever it's shown.

const UNITS: Record<string, number> = { ft: 0.3048, feet: 0.3048, foot: 0.3048, "'": 0.3048, m: 1, cm: 0.01 };
const UNIT = String.raw`(ft|feet|foot|'|m|metres?|meters?|cm)?`;
const NUM = String.raw`(\d+(?:\.\d+)?)`;

const unitFactor = (u?: string) => (u ? UNITS[u.startsWith("met") ? "m" : u] : undefined);

export interface Measurements {
  width: number;
  length: number;
  ceiling: number;
}

/** Reads "14 × 10 ft, 8 ft ceiling" or "4.2 x 3 m" into meters, or null if it can't. */
export function parseMeasurements(text: string): Measurements | null {
  const t = text.toLowerCase().replace(/[′’]/g, "'");
  const ceil =
    new RegExp(`${NUM}\\s*${UNIT}\\s*(?:high\\s+|tall\\s+)?ceiling`).exec(t) ??
    new RegExp(`ceiling[^\\d]*${NUM}\\s*${UNIT}`).exec(t);
  const rest = ceil ? t.replace(ceil[0], " ") : t;
  const dim = new RegExp(`${NUM}\\s*${UNIT}\\s*(?:x|×|by|\\*)\\s*${NUM}\\s*${UNIT}`).exec(rest);
  if (!dim) return null;
  const a = Number(dim[1]);
  const b = Number(dim[3]);
  // Use whichever unit they wrote; with none at all, numbers over 7 are almost certainly feet
  const factor = unitFactor(dim[4]) ?? unitFactor(dim[2]) ?? unitFactor(ceil?.[2]) ?? (Math.max(a, b) > 7 ? UNITS.ft : 1);
  const width = Math.max(a, b) * factor;
  const length = Math.min(a, b) * factor;
  const ceiling = ceil ? Number(ceil[1]) * (unitFactor(ceil[2]) ?? factor) : 2.6;
  const plausible = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
  if (!plausible(width, 1.5, 40) || !plausible(length, 1.5, 40) || !plausible(ceiling, 1.8, 8)) return null;
  return { width, length, ceiling };
}

export function boxRoomSpec(m: Measurements, roomName: string, typed: string): RoomSpec {
  const name = roomName.charAt(0).toUpperCase() + roomName.slice(1);
  return {
    name,
    summary: `A ${name.toLowerCase()} built from your measurements only. The shape, doors and windows are approximate until you add photos or a floor plan.`,
    footprint: [
      { x: 0, y: 0 },
      { x: m.width, y: 0 },
      { x: m.width, y: m.length },
      { x: 0, y: m.length },
    ],
    ceiling_height: m.ceiling,
    floor: { material: "wood_mid", color: "#b48a5a" },
    walls: { material: "paint", color: "#efece6" },
    ceiling_color: "#f6f5f2",
    openings: [
      { type: "door", wall: 0, offset: Math.min(0.3, m.width / 4), width: 0.85, height: Math.min(2.03, m.ceiling - 0.1), sill: 0 },
      { type: "window", wall: 2, offset: m.width / 2 - 0.75, width: 1.5, height: Math.min(1.4, m.ceiling - 1.1), sill: 0.9 },
    ],
    items: [],
    lighting: "Unknown: one window assumed on the far wall.",
    scale_basis: `Owner's measurements: "${typed}"`,
    confidence: 0.3,
    profile_signals: { style: [], price_level: "unknown", lifestyle: [] },
  };
}
