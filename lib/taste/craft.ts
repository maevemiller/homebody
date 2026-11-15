import type { Answer, Known, Space } from "./questions";
import { MATERIAL, PALETTE, type Palette, type TasteState } from "./visual";
import { sourcingDecisions } from "./shopping";

// The craft layer for the notes and the brief (Maeve, 2026-10-29: "sticky, fluffy, AI-generated" is out).
// Every line on the page or in the brief is a design decision, or a fact that drives one, in the trade's
// vocabulary. This file holds the banned-phrase filter applied to everything the model writes onto the
// page, the finish and role vocabulary the brief uses for picks, and the rule-based decisions the free
// interpreter writes (the live designer writes its own). Standards: docs/reference/interior-design/craft-standards.md.

// Stock filler that says nothing a designer could act on. Matched case-insensitively and cut.
const BANNED: RegExp[] = [
  /\bwith\s+(?:[\w-]+\s+){0,4}?ease\b/gi,
  /\bwarm and inviting\b/gi, /\binviting\b/gi, /\b(a |your )?(sanctuary|oasis|haven|retreat)\b/gi, /\beffortless(ly)?\b/gi, /\bcurated\b/gi,
  /\bgathered\b/gi, /\belevated\b/gi, /\bcozy,? yet\b[^,.;]*/gi, /\btimeless\b/gi, /\b(a space|a room|a home) that tells (your|their|its) story\b/gi,
  /\btells? (your|their|its) story\b/gi, /\b(the )?heart of the home\b/gi, /\bseamless(ly)?\b/gi, /\bharmonious(ly)?\b/gi, /\bthe perfect blend of\b/gi,
  /\bnestled\b/gi, /\bunderstated elegance\b/gi, /\bcomes? together\b/gi, /\bfeels? like (a )?home\b/gi, /\btruly\b/gi, /\bbeautifully\b/gi,
  /\bstunning\b/gi, /\bvibe\b/gi, /\ba touch of\b/gi, /\bthoughtfully\b/gi, 
];
// Mood words a brief can't act on unless tied to something concrete ("warm = walnut + brass + 2700K")
const SOFT_MOODS = /^(cozy|cosy|inviting|gathered|curated|elevated|timeless|effortless|serene|personal|lovely|happy|homey|homely|welcoming|relaxed|easy|considered)$/i;

// Fine in a spoken question ("Where have you lived that still feels like home?"), filler on the page
const PAGE_ONLY = new Set(["\\bfeels? like (a )?home\\b"]);

// Strip the filler, then tidy the punctuation it leaves behind. speech: the designer's spoken line,
// which keeps the few phrases a question can need.
export function deFluff(text: string, speech = false): string {
  // each cut leaves a marker, and the tidying below only touches the words right beside a cut, so a
  // sentence that had nothing removed comes back exactly as written ("you could live with." stays whole)
  const M = "\u0000";
  let out = text;
  for (const re of BANNED) if (!(speech && PAGE_ONLY.has(re.source))) out = out.replace(re, M);
  if (!out.includes(M)) return text.trim();
  return out
    // "A warm, gathered living room" → "A warm living room": no comma left hanging before the noun
    .replace(new RegExp(`(\\w),\\s*${M}\\s*(?=(living room|room|bedroom|kitchen|office|space|study|den)\\b)`, "gi"), "$1 ")
    // a word left dangling only when the cut ran to the end of the clause: "…with a touch of." → "…."
    .replace(new RegExp(`\\s*\\b(a|an|and|with|the|of)\\s*${M}(?=\\s*([,.;:!?]|$))`, "gi"), M)
    .replace(new RegExp(`\\s*\\b(a|an|and|with|the|of)\\s*${M}(?=\\s*([,.;:!?]|$))`, "gi"), M)
    .replace(new RegExp(`([,;:])\\s*${M}\\s*([,.;:!?])`, "g"), "$2")
    .replace(new RegExp(`^[\\s,;:–—-]*${M}[\\s,;:–—-]*`), "")
    .replace(new RegExp(`[\\s,;:]*${M}[\\s,;:]*$`), "")
    .replace(new RegExp(M, "g"), " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// A line survives only if something concrete is left after the filler is cut
// Loss words: only these earn condolence. "Sorry" after a happy memory sounds like a form letter.
export const LOSS = /\b(passed( away)?|died|dead|death|late (husband|wife|mother|father|mum|mom|dad|grand\w+|partner|son|daughter)|lost (him|her|them|my)|funeral|widow\w*|grief|grieving|miss (him|her|them))\b/i;

export const kept = (text: string) => {
  const t = deFluff(text);
  return t.replace(/[^a-z0-9]/gi, "").length >= 3 ? t : "";
};

// Mood words: at most two. In the brief (tied) each must be tied to its means ("warm = walnut + brass +
// 2700K"); on the notebook page, her own words pass unless they're filler.
export function moodsOK(moods: string[], tied = false): string[] {
  return moods
    .map((m) => deFluff(m.trim()))
    .filter((m) => m && (/[=:→]/.test(m) ? true : !tied && !SOFT_MOODS.test(m)))
    .slice(0, 2);
}

// ---- The picks in the trade's words -----------------------------------------------------

// Materials as a designer specifies them: species or type, finish, and where it goes
export const FINISH: Record<string, string> = {
  white_oak: "white oak, matte hardwax oil",
  walnut: "American walnut, satin oil",
  reclaimed: "reclaimed oak, matte, kept weathered",
  plaster: "limewash on one wall, matte",
  limestone: "honed limestone, sealed",
  terrazzo: "terrazzo, honed",
  brick: "exposed brick, sealed",
  concrete: "microcement, matte sealer",
  linen: "stonewashed linen for curtains and cushions",
  boucle: "bouclé on an accent chair",
  jute: "jute flatweave rug",
  leather: "semi-aniline leather (patinas)",
  brass: "unlacquered brass (patinas)",
  black_steel: "powder-coated black steel",
  nickel: "brushed nickel",
};

// A palette as 60-30-10 with named roles: the base for walls and large pieces, the secondary for
// upholstery, wood and rug, the accent for cushions, art and a few objects (palettes-materials-patterns.md §1)
export function paletteRoles(p: Palette): string {
  const n = p.names ?? [];
  if (n.length < 5) return p.name;
  // wood is a material, not a palette role, so the 30 is upholstery and textiles only
  return `60 ${n[0]}/${n[1]} (walls, large pieces) · 30 ${n[2]}/${n[3]} (upholstery, rug, curtains) · 10 ${n[4]}/${n[5] ?? n[4]} (accents)`;
}

export function pickedDirection(t: TasteState): string[] {
  const out: string[] = [];
  const pal = t.palettes.liked[0] ? PALETTE.get(t.palettes.liked[0]) : undefined;
  if (pal) out.push(`Palette: ${paletteRoles(pal)}`);
  // a second palette she picked joins as a supporting family, not a second 60-30-10
  const also = t.palettes.liked[1] ? PALETTE.get(t.palettes.liked[1]) : undefined;
  if (also?.names) out.push(`Also from ${also.name}: ${also.names[1]}/${also.names[2]} in textiles, ${also.names[4]} as a second accent`);
  const mats = t.materials.liked.map((id) => FINISH[id] ?? MATERIAL.get(id)?.label.toLowerCase()).filter(Boolean);
  if (mats.length) out.push(`Materials: ${mats.slice(0, 4).join("; ")}`);
  return out;
}

// ---- Rule-based decisions (the free interpreter's; the live designer writes its own) ----------

export interface Decision {
  decision: string;
  because: string;
}

const has = (a: Answer | undefined, v: string) => (Array.isArray(a) ? a.includes(v) : a === v);

// Only from what she said or picked; each carries the fact that drives it. said: her own words in the
// conversation, so free-text facts ("I work at the window two days a week", "board games on the floor")
// drive decisions as well as tree answers do.
export function ruleDecisions(k: Known, t: TasteState, said = ""): Decision[] {
  const a = k.answers;
  const out: Decision[] = [];
  const n = typeof a.people === "number" ? a.people : null;
  const pet = has(a.pets, "cat") || /\b(cat|kitten)\b/i.test(said) ? "cat" : has(a.pets, "dog") || /\b(dog|puppy|greyhound|retriever|terrier|spaniel|lab|labrador|mutt|collie|poodle|doodle)\b/i.test(said) ? "dog" : null;
  if (pet) {
    const soft = t.materials.liked.filter((m) => m === "linen" || m === "boucle").map((m) => (m === "linen" ? "linen" : "bouclé"));
    const scratch = /\bscratch/i.test(said);
    out.push({
      decision: `Sofa in a tight-weave performance fabric, 30,000+ double rubs${pet === "cat" ? "; no loop pile" : ""}${soft.length ? `; ${soft.join(" and ")} kept off the sofa` : ""}${scratch ? "; a sisal scratching post beside the sofa arm" : ""}`,
      because: scratch ? `the ${pet} scratches` : /\bshed/i.test(said) ? `the ${pet} sheds and is on the sofa` : a.pets_on_furniture === "yes" ? `the ${pet} is allowed on the sofa` : `a ${pet} at home`,
    });
  }
  if (has(a.kid_ages, "under3")) out.push({ decision: "Rounded coffee table, tall pieces anchored to the wall, nothing breakable below 3 ft", because: "a child under 3" });
  else if (a.kids === "home") out.push({ decision: "Wipeable, low-sheen finishes; washable slipcovers", because: "kids at home" });
  const days = said.match(/\b(\w+|\d) days? a week\b/i)?.[0];
  const wfhSaid = /\b(work(ing)? from home|wfh|remote|laptop|work (at|from) the (table|desk|window))\b/i.test(said);
  if (a.work_from_home === "daily" || a.work_from_home === "sometimes" || wfhSaid || has(a.uses, "working")) {
    const window = /\bwindow\b/i.test(said);
    out.push({
      decision: `Desk zone${window ? " at the window" : ""} with a 3000K task lamp to the side of the screen${a.video_calls === "yes" ? "; a plain, lit wall behind the desk" : ""}`,
      because: days ? `works from home ${days}` : a.work_from_home === "daily" ? "works in here most days" : "works from home",
    });
  }
  if (/\bhomework\b/i.test(said)) out.push({ decision: "A table or desk at 29–30\" for homework, with a 3000K task lamp", because: "homework after school" });
  const guests = said.match(/\b(\w+)(?: or (\w+))? friends\b/i);
  if (/\b(on the floor|floor cushions|board games)\b/i.test(said))
    out.push({ decision: `Large low-pile rug and floor cushions for ${guests ? `${guests[2] ?? guests[1]}+` : "a group"}; 36" clear around it`, because: /board games/i.test(said) ? "board games on the floor" : "friends sit on the floor" });
  else if (a.hosting_style === "table") out.push({ decision: `Extendable dining table: ${n ?? 2} daily, ${(n ?? 2) + 4} extended; 24" per seat`, because: "dinner around a table when people come over" });
  else if (a.hosting_style === "sofa") out.push({ decision: `Seating for ${(n ?? 2) + 4}: sofa plus two poufs; budget weighted to seating`, because: "everyone piles on the sofa" });
  if (has(a.uses, "tv") || /\b(a show|tv|films?|movies?)\b/i.test(said)) out.push({ decision: "TV as the one focal wall; seat at 1.5–2.5× the screen diagonal", because: "watching TV in here" });
  if (has(a.uses, "reading") || /\bread(ing)?\b/i.test(said)) out.push({ decision: "Reading chair with a 2700K floor lamp and a side table at arm height", because: "reading in here" });
  if (/\b(rent(ing|al)?|lease|landlord)\b/i.test(said)) out.push({ decision: "Removable fixes: plug-in sconces, tension rods, peel-off hooks; no drilling or paint without sign-off", because: "renting" });
  if (/\b(dark|gloomy|no light|north[- ]facing)\b/i.test(said)) out.push({ decision: "Layered lamps at 2700K on dimmers; warm whites with a yellow undertone", because: "the room is dark" });
  const date = said.match(/\b(?:before|by|until|in time for)\b[^.,;!?]{0,40}?\b(?:thanksgiving|christmas|the holidays|easter)\b/i)?.[0];
  if (a.timeline === "asap" || a.tradeoff === "speed" || date) {
    out.push({ decision: "In-stock pieces only; nothing made to order (8–16 week lead times)", because: date ? `ready ${date}` : a.timeline === "asap" ? "wants it as soon as possible" : "speed is the priority" });
  }
  const sourcing = sourcingDecisions(a, a.timeline === "asap" || a.tradeoff === "speed" || !!date);
  if (a.budget === "lean" && !sourcing.length) out.push({ decision: "Spend on the sofa and the rug; source case goods secondhand or in stock", because: "a lean budget" });
  out.push(...sourcing);
  return out;
}

// What a designer would still need before drawing, from what isn't known (budget and a date come
// from pace.missing, which also reads her own words)
export function openQuestions(k: Known, t: TasteState): string[] {
  const out: string[] = [];
  if (!k.space) out.push("Room dimensions, window and door positions");
  if (typeof k.answers.people !== "number") out.push("How many people use it daily");
  if (!t.palettes.liked.length) out.push("Palette");
  return out;
}

// ---- The captured room, in the brief (craft-standards.md "Space") -------------------------

const RUGS: [number, number][] = [[5, 8], [6, 9], [8, 10], [9, 12], [10, 14]];
const ftIn = (ft: number) => (Number.isInteger(ft) ? `${ft} ft` : `${Math.floor(ft)} ft ${Math.round((ft % 1) * 12)} in`);

export function sizeLine(sp: Space): string {
  return `${ftIn(sp.length)} × ${ftIn(sp.width)}${sp.ceiling ? `, ${ftIn(sp.ceiling)} ceiling` : ""}${sp.windows.length ? `; ${sp.windows.length} window${sp.windows.length > 1 ? "s" : ""}` : ""}`;
}

// Clearances and light from the room's own measurements: the lines a designer would put in the brief
export function spaceLines(sp: Space, said = ""): string[] {
  const out: string[] = [];
  // the largest standard rug that leaves about 18" of floor at the walls
  const rug = [...RUGS].reverse().find(([w, l]) => l <= sp.length - 3 && w <= sp.width - 3);
  if (rug) out.push(`Rug ${rug[0]} × ${rug[1]} ft: the largest standard size that leaves 18" of floor at the walls of a ${ftIn(sp.length)} × ${ftIn(sp.width)} room`);
  // sofa on the long wall, at most about two thirds of it; coffee table 14–18" off it, two thirds its length
  const sofaIn = Math.min(96, Math.round((sp.length * 12 * 2) / 3 / 6) * 6);
  out.push(`Sofa up to ${sofaIn}" on the ${ftIn(sp.length)} wall; coffee table about ${Math.round((sofaIn * 2) / 3 / 2) * 2}" long, 14–18" from the sofa`);
  if (sp.width <= 11) out.push(`36" walkway kept clear across the ${ftIn(sp.width)} width: slim side tables, nothing deeper than 16" on the opposite wall`);
  else out.push(`36" walkways from the door${sp.doors > 1 ? "s" : ""} to the seating`);
  const line = lightLine(sp, said);
  if (line) out.push(line);
  return out;
}

// Does a brief line use the room's measurements? ("8 × 10 ft rug", "84\" sofa", "36\" walkway")
export const measured = (t: string) => /\d+(\.\d+)?\s?(ft|feet|foot|'|"|in\b|inch|cm|m\b)|\d+\s?[×x]\s?\d+/i.test(t);

// Which way the window faces. What she says wins ("the window faces west, not south"); otherwise the
// capture's light reading ("big south-facing window").
type Facing = "south" | "west" | "north" | "east";
export function stated(said: string): Facing | null {
  const t = said.toLowerCase();
  const m =
    t.match(/\b(?:faces?|facing|looks?|points?)\s+(?:to(?:wards?)?\s+the\s+|due\s+)?(south|west|north|east)\b/) ??
    t.match(/\b(south|west|north|east)[- ]facing\b/) ??
    t.match(/\b(south|west|north|east)(?:ern)?\s+(?:window|light|sun|exposure)\b/);
  return (m?.[1] as Facing) ?? null;
}
export function facing(sp: Space, said = ""): Facing | null {
  if (!sp.windows.length) return stated(said);
  const m = sp.light.toLowerCase().match(/\b(south|west|north|east)/);
  return stated(said) ?? (m?.[1] as Facing) ?? null;
}

// What each orientation calls for (craft-standards.md "Light")
export const LIGHT_BY_FACING = {
  south: "South light, bright and even most of the day: fade-resistant fabrics and light-filtering sheers",
  west: "West light, hot and low after about 4pm: solar shades, low-sheen finishes; a desk set perpendicular to the glass, never facing into it",
  north: "North light, cool and even: warmer whites and 2700K lamps",
  east: "East light, bright mornings only: light-filtering shades, lamps at 2700K for the rest of the day",
} as const;
export function lightLine(sp: Space, said = ""): string | null {
  const f = facing(sp, said);
  return f ? LIGHT_BY_FACING[f] : null;
}

// A light line that contradicts the window's orientation ("hot after 4pm" for a south window)
export function wrongLight(line: string, sp: Space, said = ""): boolean {
  const f = facing(sp, said);
  if (!f) return false;
  const t = line.toLowerCase();
  const named = t.match(/\b(south|west|north|east)(?:[- ]facing)?\b/g)?.map((x) => x.replace(/[- ]facing/, ""));
  if (named?.some((x) => x !== f)) return true;
  if (f !== "west" && /\b(4\s?pm|after about 4|afternoon sun|low (afternoon|evening) sun|late-day sun)\b/.test(t)) return true;
  if (f !== "east" && /\bmorning (sun|light) only\b/.test(t)) return true;
  return false;
}
