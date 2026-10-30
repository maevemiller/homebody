import { RoomId } from "./types";

// Reasonable defaults (meters) when no dimensions were entered.
export const ROOM_DEFAULT_SIZE: Record<RoomId, { width: number; depth: number }> = {
  "living-room": { width: 5.5, depth: 4.2 },
  bedroom: { width: 4.0, depth: 3.6 },
  kitchen: { width: 4.2, depth: 3.2 },
  "dining-room": { width: 4.2, depth: 3.6 },
  office: { width: 3.4, depth: 3.0 },
  bathroom: { width: 2.4, depth: 2.0 },
  other: { width: 4.0, depth: 3.5 },
};

const FEET_TO_M = 0.3048;

// Parses free text like `12ft x 14ft`, `12' x 14'`, `3.6m x 4m`, `12 by 14`
// into meters. Falls back to the room's default footprint when it can't
// confidently find two dimensions.
export function parseDimensions(
  text: string,
  room: RoomId
): { width: number; depth: number; estimated: boolean } {
  const fallback = { ...ROOM_DEFAULT_SIZE[room], estimated: true };
  if (!text?.trim()) return fallback;

  const nums = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(ft|feet|'|m|meters?)?/gi)];
  if (nums.length < 2) return fallback;

  const toMeters = (value: number, unit?: string) => {
    const u = (unit || "").toLowerCase();
    if (u.startsWith("m")) return value;
    return value * FEET_TO_M; // default to feet, the common casual unit
  };

  const width = toMeters(parseFloat(nums[0][1]), nums[0][2]);
  const depth = toMeters(parseFloat(nums[1][1]), nums[1][2]);

  if (!width || !depth || width < 1 || depth < 1 || width > 20 || depth > 20) {
    return fallback;
  }
  return { width, depth, estimated: false };
}
