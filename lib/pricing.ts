import { IntakeAnswers, Tier } from "./types";
import { tierFromPriorities } from "./personas";

// Base price scales with room count and fresh-start vs. refresh; service
// tier scales with standard vs. customized. The two multiply, matching the
// two independent axes in the pricing model spec. Furniture-only vs.
// +accessories is expressed later, per room, as the standard/extended pack
// choice in the functional-info step — it isn't a separate charge here.
const BASE_PER_ROOM: Record<"fresh" | "refresh", number> = {
  fresh: 149,
  refresh: 89,
};

const TIER_MULTIPLIER: Record<Tier, number> = {
  standard: 1,
  customized: 1.65,
};

export interface PriceBreakdown {
  perRoom: number;
  roomCount: number;
  tier: Tier;
  subtotal: number;
  total: number;
}

export function quote(intake: IntakeAnswers): PriceBreakdown | null {
  if (!intake.mode || intake.rooms.length === 0) return null;
  const tier = tierFromPriorities(intake.priorities);
  const base = BASE_PER_ROOM[intake.mode];
  const perRoom = Math.round(base * TIER_MULTIPLIER[tier]);
  const roomCount = intake.rooms.length;
  const subtotal = perRoom * roomCount;
  return { perRoom, roomCount, tier, subtotal, total: subtotal };
}

export function formatUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
