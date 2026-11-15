import { z } from "zod";
import { QUESTIONS, walk, type Answer, type Known } from "./questions";
import { choiceSaid, noteDetail, recordAll } from "./agent";
import { deFluff, facing, stated, kept, lightLine, LIGHT_BY_FACING, LOSS, measured, moodsOK, sizeLine, spaceLines, wrongLight } from "./craft";
import { askedLength, missing, newPace, target, OLD_SECTION, PROTECTS, LENGTH_IDS, SECTION_KEYS, type Length, type Pace, type Protect, type SectionKey } from "./pace";
import { EMPTY_TASTE, FAMILIES, FAMILY_IDS, LOOK_OF, MATERIAL, PALETTE, PATTERN, ROOM, scoreWords, SET_IDS, treeAnswers, type Family, type SetId, type TasteState } from "./visual";

// The Taste Builder conversation as the designer's intake interview: three sections people
// can see, an open conversation inside each, and a live dossier the designer draws as they
// talk. The live model (app/api/taste/turn) and the offline interpreter (offline.ts) both
// return a Turn; applyTurn folds it into the saved state, checking every answer against
// the tree first, so the tree stays the map of what's known and nothing is asked twice.

// Maeve, 2026-10-29: who you are (short, function inferred), space and style (the pictures), and
// extras (how personal, the story, the practical bits). Each has a small minimum (lib/taste/pace.ts).
export const SECTIONS = [
  { id: "you", label: "Who you are", short: "Who you are", about: "You, and how you'll use the space" },
  { id: "style", label: "Space and style", short: "Space and style", about: "Mostly pictures: tap what you love" },
  { id: "extras", label: "Extras", short: "Extras", about: "How personal it feels, and the practical bits" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"] | "readback" | "done";
export const ORDER: SectionId[] = ["you", "style", "extras", "readback", "done"];

// Which section each tree question belongs to. The priorities question (tradeoff) comes early, in
// "you", because it sizes the rest; budget and a date close "extras", after rapport (intake-process.md §6).
export const SECTION_OF: Record<string, SectionId> = {
  start: "you", approach: "you", tradeoff: "you", people: "you", uses: "you", priorities: "you", kids: "you",
  kid_ages: "you", pets: "you", pets_on_furniture: "you", work_from_home: "you", video_calls: "you",
  hosting: "you", hosting_style: "you", unwind: "you", routine: "you",
  look: "style", color: "style", pattern: "style", materials: "style", avoid: "style", inspiration: "style", bold_colors: "style",
  anchor: "extras", places: "extras", places_feel: "extras", meaningful_detail: "extras", timeline: "extras", budget: "extras",
  shop: "extras", brands: "extras",
};
for (const q of QUESTIONS) if (q.id.startsWith("look_")) SECTION_OF[q.id] = "style";

// The dossier's zones, in dossier.md §3.2's layout
export const ZONES = ["title", "why", "day", "look", "who", "story", "keep", "never", "practical"] as const;
export type Zone = (typeof ZONES)[number];

// Small hand-drawn doodles the dossier can sketch beside a line (components/taste/Doodles.tsx)
export const ICONS = [
  "none", "coffee", "sofa", "desk", "book", "tv", "table", "plant", "cat", "dog", "child", "people", "lamp", "sun",
  "moon", "candle", "music", "wine", "bed", "window", "heart", "home", "pin", "plane", "star", "leaf", "butterfly", "brush",
] as const;
export type Icon = (typeof ICONS)[number];

// ---- What one turn returns (validated with zod on the server and here) -----------------
// Kept small and flat on purpose: structured output compiles this into a grammar, and a schema with
// long enums, nested objects and descriptions grew past what the API will compile (a 400, "compiled
// grammar is too large", 2026-10-29). Enums are plain strings here and checked in applyTurn; what each
// field means is in DESIGNER_PROMPT. The read-back brief is its own call with BriefSchema.

const Entry = z.object({
  zone: z.string(),
  text: z.string(),
  because: z.string().nullable(),
  icon: z.string(),
  sure: z.boolean(),
  replaces: z.string().nullable(),
});

export const TurnWireSchema = z.object({
  say: z.string(),
  answers: z.array(z.object({ id: z.string(), value: z.union([z.string(), z.array(z.string()), z.number()]), quote: z.string() })),
  notes: z.array(z.string()),
  quote: z.string().nullable(),
  moods: z.array(z.string()),
  styles: z.array(z.object({ family: z.string(), weight: z.number(), because: z.string() })),
  buckets: z.array(z.object({ bucket: z.string(), weight: z.number(), because: z.string() })),
  dossier: z.array(Entry),
  cross_out: z.array(z.string()),
  not_styles: z.array(z.string()),
  show: z.string(),
  section: z.string(),
  priorities: z.object({ words: z.string(), protect: z.array(z.string()) }).nullable(),
  resize: z.string(),
  stop_offered: z.boolean(),
  suggestions: z.array(z.string()),
});

// The read-back brief, asked for in a second call only when a turn reaches the read-back
export const BriefSchema = z.object({
  title: z.string(),
  statement: z.string(),
  moods: z.array(z.string()),
  program: z.array(z.string()),
  constraints: z.array(z.string()),
  direction: z.array(z.string()),
  decisions: z.array(z.object({ decision: z.string(), because: z.string() })),
  nevers: z.array(z.string()),
  open_questions: z.array(z.string()),
});
export type BriefOut = z.infer<typeof BriefSchema>;

// A read-back correction as edit operations against the brief's line ids (the critic, 2026-10-30: a
// regenerated brief rewrote half the lines and left contradictions). Only these lines change.
export const EditSchema = z.object({
  ops: z.array(z.object({ op: z.string(), id: z.string().nullable(), section: z.string().nullable(), text: z.string().nullable() })),
});
export type EditOp = z.infer<typeof EditSchema>["ops"][number];
export const BRIEF_KEYS = ["program", "constraints", "direction", "decisions", "nevers", "open_questions"] as const;
type BriefKey = (typeof BRIEF_KEYS)[number];
const ID_PREFIX: Record<BriefKey, string> = { program: "prog", constraints: "con", direction: "dir", decisions: "dec", nevers: "nev", open_questions: "open" };

// The brief as the designer sees it for a correction: every line with a stable id
export function briefWithIds(c: Concept): string {
  const out: string[] = [`[idea] ${c.statement}`];
  for (const key of BRIEF_KEYS) {
    const xs = key === "decisions" ? (c.decisions ?? []).map((d) => `${d.decision} | why: ${d.because}`) : (c[key] ?? []);
    xs.forEach((x, i) => out.push(`[${ID_PREFIX[key]}-${i}] ${key}: ${x}`));
  }
  return out.join("\n");
}

// A whole turn as the page gets it: the turn, plus the brief at the read-back, or the edits to it on a correction
export const TurnSchema = TurnWireSchema.extend({ concept: BriefSchema.nullable().optional(), edits: z.array(EditSchema.shape.ops.element).optional() });
export type WireTurn = z.infer<typeof TurnSchema>;

// The turn once checked: the plain strings narrowed to what the page knows (the free interpreter
// builds this shape directly)
type DossierEntry = Omit<z.infer<typeof Entry>, "zone" | "icon"> & { zone: Zone; icon: Icon };
export type Turn = Omit<WireTurn, "dossier" | "styles" | "not_styles" | "show" | "section" | "priorities" | "resize" | "concept"> & {
  dossier: DossierEntry[];
  styles: { family: Family; weight: number; because: string }[];
  not_styles: Family[];
  show: "none" | SetId;
  section: SectionKey | "readback";
  priorities: { words: string; protect: Protect[] } | null;
  resize: "none" | Length;
  concept?: BriefOut | null;
  edits?: EditOp[];
};

const isIn = <T extends string>(xs: readonly T[], x: string): x is T => (xs as readonly string[]).includes(x);
export function normalizeTurn(raw: WireTurn, current: SectionId): Turn {
  const here = isIn(SECTION_KEYS, current) ? current : "readback";
  return {
    ...raw,
    dossier: raw.dossier.filter((e) => isIn(ZONES, e.zone)).map((e) => ({ ...e, zone: e.zone as Zone, icon: isIn(ICONS, e.icon) ? e.icon : "none" })),
    styles: raw.styles.filter((x): x is { family: Family; weight: number; because: string } => isIn(FAMILY_IDS, x.family)),
    not_styles: raw.not_styles.filter((f): f is Family => isIn(FAMILY_IDS, f)),
    show: isIn(SET_IDS, raw.show) ? raw.show : "none",
    section: raw.section === "readback" || isIn(SECTION_KEYS, raw.section) ? (raw.section as SectionKey | "readback") : here,
    priorities: raw.priorities && { words: raw.priorities.words, protect: raw.priorities.protect.filter((x): x is Protect => isIn(PROTECTS, x)) },
    resize: isIn(LENGTH_IDS, raw.resize) ? raw.resize : "none",
    concept: raw.concept ?? null,
  };
}

// ---- What's kept in the browser (alongside Saved's answers and notes) -------------------

export interface DossierItem {
  id: string;
  zone: Zone;
  text: string;
  because?: string | null;
  icon?: Icon;
  sure: boolean;
  crossed?: boolean;
  // the turn it was drawn on, so it animates in once
  at: number;
}

export interface Line {
  who: "agent" | "you";
  text: string;
  // a tap on a visual set, said for the agent but not shown as speech
  event?: boolean;
}

// The read-back brief (Maeve, 2026-10-29): a designer's brief, not a poem. Conversations saved before
// then have only title, moods and a longer statement, and ReadBack shows them as they were.
export interface Brief {
  program: string[];
  constraints: string[];
  direction: string[];
  decisions: { decision: string; because: string }[];
  nevers: string[];
  open_questions: string[];
}
export interface Concept extends Partial<Brief> {
  title: string;
  moods: string[];
  statement: string;
  // lines a correction removed, kept to show struck through
  struck?: { section: string; text: string }[];
}

export interface Convo {
  id: string;
  turns: number;
  section: SectionId;
  transcript: Line[];
  dossier: DossierItem[];
  moods: string[];
  quotes: string[];
  // dev-only: the hidden persona read and the style evidence from their words
  buckets: Partial<Record<string, { weight: number; because: string }>>;
  inferred: { family: string; weight: number; because: string }[];
  concept?: Concept;
  // a set the agent asked to show, waiting on screen
  showing?: (typeof SET_IDS)[number];
  suggestions?: string[];
  confirmed?: boolean;
  // plain facts (drawn from answers and picks) a correction crossed out, as "key::text", so a
  // fact that later changes to something true isn't left struck through
  crossedFacts?: string[];
  // tree answers the designer recorded that her own words haven't confirmed: drawn in pencil
  designerSet?: string[];
  // the turn each plain fact (lib/taste/dossier.ts) first appeared on, so it draws in once
  factsAt?: Record<string, number>;
  // after the live model failed or ran out of turns, the rest runs on the free interpreter
  offline?: boolean;
  // length, replies per section, stopping points offered, priorities (absent in older saved state)
  pace?: Pace;
}

// Older saved conversations (life / taste / story, no pace) read as the new sections
export function migrateConvo(c: Convo): Convo {
  const section = (OLD_SECTION[c.section as string] ?? c.section) as SectionId;
  return { ...c, section: ORDER.includes(section) ? section : "you", pace: c.pace ?? newPace() };
}

export const newConvo = (): Convo => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
  turns: 0, section: "you", transcript: [], dossier: [], moods: [], quotes: [], buckets: {}, inferred: [], pace: newPace(),
});

export const MAX_TURNS = 40;

// ---- Folding a turn in ---------------------------------------------------------------

export interface State {
  answers: Record<string, Answer>;
  notes: string[];
  taste: TasteState;
  convo: Convo;
}

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
const STOPW = new Set(["a", "an", "the", "and", "of", "in", "on", "for", "to", "with", "her", "his", "their", "your", "is", "it"]);
const words = (s: string) => new Set(norm(s).split(/\s+/).filter((w) => w && !STOPW.has(w)));
// near-duplicates ("a calm wall behind the sofa" vs "a calm wall and a proper work spot") are drawn once
export function similar(a: string, b: string): boolean {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return false;
  const both = [...x].filter((w) => y.has(w)).length;
  return both / Math.min(x.size, y.size) >= 0.6;
}

// shown: what's already on the page, plain facts included, so nothing is drawn twice.
// facts: the plain facts on the page by [id] and text, so a correction can cross one out.
// The model sometimes double-escapes a character ("$5\\u20138k"); show the character itself
export const unescape = (t: string) => t.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

// Her words cover an answer when the quote the designer cites is in what she just said (or tapped)
const hers = (quote: string, said: string) => {
  const q = norm(quote);
  return !!q && (norm(said).includes(q) || similar(quote, said));
};
// For a multi-choice answer, every choice has to be in her words ("relaxing, films" → relax, tv);
// a list the designer filled out from the room's guess stays pencil
function namedAll(id: string, value: Answer, said: string): boolean {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q || q.kind.type !== "multi" || !Array.isArray(value)) return true;
  return value.every((v) => choiceSaid(id, v, said));
}

// The style families as people say them, for "not mid-century", "no boho", "industrial is fine"
const STYLE_SAID: Partial<Record<Family, RegExp>> = {
  midcentury: /mid.?century|retro|eames/i, scandinavian: /scandi|nordic|danish/i, boho: /boho|bohemian/i, art_deco: /deco|glam/i,
  warm_minimal: /minimal/i, minimal: /minimal|modern/i, farmhouse: /farmhouse|rustic/i, grandmillennial: /granny|grandmillennial|chintz/i,
  french_country: /french|provenc/i, wabi_sabi: /wabi/i, indian: /indian/i, japandi: /japandi|zen/i,
};
function styleNamed(f: Family, said: string): boolean {
  return (STYLE_SAID[f] ?? new RegExp(FAMILIES[f].split(" ")[0], "i")).test(said);
}

// The spoken line, kept honest: no opening clause that just echoes what she said, and in the
// read-back after a correction, no new questions (it only confirms)
function tidySay(say: string, said: string, readback: boolean, herWords = said): string {
  // no filler aloud either ("a touch of blue"), and condolence only for a loss she named
  let out = deFluff(say.trim(), true);
  if (/\bsorry\b/i.test(out) && !LOSS.test(herWords)) {
    const rest = (out.match(/[^.!?]+[.!?]+["”]?\s*/g) ?? [out]).filter((x) => !/\bsorry\b/i.test(x));
    out = rest.join("").trim() || out;
  }
  const sentences = out.match(/[^.!?]+[.!?]+["”]?\s*/g) ?? [out];
  if (said && sentences.length > 1 && !sentences[0].includes("?") && echoes(sentences[0], said)) out = sentences.slice(1).join("").trim();
  if (readback) {
    const kept = (out.match(/[^.!?]+[.!?]+["”]?\s*/g) ?? [out]).filter((x) => !x.includes("?"));
    out = kept.join("").trim() || "Updated.";
  }
  return out;
}
const CONTENT = (t: string) => new Set(norm(t).split(/\s+/).filter((w) => w.length > 3 && !STOPW.has(w)));
function echoes(sentence: string, said: string): boolean {
  const a = CONTENT(sentence);
  const b = CONTENT(said);
  const has = (w: string) => [...b].some((x) => x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5)));
  // "A cave, that tells me a lot…": a short line whose opening clause is only her own words
  const head = CONTENT(sentence.split(",")[0]);
  if (sentence.includes(",") && head.size >= 1 && [...head].every(has) && sentence.split(/\s+/).length <= 16) return true;
  if (a.size < 2) return false;
  return [...a].filter((w) => [...b].some((x) => x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5)))).length / a.size >= 0.5;
}

// The concept statement says only what she said or confirmed. Any list item (or sentence) carrying an
// unconfirmed claim her own words don't back is dropped: "works for unwinding, film nights and lamps" → "works for lamps".
export function truthful(statement: string, herWords: string, unconfirmed: RegExp[]): string {
  const bad = unconfirmed.filter((re) => !re.test(herWords));
  if (!bad.length) return statement;
  const sentences = statement.match(/[^.!?]+[.!?]+["”]?\s*/g) ?? [statement];
  const out: string[] = [];
  for (const sentence of sentences) {
    if (!bad.some((re) => re.test(sentence))) {
      out.push(sentence.trim());
      continue;
    }
    // drop just the offending items of a list ("a, b and c"), or the sentence if its head is the claim
    const body = sentence.trim().replace(/[.!?]+$/, "");
    const parts = body.split(/,\s+|\s+and\s+/);
    if (bad.some((re) => re.test(parts[0]))) continue;
    const kept = parts.filter((p) => !bad.some((re) => re.test(p)));
    if (kept.length < 2) {
      out.push(`${kept[0]}.`);
      continue;
    }
    out.push(`${kept.slice(0, -1).join(", ")} and ${kept[kept.length - 1]}.`.replace(/\b(for|with|as|like) and /, "$1 "));
  }
  return out.join(" ").trim() || statement;
}

// A correction changes only the corrected part: the earlier moods stay, and her personal story
// (the sentence carrying what she shared) survives if the rewrite dropped it
// Does a line touch what she just said? Shared content words, by their first five letters
// Two shared words, or every word of a one-word line ("a chandelier"), so "black table" doesn't reach
// "Black steel" and "table" doesn't reach "homework at the coffee table"
export function related(line: string, said: string, need = 2): boolean {
  const a = [...CONTENT(line)];
  const b = [...CONTENT(said)];
  const shared = a.filter((w) => b.some((x) => x.slice(0, 5) === w.slice(0, 5))).length;
  return shared >= Math.min(need, a.length) && shared > 0;
}

// A correction, applied as edits (the critic, 2026-10-30): replaced and removed lines are struck, adds are
// appended, an answered open question is retired, and every other line stays byte-identical. clean runs the
// usual filters (filler, "you", sizes, light, nevers) over the new text only.
export function applyEdits(prev: Concept, ops: EditOp[], clean: (b: BriefOut) => BriefOut): Concept {
  const out: Concept = { ...prev, struck: [...(prev.struck ?? [])] };
  const list = (key: BriefKey): string[] =>
    key === "decisions" ? (out.decisions ?? []).map((d) => `${d.decision} — because ${d.because}`) : [...(out[key] ?? [])];
  const lists = Object.fromEntries(BRIEF_KEYS.map((k) => [k, list(k)])) as Record<BriefKey, (string | null)[]>;
  const added = Object.fromEntries(BRIEF_KEYS.map((k) => [k, [] as string[]])) as Record<BriefKey, string[]>;
  const replaced = Object.fromEntries(BRIEF_KEYS.map((k) => [k, {} as Record<number, string>])) as Record<BriefKey, Record<number, string>>;
  const where = (id: string | null): [BriefKey, number] | null => {
    const m = (id ?? "").replace(/^\[|\]$/g, "").match(/^([a-z]+)-(\d+)$/);
    const key = m && (Object.entries(ID_PREFIX).find(([, v]) => v === m[1])?.[0] as BriefKey | undefined);
    return key && Number(m![2]) < lists[key].length ? [key, Number(m![2])] : null;
  };
  const sectionOf = (x: string | null): BriefKey | null => {
    const t = (x ?? "").toLowerCase().replace(/\s+/g, "_");
    return (BRIEF_KEYS as readonly string[]).includes(t) ? (t as BriefKey) : t === "open" ? "open_questions" : null;
  };
  for (const op of ops) {
    const kind = op.op.toLowerCase();
    const at = where(op.id);
    if ((kind === "remove" || kind === "replace" || kind === "answer_open") && at) {
      const [key, i] = at;
      const was = lists[key][i];
      if (was === null) continue;
      lists[key][i] = null;
      // an answered open question is retired, not struck
      if (kind !== "answer_open" && key !== "open_questions") out.struck!.push({ section: key, text: was });
      if (kind === "replace" && op.text?.trim()) replaced[key][i] = op.text.trim();
    } else if (kind === "add" && op.text?.trim()) {
      const key = sectionOf(op.section);
      if (key) added[key].push(op.text.trim());
    }
  }
  // the new text goes through the same filters as a first brief
  const fresh = (key: BriefKey) => [...Object.values(replaced[key]), ...added[key]];
  const split = (t: string) => {
    const m = t.split(/\s*(?:\|\s*why:|— because|\bbecause\b)\s*/i);
    return { decision: m[0].trim(), because: (m[1] ?? "").trim() };
  };
  const cleaned = clean({
    title: prev.title, statement: prev.statement, moods: [],
    program: fresh("program"), constraints: fresh("constraints"), direction: fresh("direction"),
    decisions: fresh("decisions").map(split).filter((d) => d.decision && d.because), nevers: fresh("nevers"), open_questions: fresh("open_questions"),
  });
  for (const key of BRIEF_KEYS) {
    const news = key === "decisions" ? (cleaned.decisions ?? []).map((d) => `${d.decision} — because ${d.because}`) : (cleaned[key] as string[]);
    // replacements take their line's place; adds go at the end
    const nReplaced = Object.keys(replaced[key]).length;
    const repl = news.slice(0, nReplaced);
    const adds = news.slice(nReplaced);
    const idx = Object.keys(replaced[key]).map(Number);
    const merged: string[] = [];
    lists[key].forEach((x, i) => {
      const r = idx.indexOf(i);
      if (r >= 0 && repl[r]) merged.push(repl[r]);
      else if (x !== null) merged.push(x);
    });
    merged.push(...adds.filter((a) => !merged.some((m) => norm(m) === norm(a))));
    if (key === "decisions") out.decisions = merged.map((t) => { const [d, b] = t.split(" — because "); return { decision: d, because: b ?? "" }; });
    else out[key] = merged;
  }
  return out;
}

function keepConcept(prev: Concept | undefined, next: Concept | null | undefined, herWords: string, notes: string[], dossier: DossierItem[]): Concept | undefined {
  if (!next) return prev;
  if (!prev) return next;
  // a structured brief is never regenerated: corrections arrive as edits (applyEdits)
  if (prev.program !== undefined) return prev;
  const story = [...notes, ...dossier.filter((d) => d.zone === "story" && !d.crossed).map((d) => d.text)];
  const keys = [...new Set(story.flatMap((t) => [...CONTENT(t)]))].filter((w) => herWords.toLowerCase().includes(w));
  const prevStory = (prev.statement.match(/[^.!?]+[.!?]+["”]?\s*/g) ?? []).find((x) => keys.some((k) => x.toLowerCase().includes(k)));
  const lost = prevStory && !keys.some((k) => next.statement.toLowerCase().includes(k));
  const moodsSaid = next.moods.some((m) => herWords.toLowerCase().split(/\n/).pop()?.includes(m.toLowerCase()));
  return { ...next, moods: moodsSaid ? next.moods : prev.moods, statement: lost ? `${next.statement.trim()} ${prevStory!.trim()}` : next.statement };
}

// The brief as the model wrote it, with the filler cut and at most two (tied) mood words
// Materials are hers only if she picked them in the materials set or said them: a line naming rattan
// because a room photo she liked had a rattan sideboard is dropped from the brief's direction
const MATERIAL_WORDS = /\b(rattan|cane|leather|brass|sheepskin|velvet|marble|walnut|oak|linen|boucl[eé]|jute|sisal|plaster|limewash|terrazzo|concrete|brick|steel|nickel|chrome|travertine|limestone|wool|mohair|teak)\b/gi;
function photoMaterial(line: string, herWords: string, t: TasteState): boolean {
  const picked = t.materials.liked.map((id) => `${id} ${MATERIAL.get(id)?.label ?? ""}`.toLowerCase()).join(" ");
  const said = herWords.toLowerCase();
  return [...line.matchAll(MATERIAL_WORDS)].some((m) => {
    const w = m[0].toLowerCase().replace("é", "e").slice(0, 5);
    return !picked.replace(/é/g, "e").includes(w) && !said.includes(w);
  });
}

// A rejected room, in the brief, by the words that define it (its first clause), as the page draws it:
// never the whole photo caption ("Exposed brick columns, steel windows, a grey tufted sofa")
function trimNever(line: string, t: TasteState): string {
  for (const id of t.rooms.never) {
    const alt = ROOM.get(id)?.alt ?? "";
    const head = alt.split(/,| with | under | onto | against /)[0];
    if (head && (similar(alt, line) || similar(head, line) || norm(line).startsWith(norm(head)))) return head.trim();
  }
  return line;
}

// The brief written to her, about her things (the critic, 2026-10-29):
// - her own name becomes "you" ("for Dana, her boys" → "for you, your boys"); other people's names stay;
// - "your linen curtains" only if she said she has curtains or kept them in the sort; otherwise "linen curtains";
// - a light line that contradicts the window's orientation ("hot after 4pm" at a south window) is dropped.
const OWNED = /\byour ((?:[\w-]+ ){0,2}?)(curtains|drapes|blinds|shades|sofa|couch|sectional|rug|coffee table|table|chair|armchair|lamps?|bookcase|bookshelf|shelves|desk|bed|tv|mirror|sideboard|console|cushions|pillows|throw|art|plants?)\b/gi;
function ownBrief(c: BriefOut, herWords: string, base: Omit<Known, "answers">): BriefOut {
  const name = herWords.match(/\b(?:I'm|I am|my name is|[Nn]ame's|[Tt]his is)\s+([A-Z][a-z]{2,})\b/)?.[1];
  const bins = base.sort?.bins ?? {};
  const keptNames = (base.scan?.items ?? []).filter((i) => bins[i.id] === "keep" || bins[i.id] === "move").map((i) => i.name.toLowerCase()).join(" ");
  const said = herWords.toLowerCase();
  const mine = (t: string) => {
    let out = t;
    if (name && new RegExp(`\\b${name}\\b`).test(out)) {
      out = out
        .replace(new RegExp(`\\b${name}'s\\b`, "g"), "your")
        .replace(new RegExp(`\\b${name} (is|has|was)\\b`, "g"), (_, v: string) => `you ${({ is: "are", has: "have", was: "were" } as Record<string, string>)[v]}`)
        .replace(new RegExp(`\\b${name} (\\w+[^s'\\W])s\\b`, "g"), "you $1")
        .replace(new RegExp(`\\b${name}\\b`, "g"), "you")
        .replace(/\bher\b/g, "your")
        .replace(/\bherself\b/g, "yourself");
    }
    return out.replace(OWNED, (m, adj: string, noun: string) => {
      const w = noun.toLowerCase().slice(0, 5);
      return said.includes(w) || keptNames.includes(w) ? m : `${adj}${noun}`;
    });
  };
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const sp = base.space;
  // sizes checked against the room: a rug or sofa that can't fit is replaced by the page's own line
  const computed = sp ? spaceLines(sp) : [];
  const fits = (t: string) => {
    if (!sp) return t;
    if (/\brug\b/i.test(t)) {
      const m = t.match(/(\d+(?:\.\d+)?)\s?(?:ft|feet|')?\s?[x×]\s?(\d+(?:\.\d+)?)\s?(?:ft|feet|')?/i);
      if (m) {
        const [a, b] = [Number(m[1]), Number(m[2])];
        if (Math.max(a, b) > sp.length - 3 || Math.min(a, b) > sp.width - 3) return computed.find((x) => x.startsWith("Rug")) ?? t;
      }
    }
    if (/\b(sofa|couch|sectional)\b/i.test(t)) {
      const inch = t.match(/(\d{2,3})\s?(?:in\b|"|inch)/i);
      const feet = t.match(/\b(sofa|couch|sectional)\b[^.;]*?\b(\d{1,2}(?:\.\d)?)\s?(?:ft|feet)\b/i);
      const len = inch ? Number(inch[1]) : feet ? Number(feet[2]) * 12 : 0;
      // only a length, not the 14–18" to the coffee table
      if (len > sp.length * 12 && !/14.18/.test(inch?.[0] ?? "")) return computed.find((x) => x.startsWith("Sofa")) ?? t;
    }
    return t;
  };
  // "X stays" / "keeping X" only for what she said stays or kept in the sort
  const SYNONYM: Record<string, string> = { couch: "sofa", sofa: "sofa", sectional: "sofa", armchair: "chair", chair: "chair" };
  const PIECES = /\b(sofa|couch|sectional|armchair|chair|table|rug|lamp|bookcase|bookshelf|shelves|desk|console|sideboard|cabinet|dresser|mirror|bench|tv|ottoman|pouf|bed|curtains|piano)\b/gi;
  const base5 = (w: string) => SYNONYM[w.toLowerCase()] ?? w.toLowerCase();
  const keptSaid = new Set([
    ...herWords.split(/[.!?\n]+/).filter((x) => /\b(stays?|staying|keep(ing)?|kept|not going anywhere)\b/i.test(x)).flatMap((x) => [...x.matchAll(PIECES)].map((m) => base5(m[0]))),
    ...[...keptNames.matchAll(PIECES)].map((m) => base5(m[0])),
  ]);
  // a blanket "existing pieces stay" / "spend only on gaps" only if she said as much
  const BLANKET = /\b(existing|current|other|all|everything|the rest)\b[^.;]*\b(stays?|staying|kept|keep)\b|\bkeep(ing)? (the |all )?(existing|current) (pieces|furniture|things)|\bspend only on (the )?gaps|\bonly (buy|fill) (the )?gaps|\bfill(ing)? (in )?the gaps\b|\b(fill|furnish) the rest (from|with) what'?s already|\bwhat'?s already in the room\b|\breuse (the |your )?(existing|current) pieces\b/i;
  const saidBlanket = /\b(everything|all of it|the rest|existing pieces?|what i (have|own))\b[^.]*\b(stays?|staying|keep(ing)?)\b|\bkeep(ing)? everything\b/i.test(herWords);
  const keepOK = (t: string) => {
    if (BLANKET.test(t) && !saidBlanket) return false;
    // a claim that something is retained, not "keep the walkways clear"
    if (!/\b(stays|staying|kept)\b|^\s*keeping\b|\bkeeping:/i.test(t)) return true;
    const pieces = [...t.matchAll(PIECES)].map((m) => base5(m[0]));
    return !pieces.length || pieces.some((p) => keptSaid.has(p));
  };
  // a blanket clause is cut from its line, so "$2,000 for the whole room; existing pieces stay" keeps its budget
  const unblanket = (t: string) => (saidBlanket ? t : t.split(/;\s*/).filter((part) => !BLANKET.test(part)).join("; "));
  const lines = (xs: string[]) => xs.map(unblanket).filter((x) => x.trim() && keepOK(x)).map((x) => cap(fits(mine(x))));
  const questions = (xs: string[]) => xs.map((x) => cap(mine(x)));
  const lightOK = (x: string) => !sp || !wrongLight(x, sp, herWords);
  return {
    ...c,
    statement: cap(mine(c.statement)),
    program: lines(c.program),
    constraints: lines(c.constraints),
    direction: lines(c.direction).filter(lightOK),
    decisions: c.decisions.map((d) => ({ ...d, decision: unblanket(d.decision) })).filter((d) => d.decision.trim() && lightOK(`${d.decision} ${d.because}`) && keepOK(d.decision)).map((d) => ({ decision: cap(fits(mine(d.decision))), because: mine(d.because) })),
    nevers: lines(c.nevers),
    open_questions: questions(c.open_questions),
  };
}

// A never is hers when she said it or tapped it: a rejected room is one never (its first words, as the page
// draws it), never itemized into "a black table", "a chandelier" read off the photo
function neverHers(line: string, herWords: string, t: TasteState): boolean {
  if (related(line, herWords)) return true;
  const tapped = [
    ...t.palettes.never.map((id) => PALETTE.get(id)?.name ?? id),
    ...t.materials.never.map((id) => MATERIAL.get(id)?.label ?? id),
    ...t.patterns.never.map((id) => PATTERN.get(id)?.label ?? id),
    ...t.rooms.never.map((id) => (ROOM.get(id)?.alt ?? id).split(/,| with | under | onto | against /)[0]),
  ];
  return tapped.some((x) => similar(x, line));
}

// The brief is written to her: "her sister" → "your sister", "she" → "you"
// Only where "her" can only be her: a line that names someone or something else (Ama, the cat, a sister)
// keeps its pronouns, since "her own bed" there is the cat's
// (case-insensitive for the kin and pet words: "Dog sleeps on the sofa; the armchair is off-limits to her"
// is the dog's, and was being cut to "…off-limits to your")
const OTHER_KIN = /\b(cat|kitten|dog|puppy|lab|mum|mom|mother|sister|grand\w+|girlfriend|boyfriend|wife|husband|partner|daughter|son|aunt|friend|roommate)\b/i;
const OTHER_NAME = /(?<!^)(?<![.!?]\s)\b[A-Z][a-z]+\b/;
const OTHERS = { test: (t: string) => OTHER_KIN.test(t) || OTHER_NAME.test(t) };
// "her sister" is hers, unless the line names someone else whose sister it could be
const KIN_OF_HERS = /\bher (mum|mom|mother|sister|brother|grand\w+|dad|father|partner|girlfriend|boyfriend|husband|wife|aunt|uncle|friend)\b/gi;
const NAMED = /(?<!^)(?<![.!?]\s)\b[A-Z][a-z]+\b/;
const toYou = (raw: string) => {
  const t = NAMED.test(raw) ? raw : raw.replace(KIN_OF_HERS, "your $1");
  return OTHERS.test(t)
    ? t
    : t
        .replace(/\bshe's\b/gi, "you're").replace(/\bshe is\b/gi, "you are").replace(/\bshe has\b/gi, "you have").replace(/\bshe was\b/gi, "you were").replace(/\bshe does\b/gi, "you do")
        .replace(/\bshe (\w+?)(ss|sh|ch|x)es\b/gi, "you $1$2").replace(/\bshe (\w+[^s'])s\b/gi, "you $1")
        .replace(/\bherself\b/gi, "yourself").replace(/\bher\b/gi, "your").replace(/\bshe\b/gi, "you").replace(/\bhers\b/gi, "yours");
};
function cleanConcept(c: BriefOut): BriefOut {
  const lines = (xs: string[]) => xs.map((x) => toYou(kept(unescape(x)))).filter(Boolean);
  return {
    title: unescape(c.title),
    statement: toYou(deFluff(unescape(c.statement))),
    moods: moodsOK(c.moods.map(unescape), true),
    program: lines(c.program),
    constraints: lines(c.constraints),
    direction: lines(c.direction),
    decisions: c.decisions.map((d) => ({ decision: toYou(kept(unescape(d.decision))), because: toYou(kept(unescape(d.because))) })).filter((d) => d.decision && d.because),
    nevers: lines(c.nevers),
    open_questions: lines(c.open_questions),
  };
}

// Log-style lines ("gecko campaign (Theo), answer: no") are bookkeeping, not notes
const LOG = /\b(answer|answered|question|recorded)\s*:/i;

// unconfirmed: claims she never said or confirmed (pencil lines, the tree's guesses), each as a
// pattern that finds it in the statement; anything matching that her own words don't is dropped.
export function applyTurn(base: Omit<Known, "answers">, s: State, raw: Turn, shown: string[] = [], facts: { id: string; text: string }[] = [], unconfirmed: RegExp[] = []): { state: State; recorded: string[] } {
  const herWords = s.convo.transcript.filter((l) => l.who === "you" && !l.event).map((l) => l.text).join(" \n ");
  const lastSaid = [...s.convo.transcript].reverse().find((l) => l.who === "you");
  const readbackBefore = !!s.convo.concept && (s.convo.section === "readback" || s.convo.section === "done");
  const turn: Turn = {
    ...raw,
    say: tidySay(unescape(raw.say), lastSaid && !lastSaid.event ? lastSaid.text : "", readbackBefore, herWords),
    // the page and the brief carry no stock filler ("a sanctuary", "gathered", "timeless"): lib/taste/craft.ts
    dossier: raw.dossier.map((e) => ({ ...e, text: kept(unescape(e.text)), because: e.because && (kept(unescape(e.because)) || null) })),
    concept: raw.concept ? cleanConcept(raw.concept) : null,
  };
  const k: Known = { ...base, answers: s.answers };
  // the tree checks every value against its choices; anything it rejects is left out
  const order = QUESTIONS.map((q) => q.id);
  const found = [...turn.answers].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).map((a) => ({ id: a.id, value: a.value as Answer }));
  const { answers, recorded } = recordAll(k, found);
  const notes = turn.notes.reduce(noteDetail, s.notes);
  const c = s.convo;
  const at = c.turns + 1;

  // what the designer recorded stays pencil until her own words (or a tap) confirm it. A multi answer is
  // judged per choice: the choices she named are ink, the ones she didn't are dropped ("sleeping" in a
  // living room she never mentioned), and only if she named none does the whole answer stay pencil.
  const last = [...c.transcript].reverse().find((l) => l.who === "you");
  const designerSet = new Set(c.designerSet ?? []);
  for (const id of recorded) {
    const v = answers[id];
    const q = QUESTIONS.find((x) => x.id === id);
    if (last && !last.event && q?.kind.type === "multi" && Array.isArray(v)) {
      const named = v.filter((ch) => choiceSaid(id, ch, last.text));
      if (named.length && named.length < v.length) answers[id] = named;
    }
    const quote = turn.answers.find((a) => a.id === id)?.quote ?? "";
    if (last && (last.event || (hers(quote, last.text) && namedAll(id, answers[id], last.text)))) designerSet.delete(id);
    else designerSet.add(id);
  }

  // corrections cross out exactly the line named by its [id], never a near match (dossier.md §3.3)
  let dossier = c.dossier;
  const crossedFacts = [...(c.crossedFacts ?? [])];
  const cross = (raw: string | null | undefined) => {
    const id = (raw ?? "").replace(/^\[|\]$/g, "").trim();
    if (!id) return false;
    if (dossier.some((d) => d.id === id && !d.crossed)) {
      dossier = dossier.map((d) => (d.id === id ? { ...d, crossed: true } : d));
      return true;
    }
    const fact = facts.find((f) => f.id === id);
    if (fact) {
      crossedFacts.push(`${id.slice(2)}::${norm(fact.text)}`);
      return true;
    }
    return false;
  };
  // a cross-out has to be about what she just said: a correction to the table never takes her tapped
  // hard nos (jewel tones, black steel) with it
  const lineOf = (raw: string) => {
    const id = raw.replace(/^\[|\]$/g, "").trim();
    return dossier.find((d) => d.id === id)?.text ?? facts.find((f) => f.id === id)?.text ?? "";
  };
  for (const id of turn.cross_out) if (!lastSaid || lastSaid.event || related(lineOf(id), lastSaid.text)) cross(id);
  for (const raw of turn.dossier) {
    // a literal arrow in the text is a "because": "Tom moved in → two rooms' worth" draws as a line and an arrow
    const [head, ...tail] = raw.text.split(/\s*(?:→|->|=>)\s*/);
    const e = { ...raw, text: head.trim(), because: raw.because ?? (tail.join(", ").trim() || null) };
    if (!e.text || LOG.test(e.text)) continue;
    if (e.zone === "never" && !neverHers(e.text, herWords, s.taste)) continue;
    const corrected = cross(e.replaces);
    const onPage = [...shown, ...dossier.filter((d) => !d.crossed).flatMap((d) => [d.text, d.because ?? ""])];
    if (dossier.some((d) => !d.crossed && norm(d.text) === norm(e.text))) continue;
    if (!corrected && onPage.some((t) => t && similar(t, e.text))) continue;
    const because = e.because && onPage.some((t) => t && similar(t, e.because!)) ? null : e.because;
    dossier = [...dossier, { id: `${at}-${dossier.length}`, zone: e.zone, text: e.text, because, icon: e.icon, sure: e.sure, at }];
  }

  // a style they said isn't them leaves the blend, goes under Never in ink, and stops being their "look"
  let taste = scoreWords(s.taste, turn.styles);
  // a style goes under Never only from her words, never from a picture she passed on
  const notStyles = lastSaid && !lastSaid.event ? turn.not_styles.filter((f) => styleNamed(f, lastSaid.text)) : [];
  if (notStyles.length) {
    const styles = { ...taste.styles };
    for (const f of notStyles) {
      delete styles[f];
      const text = `no ${FAMILIES[f]}`;
      if (!dossier.some((d) => !d.crossed && d.zone === "never" && similar(d.text, text)))
        dossier = [...dossier, { id: `${at}-${dossier.length}`, zone: "never", text, sure: true, at }];
      if (answers.look === LOOK_OF[f]) {
        delete answers.look;
        for (const id of Object.keys(answers)) if (id.startsWith("look_")) delete answers[id];
      }
    }
    taste = { ...taste, styles, excluded: [...new Set([...(taste.excluded ?? []), ...notStyles])] };
  }

  // mood words only when she used them (or the read-back's three, once, and then they hold still)
  const hersOnly = turn.moods.map((m) => m.toLowerCase().trim()).filter((m) => m && herWords.toLowerCase().includes(m.slice(0, 4)));
  const moods = moodsOK([...new Set([...c.moods, ...hersOnly])]).slice(-2);
  // the truth rule on every line of the brief: an unconfirmed claim her words don't back is dropped;
  // a decision stands only on a fact she gave
  const untrue = (x: string) => unconfirmed.some((re) => re.test(x) && !re.test(herWords));
  // every line of a brief, first draft or edit, goes through the same filters; room lines fill in only
  // on the first draft
  const prepare = (raw: BriefOut, first: boolean): BriefOut => {
    const tc = ownBrief(raw, herWords, base);
    const sp = base.space;
    const dir = tc.direction.filter((x) => !untrue(x) && !photoMaterial(x, herWords, taste));
    let direction = dir;
    if (first && sp) {
      const have = [...dir, ...tc.decisions.map((d) => d.decision)].filter(measured).length;
      const light = lightLine(sp, herWords);
      const fill = spaceLines(sp, herWords).filter((x) => !dir.some((d) => similar(d, x)) && x !== light).slice(0, Math.max(0, 2 - have));
      // the window's light, by its orientation (hers if she gave one), unless a line already treats it
      const lit = [...dir, ...tc.decisions.map((d) => d.decision)].some((x) => /\b(sheers?|shades?|blinds?|glare|curtains?|drapery|sun)\b/i.test(x));
      direction = [...dir, ...fill, ...(light && !lit ? [light] : [])];
    }
    return {
      ...tc,
      statement: truthful(tc.statement, herWords, unconfirmed),
      program: tc.program.filter((x) => !untrue(x)),
      constraints: tc.constraints.filter((x) => !untrue(x)),
      decisions: tc.decisions.filter((d) => !untrue(d.because)),
      // a rejected room is named by its first clause, as the page draws it
      nevers: tc.nevers.filter((x) => neverHers(x, herWords, taste)).map((x) => trimNever(x, taste)).filter((x, i, all) => all.findIndex((y) => norm(y) === norm(x)) === i),
      // the room's size and windows are known: never an open question
      open_questions: sp ? tc.open_questions.filter((x) => !/dimension|measure|window|size of the room|room size|square f/i.test(x)) : tc.open_questions,
      direction,
    };
  };
  const concept = c.concept && turn.edits?.length
    ? applyEdits(c.concept, turn.edits, (b) => prepare(cleanConcept(b), false))
    : keepConcept(c.concept, turn.concept && prepare(turn.concept, true), herWords, notes, dossier);
  const buckets = { ...c.buckets };
  // the section only moves forward; a turn that lags behind a "finished with this section" stays put
  const section = ORDER.indexOf(turn.section) >= ORDER.indexOf(c.section) ? turn.section : c.section;
  // the pace: their priorities, a length they asked for (or that their priorities point to, when they
  // didn't pick one), and the stopping point once offered
  let pace: Pace = c.pace ?? newPace();
  if (turn.priorities && lastSaid && !lastSaid.event) pace = { ...pace, priorities: { words: unescape(turn.priorities.words), protect: turn.priorities.protect } };
  const asked = lastSaid && !lastSaid.event ? askedLength(lastSaid.text, pace.length) : null;
  if (asked) pace = { ...pace, length: asked, chosen: true };
  else if (turn.resize !== "none" && !pace.chosen && turn.priorities) {
    // never shorter when the look or getting it right matters to them
    const careful = turn.priorities.protect.some((p) => p === "style" || p === "just_right");
    if (!(turn.resize === "quick" && careful)) pace = { ...pace, length: turn.resize };
  }
  const here = c.section as (typeof SECTION_KEYS)[number];
  // the stopping point, enforced: once Who you are (or Space and style) has its minimum, at a length with
  // room to go deeper, she's offered it before anything else, even if the model moved on or kept asking
  let say = turn.say;
  let show = turn.show;
  let stopOffered = turn.stop_offered;
  let next: SectionId = section;
  if (!stopOffered && (here === "you" || here === "style") && pace.length !== "quick" && !pace.offered.includes(here) && next !== "readback" && !c.concept) {
    const facts = { answers, shown: taste.shown, practical: dossier.filter((d) => d.zone === "practical" && !d.crossed).map((d) => d.text) };
    const before = missing(c.pace ?? newPace(), here, { ...facts, answers: s.answers, shown: s.taste.shown });
    const covered = !missing(pace, here, facts).length;
    const room = (pace.replies[here] ?? 0) < target(pace, here);
    // only on the turn the minimum is first met (or later, if it was never offered) and depth is still on the table
    if (covered && room && (before.length > 0 || next !== here || turn.show === "none")) {
      say = "That's enough for me to go on. Keep going, or move on?";
      show = "none";
      stopOffered = true;
      next = here;
    }
  }
  // never re-ask a budget or a date she already gave: confirm it and go one step deeper
  if (!stopOffered && say.includes("?")) {
    const practical = dossier.filter((d) => d.zone === "practical" && !d.crossed).map((d) => d.text);
    const asks = say.split(/(?<=[.!?])\s+/).find((x) => x.includes("?")) ?? "";
    const figure = practical.find((t) => /[$£€]|\d|thousand|grand/i.test(t))?.replace(/^budget:\s*/i, "");
    const budgetKnown = figure || answers.budget !== undefined;
    const dateText = practical.find((t) => !/^budget/i.test(t) && /\b(by|before|until|for|christmas|thanksgiving|holiday|month|week|spring|summer|autumn|fall|winter|move|visit)\b/i.test(t));
    if (budgetKnown && /\b(spend|budget|price range|afford)\b/i.test(asks)) {
      const cap = /\b(cap|max|ceiling|can'?t go over|tops|no more than|under)\b/i.test(`${figure ?? ""} ${herWords}`);
      const amount = figure?.match(/(?:[$£€]\s?\d[\d,.]*\s?k?|\d[\d,.]*\s?k\b|\b\w+ thousand\b)/i)?.[0].trim();
      const what = amount ?? figure ?? (QUESTIONS.find((q) => q.id === "budget")?.kind as { choices?: { id: string; label: string }[] }).choices?.find((c) => c.id === answers.budget)?.label.toLowerCase() ?? "That budget";
      say = `${what.charAt(0).toUpperCase()}${what.slice(1)} ${cap ? "is the ceiling" : "it is"}. Is there one piece you'd put most of it into?`;
    } else if ((dateText || answers.timeline !== undefined) && /\b(date|ready|deadline|when would|by when|how soon|timeline)\b/i.test(asks)) {
      say = `${dateText ? `${dateText.charAt(0).toUpperCase()}${dateText.slice(1)}` : "That timing"}, noted. Does all of it need to be in place by then, or can some follow later?`;
    }
  }
  if (stopOffered && SECTION_KEYS.includes(here) && !pace.offered.includes(here)) pace = { ...pace, offered: [...pace.offered, here] };
  for (const b of turn.buckets) buckets[b.bucket] = { weight: b.weight, because: b.because };

  return {
    recorded,
    state: {
      answers,
      notes,
      taste,
      convo: {
        ...c,
        turns: at,
        section: next,
        pace,
        transcript: [...c.transcript, { who: "agent", text: say }],
        dossier,
        moods,
        quotes: turn.quote ? [...c.quotes, turn.quote] : c.quotes,
        buckets,
        inferred: [...c.inferred, ...turn.styles.map((x) => ({ family: x.family, weight: x.weight, because: x.because }))].slice(-24),
        concept,
        crossedFacts,
        designerSet: [...designerSet].filter((id) => answers[id] !== undefined),
        showing: show !== "none" && !s.taste.shown.includes(show) ? show : undefined,
        // chips only under a line that asks something
        // the priorities question lists through its chips, so it gets all of them
        suggestions: stopOffered ? ["Keep going", "Move on"] : say.includes("?") ? turn.suggestions.slice(0, /priorities lie/i.test(say) ? 6 : 3) : [],
      },
    },
  };
}

// The visual picks answer tree questions too (look, color, materials, pattern, avoid)
export function applyTaste(base: Omit<Known, "answers">, s: State, taste: TasteState): State {
  const k: Known = { ...base, answers: s.answers };
  const open = treeAnswers(taste).filter((a) => s.answers[a.id] === undefined || ["look", "color", "materials", "pattern"].includes(a.id));
  const { answers } = recordAll(k, open);
  return { ...s, taste, answers: { ...s.answers, ...answers } };
}

export const emptyState = (answers: Record<string, Answer> = {}, notes: string[] = []): State => ({ answers, notes, taste: EMPTY_TASTE, convo: newConvo() });

// ---- What the agent (and the dossier) can see of the tree ---------------------------------

// Every question that applies, by section, with what's known: the model's map
export function treeBrief(k: Known): string {
  const steps = walk(k, "all");
  const lines: string[] = [];
  for (const sec of SECTION_KEYS) {
    lines.push(`## ${sec}`);
    for (const st of steps) {
      if (st.status === "hidden" || SECTION_OF[st.id] !== sec) continue;
      const q = QUESTIONS.find((x) => x.id === st.id)!;
      const kind = q.kind;
      const choices = kind.type === "single" || kind.type === "multi" ? [...(q.choicesFrom?.(k) ?? []), ...kind.choices].map((c) => `${c.id}=${c.label}`).join(", ") : kind.type === "number" ? `whole number ${kind.min}-${kind.max}` : "their words";
      const said = k.answers[st.id];
      // the persona halves are read from what they say, never asked (the priorities question, tradeoff, is asked)
      const internal = ["start", "approach"].includes(q.id);
      const state =
        internal && said === undefined ? "READ, DON'T ASK: infer it from what they've said; record it only if they say it plainly"
        : said !== undefined ? `ANSWERED: ${JSON.stringify(said)}`
        : st.status === "skip" ? `KNOWN (don't ask): ${JSON.stringify(st.value)} because ${st.because}`
        : st.status === "prefill" ? `GUESS, unconfirmed (never state it as fact; never ask about it directly): ${JSON.stringify(st.value)} because ${st.because}`
        : "OPEN";
      lines.push(`- ${q.id}${q.core ? " (core)" : ""} [${kind.type}: ${choices}] "${q.prompt}" → ${state}`);
    }
  }
  return lines.join("\n");
}

// The room as the scan read it, in a few lines
export function roomBrief(base: Omit<Known, "answers">, said = ""): string {
  const i = base.intake;
  const out: string[] = [];
  if (i?.room) out.push(`Room: ${i.room}${i.scope && i.scope !== "room" ? ` (first room of a ${i.scope})` : ""}`);
  if (i?.access) out.push(i.access === "yes" ? "They live in it now." : "They can't be in the space yet.");
  const sp = base.space;
  if (sp) out.push(`Size (from the capture, known; use it): ${sizeLine(sp)}${sp.windows.length ? ` (${sp.windows.map((w) => `${w.width} ft wide`).join(", ")})` : ""}. Light: ${sp.light}${facing(sp, said) ? `. The window faces ${facing(sp, said)}${stated(said) ? " (they said so; it overrides the capture)" : ""}: ${LIGHT_BY_FACING[facing(sp, said)!]}. Any light line must match this` : ""}`);
  const sig = base.scan?.profile_signals;
  if (sig) out.push(`The scan read the style as ${sig.style.join(", ")}; pieces ${sig.price_level}; lifestyle hints: ${sig.lifestyle.join(", ") || "none"}. (A reading, not something they said; owning isn't loving.)`);
  const bins = base.sort?.bins ?? {};
  const items = base.scan?.items ?? [];
  const by = (b: string) => items.filter((x) => bins[x.id] === b).map((x) => x.name);
  if (items.length) {
    const kept = by("keep");
    const moved = by("move");
    const removed = by("remove");
    const untouched = items.filter((x) => !bins[x.id]).map((x) => x.name);
    if (kept.length) out.push(`They tapped Keep on: ${kept.join(", ")}`);
    if (moved.length) out.push(`Keeping but moving: ${moved.join(", ")}`);
    if (removed.length) out.push(`Getting rid of: ${removed.join(", ")}`);
    if (untouched.length) out.push(`Left unsorted (says nothing): ${untouched.join(", ")}`);
  }
  if (i?.bringing === "yes") out.push(`Bringing from elsewhere: ${(i.brought ?? []).join(", ") || "some pieces"}`);
  return out.join("\n") || "No room captured yet; nothing is known about the space.";
}
