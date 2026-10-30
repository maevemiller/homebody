import { IntakeAnswers, Mode, PersonaKey, Tier } from "./types";

export interface PersonaInfo {
  key: PersonaKey;
  mode: Mode;
  tier: Tier;
  name: string;
  source: "from notes" | "inferred";
  description: string;
}

export const PERSONAS: Record<PersonaKey, PersonaInfo> = {
  showroom: {
    key: "showroom",
    mode: "fresh",
    tier: "standard",
    name: "Showroom-style",
    source: "from notes",
    description:
      "Furnishing a whole new space at once. Values price and speed over individual expression — one cohesive, efficient full-home solution.",
  },
  considered: {
    key: "considered",
    mode: "fresh",
    tier: "customized",
    name: "Considered first home",
    source: "inferred",
    description:
      "Starting from zero, but wants every piece considered — this is where a personal story shows up first.",
  },
  "quick-refresh": {
    key: "quick-refresh",
    mode: "refresh",
    tier: "standard",
    name: "Quick refresh",
    source: "inferred",
    description:
      "A handful of gaps in an existing space. Fast and low-friction — doesn't need the full story interview.",
  },
  gatherer: {
    key: "gatherer",
    mode: "refresh",
    tier: "customized",
    name: "Gatherer",
    source: "from notes",
    description:
      "A long-time collector curating an existing home. Looking for specific pieces that enhance, not replace, what's already there.",
  },
};

// tier is derived from the "what do you value most" priority pick — putting
// customization in the top 1-2 priorities is what moves someone from the
// standard/essentials row into the customized/expression row.
export function tierFromPriorities(priorities: IntakeAnswers["priorities"]): Tier {
  return priorities.includes("customization") ? "customized" : "standard";
}

export function personaFor(intake: IntakeAnswers): PersonaInfo | null {
  if (!intake.mode) return null;
  const tier = tierFromPriorities(intake.priorities);
  const key = Object.values(PERSONAS).find(
    (p) => p.mode === intake.mode && p.tier === tier
  )?.key;
  return key ? PERSONAS[key] : null;
}
