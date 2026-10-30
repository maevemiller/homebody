import { QUESTIONS, walk, type Answer, type Choice, type Known, type Question, type Step } from "./questions";

// The Taste Builder conversation layer (docs/voice-plan.md, Phase 0). The tree
// in questions.ts stays the map; this file is how an agent walks it out loud:
// the agent's prompt, its tools as schemas plus the pure functions behind them,
// the spoken version of each question, test personas, and a free keyword
// interpreter that stands in for the live agent until Phase 1.

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

// The system prompt for the live agent (Phase 1: ElevenLabs + Claude). Versioned
// here with the tree it walks, and pushed to the platform by a setup script.
export const AGENT_PROMPT = `You are Homebody's interior designer, getting to know someone before you plan their room. This is a short spoken conversation, about five minutes.

Tone: warm, unhurried and brief, like a good designer on a first visit. Plain words. One or two short sentences a turn. Never salesy, never gushing.

How the conversation works:
- Call get_state at the start and after every answer. It tells you what's already known, what we've guessed and why, and the next open questions with their choices. Ask from those; the tree decides what comes next, you decide how to say it.
- Ask one question per turn. Never stack two.
- Open with a short hello and one line about what you saw in their room, then the first question.
- When a question has a prefill, ask it as a confirmation that cites the because, in your own words: "I noticed you're keeping the walnut console and TV, so this sounds like a refresh. Is that right?" Vary how you confirm; not every turn is "Is that right?". Never judge their things by price or taste.
- Honor corrections. When an answer overrules a prefill, say it back ("A fresh start, got it.") and never cite the overruled evidence again. If they're starting fresh, don't bring up the pieces they're keeping.
- Say back what you heard in a few words before moving on ("Four of you, with a four- and a seven-year-old."), naming what they actually said. Never reuse the same acknowledgement in one conversation.
- Never read out more than four options. If a question has more, name two or three and say the rest are on screen, or call show(question_id) so they can tap.
- Accept answers out of order. If one reply covers several questions ("it's me, my partner and our two kids, 4 and 7"), call record_answer once for each question it answers, then don't ask those again.
- Only record values from the question's choices; record_answer rejects anything else. If you're unsure which choice they meant, ask a short follow-up.
- When they share something personal (a person, a place, a memory, an object with a story, like "my grandmother loved butterflies"), call note_detail with it in their words, name it back in one short line ("Butterflies. I'll remember that."), and come back to the question. If it touches a loss (late, passed, died, miss), answer with care ("I'm sorry about your grandfather."), never "lovely".
- Never mention the profile, the persona, buckets, the tree, or that you're guessing from a scan. Talk about their room and their life.
- After the core questions are done, offer to keep going for a few more or to stop there. Either is fine; say so. When they stop, or nothing is left, recap in one or two sentences what you learned (their look, how they want it put together, who it's for, one detail they shared), say what happens next, and call finish(). When they come back, open with one line of that recap before the next question.
- If they want to stop at any point, let them, kindly. Everything they've said is already saved.`;

// Tool schemas for the live agent, as plain objects with JSON-schema parameters.
// They run in the browser against the tree, so the screen stays the single truth.
export const TOOLS = [
  {
    name: "get_state",
    description: "What's known so far, the prefills with their because, and the next open questions with their choices. Call at the start and after each answer.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "record_answer",
    description: "Save an answer to one question. The value must be one of the question's choice ids (a list of ids for multi-choice), a whole number in range, or free text. Returns an error to read and correct if it isn't.",
    parameters: {
      type: "object",
      properties: {
        question_id: { type: "string", description: "A question id from get_state" },
        value: {
          description: "A choice id; a list of choice ids for a multi question; a number; or free text for a text question",
          anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }, { type: "number" }],
        },
        quote: { type: "string", description: "Their words that gave this answer, verbatim" },
      },
      required: ["question_id", "value", "quote"],
      additionalProperties: false,
    },
  },
  {
    name: "note_detail",
    description: "Keep a personal-story detail they shared (a person, place, memory or object with a story), in their words.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", description: 'In their words, e.g. "My grandmother loved butterflies"' } },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "show",
    description: "Put a question and its choices on screen as tappable chips, for when speech can't carry it (eight looks, their own pieces).",
    parameters: {
      type: "object",
      properties: { question_id: { type: "string" } },
      required: ["question_id"],
      additionalProperties: false,
    },
  },
  {
    name: "finish",
    description: "End the conversation once they've chosen to stop or nothing is left to ask.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

// ---- The tools, as pure functions over the tree --------------------------------

export function choicesOf(q: Question, k: Known): Choice[] {
  return q.kind.type === "single" || q.kind.type === "multi" ? [...(q.choicesFrom?.(k) ?? []), ...q.kind.choices] : [];
}

// An answer in words, using the question's own choice labels
export function labelOf(q: Question, k: Known, a: Answer): string {
  if (typeof a === "number") return String(a);
  const choices = choicesOf(q, k);
  const label = (id: string) => choices.find((c) => c.id === id)?.label ?? id;
  if (Array.isArray(a)) return a.map(label).join(", ");
  return q.kind.type === "text" ? (a.trim() || "Nothing came to mind") : label(a);
}

export interface OpenQuestion {
  id: string;
  core: boolean;
  prompt: string;
  // how the agent would say it, prefill confirmation included
  spoken: string;
  kind: Question["kind"]["type"];
  choices?: Choice[];
  min?: number;
  max?: number;
  prefill?: Answer;
  because?: string;
}

export interface AgentState {
  // answered (said) or inferred firmly enough not to ask (sure)
  known: { id: string; value: string; how: "said" | "sure" }[];
  prefills: { id: string; value: Answer; label: string; because: string }[];
  // the next 1–3 open questions, core first
  next: OpenQuestion[];
  core_done: boolean;
}

const isOpen = (st: Step, k: Known) => (st.status === "ask" || st.status === "prefill") && k.answers[st.id] === undefined;

function openQuestion(step: Step, k: Known): OpenQuestion {
  const st = asked(step, k);
  const q = BY_ID.get(st.id)!;
  const kind = q.kind;
  return {
    id: q.id, core: q.core, prompt: q.prompt, spoken: spokenLine(q, st, k), kind: kind.type,
    ...(kind.type === "single" || kind.type === "multi" ? { choices: choicesOf(q, k) } : {}),
    ...(kind.type === "number" ? { min: kind.min, max: kind.max } : {}),
    ...(st.status === "prefill" ? { prefill: st.value, because: st.because } : {}),
  };
}

// get_state
export function getState(k: Known): AgentState {
  const steps = walk(k, "all");
  const open = steps.filter((st) => isOpen(st, k));
  const core = open.filter((st) => BY_ID.get(st.id)!.core);
  return {
    known: steps.flatMap((st) =>
      st.status === "skip" ? [{ id: st.id, value: labelOf(BY_ID.get(st.id)!, k, st.value), how: k.answers[st.id] !== undefined ? ("said" as const) : ("sure" as const) }] : [],
    ),
    prefills: steps.map((st) => asked(st, k)).flatMap((st) =>
      st.status === "prefill" && k.answers[st.id] === undefined ? [{ id: st.id, value: st.value, label: labelOf(BY_ID.get(st.id)!, k, st.value), because: st.because }] : [],
    ),
    next: (core.length ? core : open).slice(0, 3).map((st) => openQuestion(st, k)),
    core_done: core.length === 0,
  };
}

// record_answer: checks the value against the question before anything is saved,
// so the agent can't invent options. Returns the new answers, with any answer the
// change now hides dropped (kids → No drops kid ages), or an error to read back.
export function recordAnswer(k: Known, questionId: string, value: unknown): { answers: Record<string, Answer> } | { error: string } {
  const q = BY_ID.get(questionId);
  if (!q) return { error: `There's no question "${questionId}". Call get_state for the open ones.` };
  const st = walk(k, "all").find((x) => x.id === questionId);
  if (st?.status === "hidden") return { error: `"${questionId}" doesn't apply after their earlier answers.` };
  const kind = q.kind;
  const choices = choicesOf(q, k);
  const toId = (v: unknown) => (typeof v === "string" ? choices.find((c) => c.id === v || c.label.toLowerCase() === v.toLowerCase())?.id : undefined);
  const list = choices.map((c) => c.id).join(", ");
  let saved: Answer;
  if (kind.type === "single") {
    const id = toId(value);
    if (!id) return { error: `"${String(value)}" isn't a choice for ${questionId}. Choices: ${list}.` };
    saved = id;
  } else if (kind.type === "multi") {
    const raw = Array.isArray(value) ? value : [value];
    const ids = raw.map(toId);
    const bad = raw.filter((_, n) => !ids[n]);
    if (!raw.length) return { error: `Pick at least one choice for ${questionId}. Choices: ${list}.` };
    if (bad.length) return { error: `${bad.map((b) => `"${String(b)}"`).join(", ")} isn't a choice for ${questionId}. Choices: ${list}.` };
    const picked = [...new Set(ids as string[])];
    const excl = picked.filter((id) => choices.find((c) => c.id === id)?.exclusive);
    if (excl.length && picked.length > 1) return { error: `"${excl[0]}" can't go with other choices for ${questionId}.` };
    saved = picked;
  } else if (kind.type === "number") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < kind.min || n > kind.max) return { error: `${questionId} needs a whole number from ${kind.min} to ${kind.max}.` };
    saved = n;
  } else {
    if (typeof value !== "string") return { error: `${questionId} takes their words as text.` };
    saved = value.trim();
  }
  const answers = { ...k.answers, [questionId]: saved };
  for (const x of walk({ ...k, answers }, "all")) if (x.status === "hidden") delete answers[x.id];
  return { answers };
}

// Several record_answer calls in a row, as the agent makes them after one reply:
// in tree order, so "kids: at home" opens kid ages before the ages are checked.
// Anything the tree rejects is left out, as the live agent would correct it.
export function recordAll(k: Known, found: { id: string; value: Answer }[]): { answers: Record<string, Answer>; recorded: string[] } {
  let answers = k.answers;
  const recorded: string[] = [];
  for (const f of found) {
    const r = recordAnswer({ ...k, answers }, f.id, f.value);
    if ("error" in r) continue;
    answers = r.answers;
    recorded.push(f.id);
  }
  return { answers, recorded };
}

// note_detail
export function noteDetail(notes: string[], text: string): string[] {
  const t = text.trim().replace(/[,;]+$/, "");
  if (!t || notes.some((n) => n.toLowerCase() === t.toLowerCase())) return notes;
  return [...notes, t.charAt(0).toUpperCase() + t.slice(1)];
}

// show: the card and chips for one question, or an error for the agent
export function showQuestion(k: Known, questionId: string): OpenQuestion | { error: string } {
  const st = walk(k, "all").find((x) => x.id === questionId);
  if (!st) return { error: `There's no question "${questionId}".` };
  if (st.status === "hidden") return { error: `"${questionId}" doesn't apply after their earlier answers.` };
  return openQuestion(st, k);
}

// ---- What the agent says -----------------------------------------------------

const listed = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
// a label mid-sentence ("Warm mid-century" → "warm mid-century"), leaving "TV" alone
const lower = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// at most four things said in a row, then "and a few more"
const fewOf = (xs: string[]) => (xs.length > 4 ? `${xs.slice(0, 3).join(", ")} and a few more` : listed(xs));
const word = (n: number) => NUM_WORDS[n] ?? String(n);

// A piece's name as said in passing: "Walnut media console" → "walnut console", "Bouclé armchair" → "armchair"
const shortName = (name: string) => {
  const w = lower(name).split(/\s+/);
  return w.length >= 3 ? `${w[0]} ${w[w.length - 1]}` : w[w.length - 1];
};

// The pieces they tapped Keep or Move on, as said aloud ("the walnut console, TV and armchair")
function keptNames(k: Known): string[] {
  const kept = (k.scan?.items ?? []).filter((i) => k.sort?.bins?.[i.id] === "keep" || k.sort?.bins?.[i.id] === "move").map((i) => shortName(i.name));
  return kept.length > 3 ? [...kept.slice(0, 2), "a few other pieces"] : kept;
}

// The evidence a prefill rests on, by kind, so one correction retires it for every later question
function evidence(id: string, value: Answer, k: Known): string {
  switch (id) {
    case "start":
      return value === "refresh" ? "kept" : k.intake?.access === "no" ? "intake" : "removed";
    case "approach":
      return k.intake?.bringing === "yes" || k.intake?.wish === "yes" ? "intake" : value === "customized" ? "kept" : "removed";
    case "budget":
      return "scan.price";
    case "uses":
    case "work_from_home":
      return "scan.items";
    case "look":
      return "scan.style";
    case "color":
      return k.answers.look !== undefined ? "answers.look" : "scan.style";
    case "priorities":
      return "moved";
    case "materials":
      return "kept";
    default:
      return `answers.${id}`;
  }
}

// The evidence they've overruled: whatever a guess rested on when they answered it differently.
// Worked out from the answers alone, so it still holds when they come back another day.
export function overruled(k: Known): Set<string> {
  const out = new Set<string>();
  for (const q of QUESTIONS) {
    const a = k.answers[q.id];
    if (a === undefined || !q.known) continue;
    const rest = { ...k.answers };
    delete rest[q.id];
    const r = q.known({ ...k, answers: rest });
    if (!r) continue;
    const v = "skip" in r ? r.skip : r.prefill;
    if (JSON.stringify(v) !== JSON.stringify(a)) out.add(evidence(q.id, v, { ...k, answers: rest }));
  }
  // starting fresh means the scanned room isn't theirs to judge by: nothing kept, and no
  // guesses from its style, its pieces or their price
  if (k.answers.start === "fresh") for (const e of ["kept", "scan.style", "scan.items", "scan.price"]) out.add(e);
  return out;
}

// A step as the agent should ask it: a prefill resting on overruled evidence is asked plainly
export function asked(st: Step, k: Known): Step {
  return st.status === "prefill" && overruled(k).has(evidence(st.id, st.value, k)) ? { id: st.id, status: "ask" } : st;
}

// Spoken versions where the written prompt leaves the choices to the screen: never more than four said aloud
const SPOKEN: Record<string, string> = {
  tradeoff: "Where do your priorities lie with this room?",
  timeline: "When would you love for it to be done? As soon as possible, in the next few months, or no rush at all?",
  budget: "What kind of budget feels right for this? Keeping it lean, somewhere in the middle, or happy to invest?",
  people: "How many people use this room most days? Feel free to tell me who.",
  uses: "What do you mostly use this room for? Relaxing, eating, working, anything goes.",
  priorities: "What does this room most need to get right? More storage, better light, feeling calmer?",
  pets: "Any pets at home?",
  work_from_home: "How often do you work from this room? Most days, sometimes, or never?",
  unwind: "What else helps you unwind in here? Music, games, plants, or just quiet?",
  look: "Which of these feels most like home to you? Warm mid-century, light and Scandinavian, modern and minimal, or one of the others on screen?",
  pattern: "How do you feel about pattern? Love it, a little, or keep it plain?",
  materials: "Which materials do you love having around? Wood, linen, brass, stone, whatever comes to mind.",
  bold_colors: "Which colors pull you in? Greens, blues, terracotta, pinks?",
};

// A prefill becomes a confirmation that cites its because, in the agent's words, phrased a few
// different ways so it doesn't play as a yes/no quiz. Never judges their things by price.
function confirmLine(q: Question, st: { value: Answer }, k: Known): string {
  const v = st.value;
  const said = lower(labelOf(q, k, v));
  const many = fewOf(Array.isArray(v) ? v.map((id) => lower(labelOf(q, k, id))) : [said]);
  const style = (k.scan?.profile_signals.style ?? []).map(lower);
  const kept = keptNames(k);
  switch (q.id) {
    case "start":
      if (v === "refresh" && kept.length) return `You're keeping the ${listed(kept)}, so this sounds like a refresh. Is that right?`;
      return v === "fresh" ? "It sounds like you're starting fresh in a new place. Have I got that right?" : "This sounds like a refresh of a room you already live in. Right?";
    case "approach":
      if (v !== "customized") return "With most of it going, shall I pull a finished room together for you?";
      if (k.intake?.bringing === "yes") return "Since you're bringing pieces with you, should the room be built around them and the things you love?";
      if (k.intake?.wish === "yes") return "You already have something in mind, so should we build the room around you and your things?";
      // they've just confirmed the refresh, so "those pieces" needs no naming
      if (k.answers.start === "refresh") return "And built around those pieces and the things you love, rather than started from scratch?";
      return kept.length ? `Should it be built around the ${listed(kept)} and the things you love?` : "Should it be built around you and the things you love?";
    case "budget":
      return `For budget, would ${said} feel right?`;
    case "uses":
      return `From the room, it looks like a place for ${many}. Anything else?`;
    case "kids":
      return "You mentioned kids' play, so there are kids at home?";
    case "look":
      if (!style.length) return `Does ${said} feel most like home to you?`;
      // what they own isn't always what they love, so it's asked as "still you?"
      return `Your room has a ${listed(style)} feel. ${listed(style) === said ? "Does that still feel like you?" : `Is ${said} still you?`}`;
    case "color":
      return `And for color, ${said}?`;
    case "priorities":
      return "With a few pieces moving, a better layout seems like the main thing. Anything else it needs?";
    case "materials":
      return `A lot of what you kept is ${many}. Do you love those?`;
    case "work_from_home":
      return "Not much working in here, I'd guess?";
    default:
      return `${capital(said)}, I'd guess. Does that sound right?`;
  }
}

// The agent's spoken line for a question: the prompt (already written to be said),
// with the choices spoken where the prompt leaves them out, or a confirmation for a prefill
export function spokenLine(q: Question, step: Step | undefined, k: Known): string {
  const st = step && asked(step, k);
  if (st?.status === "prefill") return confirmLine(q, st, k);
  return SPOKEN[q.id] ?? q.prompt;
}

// The first thing the agent says, in one breath before the first question: hello, and that it's seen the room.
// What it noticed comes in the first question itself, so the opening stays under about ten seconds aloud.
export function opening(k: Known): string {
  if (!k.scan) return "Hi, I'm glad you're here. Let's start with the big picture.";
  return `Hi, I'm glad you're here. I've had a look at ${k.intake?.room ? `your ${k.intake.room.toLowerCase()}` : "your room"}.`;
}

// ---- Saying back what was heard ----

// Answers said back in a few words, where the choice label alone would sound stiff
const SAY: Record<string, Record<string, string>> = {
  start: { fresh: "A fresh start", refresh: "A refresh" },
  approach: { standard: "Pulled together for you", customized: "Built around you and your things" },
  tradeoff: { speed: "Speed first", right: "Getting it just right", budget: "Protect the budget", style: "The look comes first", function: "How it works comes first", custom: "Making it personal" },
  timeline: { asap: "As soon as you can", "1-3mo": "The next few months", no_rush: "No rush" },
  budget: { lean: "Keeping it lean", mid: "Somewhere in the middle", invest: "Happy to invest", unsure: "Not sure yet, and that's fine" },
  kids: { home: "kids at home", visit: "kids who visit", no: "no kids" },
  work_from_home: { daily: "Working in here most days", sometimes: "Working in here sometimes", no: "No working in here" },
  hosting: { weekly: "People over most weeks", sometimes: "People over now and then", rarely: "Not much hosting" },
};

const an = (w: string) => (/^(eight|eleven|eighteen)/.test(w) ? "an" : "a");
// "a four- and a seven-year-old"
function agesSaid(years: number[]): string {
  const w = years.map(word);
  const last = `${an(w[w.length - 1])} ${w[w.length - 1]}-year-old`;
  return w.length === 1 ? last : `${w.slice(0, -1).map((x) => `${an(x)} ${x}-`).join(", ")} and ${last}`;
}

function sayBack(id: string, k: Known): string {
  const q = BY_ID.get(id)!;
  const a = k.answers[id];
  if (id === "people") return a === 1 ? "Just you" : `${capital(word(a as number))} of you`;
  if (id === "pets") return Array.isArray(a) && a.includes("none") ? "No pets" : capital(listed((a as string[]).map((p) => (p === "other" ? "a pet" : `a ${p}`))));
  // their own words stay theirs; a long answer isn't read back to them
  if (q.kind.type === "text") return a ? "" : "Nothing comes to mind, and that's fine";
  const fixed = typeof a === "string" ? SAY[id]?.[a] : undefined;
  if (fixed) return capital(fixed);
  if (Array.isArray(a)) return capital(fewOf(a.map((x) => lower(labelOf(q, k, x)))));
  return labelOf(q, k, a);
}

const HOUSEHOLD = ["people", "kids", "kid_ages"];
// Who it's for, in one breath: "Four of you, with a four- and a seven-year-old"
function householdSaid(rec: string[], k: Known, years?: number[]): string | null {
  const has = (id: string) => rec.includes(id);
  if (!HOUSEHOLD.some(has)) return null;
  const kids = k.answers.kids as string | undefined;
  const p = has("people") ? sayBack("people", k) : "";
  const withKids = has("kid_ages")
    ? `with ${years?.length ? agesSaid(years) : `kids aged ${lower(labelOf(BY_ID.get("kid_ages")!, k, k.answers.kid_ages))}`}`
    : has("kids") && kids
      ? (p && kids !== "no" ? `with ${SAY.kids[kids]}` : SAY.kids[kids])
      : "";
  return capital([p, withKids].filter(Boolean).join(", "));
}

// Loss words are answered with care, never "lovely"
const LOSS = /\b(late|passed|died|dying|miss(ed|ing)?|lost|funeral)\b/i;
const KIN = /\b(grand(?:mother|father|ma|pa|mum|mom|dad)|nana|granny|mother|father|mum|mom|dad|aunt|uncle|sister|brother|husband|wife|partner|friend)\b/i;

// A noted detail named back in a few words: "My grandmother loved butterflies" → "Butterflies"
export function named(note: string): string {
  const loved = note.match(/\blove[sd]?\s+(.+)$/i);
  if (loved) return capital(loved[1].replace(/[.!]+$/, ""));
  return capital(
    note.replace(/^(like|and|but|so)\s+/i, "").replace(/\b(my|our)\b/gi, "your").replace(/\bwe're\b/gi, "you're").replace(/\bI'm\b/g, "you're").replace(/\bwe\b/gi, "you"),
  );
}

// Each used once a conversation, so no acknowledgement repeats
const THANKS = ["Good.", "Perfect.", "Great.", "Lovely.", "Okay."];
const REMEMBER = ["I'll remember that.", "I'll hold on to that.", "I'll keep that in mind.", "That's worth keeping close."];
// A correction said back, each shape once: "A fresh start, got it."
const CORRECTED: [string, (b: string) => string][] = [
  [", got it.", (b) => `${b}, got it.`],
  [", then.", (b) => `${b}, then.`],
  ["Ah, ", (b) => `Ah, ${lower(b)}.`],
  ["Understood: ", (b) => `Understood: ${lower(b)}.`],
];
const PLAIN = ["Thank you for that.", "That helps.", "Good to know.", "Understood.", "Noted."];
const pick = (pool: string[], used: string[], skip?: RegExp) => pool.find((x) => !used.some((u) => u.includes(x)) && !skip?.test(x)) ?? "";

// The agent's reply to one turn: says back what it recorded and names any detail noted.
// k is after the turn; prefill is the guess they were answering, if any; used is
// everything the agent has already said, so nothing repeats.
export function acknowledge(o: { k: Known; cur: string; recorded: string[]; prefill?: Answer; years?: number[]; notes: string[]; used: string[] }): string {
  const { k, cur, recorded, used } = o;
  const loss = o.notes.some((n) => LOSS.test(n));
  const out: string[] = [];
  // only a single choice can overrule a guess; a multi-select guess ends "Anything else?", and adding to it isn't a correction
  const corrected = recorded.includes(cur) && BY_ID.get(cur)!.kind.type === "single" && o.prefill !== undefined && JSON.stringify(o.prefill) !== JSON.stringify(k.answers[cur]);
  if (recorded.includes(cur) && !HOUSEHOLD.includes(cur)) {
    const b = sayBack(cur, k);
    const shape = CORRECTED.find(([mark]) => !used.some((u) => u.includes(mark)));
    if (b) out.push(corrected ? (shape ?? CORRECTED[0])[1](b) : `${b}.`);
  }
  const household = householdSaid(recorded, k, o.years);
  if (household) out.push(`${household}.`);
  for (const id of recorded) {
    if (id === cur || HOUSEHOLD.includes(id)) continue;
    const b = sayBack(id, k);
    if (b) out.push(`And ${lower(b)}, noted.`);
  }
  for (const n of o.notes) {
    if (LOSS.test(n)) {
      const kin = n.match(KIN)?.[1];
      out.push(`${kin ? `I'm sorry about your ${kin.toLowerCase()}.` : "I'm sorry for your loss."} I'll keep that in mind as we go.`);
    } else {
      const tail = pick(REMEMBER, [...used, ...out]) || "Noted.";
      const name = named(n);
      out.push(name.length <= 48 ? `${name}. ${tail}` : tail);
    }
  }
  // a plain yes to a guess gets a word of thanks before it's said back
  if (!o.notes.length && recorded.length === 1 && recorded[0] === cur && o.prefill !== undefined && JSON.stringify(o.prefill) === JSON.stringify(k.answers[cur])) {
    const t = pick(THANKS, used, loss ? /lovely/i : undefined);
    if (t) out.unshift(t);
  }
  const text = out.join(" ");
  return text && !used.includes(text) ? text : pick(PLAIN, used) || "Thank you.";
}

// ---- The recap ----

// What it learned that matters most, in a few words each
function learned(k: Known, notes: string[]): string[] {
  const a = k.answers;
  const parts: string[] = [];
  if (typeof a.look === "string" && a.look !== "unsure") parts.push(lower(labelOf(BY_ID.get("look")!, k, a.look)));
  if (a.approach) parts.push(a.approach === "customized" ? "built around you and your things" : "a finished room");
  if (typeof a.people === "number") parts.push(a.people === 1 ? "just you" : `for the ${word(a.people)} of you`);
  // the nod is to something they love, never to a loss
  const nod = notes.find((n) => !LOSS.test(n));
  if (nod) parts.push(`with a nod to ${lower(named(nod))}`);
  return parts;
}

// The offer after the core questions, in time rather than a count of questions
export function keepGoingLine(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  return `That's everything I need to get started. About ${word(m)} more minute${m === 1 ? "" : "s"}, if you'd like to keep going. Or we can stop here.`;
}

// The closing turn: what it learned in a sentence, and what happens next
export function recap(k: Known, notes: string[]): string {
  const parts = learned(k, notes);
  const room = k.intake?.room ? `your ${k.intake.room.toLowerCase()}` : "your room";
  return `${parts.length ? `So: ${parts.join(", ")}. ` : ""}Next, I'll start on ideas for ${room}. Come back anytime to add more.`;
}

// The first line on a return visit, before the next question; the intro has already said welcome back
export function welcomeBack(k: Known, notes: string[]): string {
  const parts = learned(k, notes).slice(0, 3);
  return parts.length ? `Last time: ${parts.join(", ")}.` : "";
}

// ---- Test personas -----------------------------------------------------------

// Scripted user turns for the critic to run in type mode: same agent, no audio cost.
// Each answers whatever is asked, in order, and some say more than was asked.
export interface TestPersona {
  id: string;
  name: string;
  about: string;
  turns: string[];
  // what should be recorded by the end, whatever the room prefilled
  expect: Record<string, Answer>;
  // story details that should be noted
  notes: string[];
}

export const TEST_PERSONAS: TestPersona[] = [
  {
    id: "family",
    name: "Family refresh",
    about: "Answers in full sentences and gives the household in one breath, out of order.",
    turns: [
      "It's a refresh. We've lived here about three years.",
      "Built around us, for sure. It's me, my partner and our two kids, 4 and 7.",
      "No rush, honestly.",
      "Somewhere in the middle.",
      "Relaxing, watching TV, and the kids play in here.",
      "Warm mid-century, I think. My grandmother loved butterflies, by the way.",
      "That's enough for now.",
    ],
    expect: { start: "refresh", approach: "customized", people: 4, kids: "home", kid_ages: ["3to7"], timeline: "no_rush", budget: "mid", uses: ["relax", "tv", "play"], look: "midcentury" },
    notes: ["My grandmother loved butterflies"],
  },
  {
    id: "solo",
    name: "Solo, in a hurry",
    about: "Short answers, wants it done for them.",
    turns: [
      "Starting fresh, I just moved in.",
      "Honestly, just pull it together for me.",
      "As soon as possible, I'm living out of boxes.",
      "Keep it lean.",
      "Just me.",
      "Working, relaxing and the odd dinner.",
      "No kids.",
      "Modern and minimal.",
      "I'm done for now.",
    ],
    expect: { start: "fresh", approach: "standard", timeline: "asap", budget: "lean", people: 1, uses: ["relax", "eating", "working"], kids: "no", look: "minimal" },
    notes: [],
  },
  {
    id: "story",
    name: "Story-led couple",
    about: "Drifts into stories and mentions a pet before pets come up.",
    turns: [
      "Fresh start. We're moving into my late grandfather's flat.",
      "Built around the things we love, definitely.",
      "In the next few months.",
      "Happy to invest in a few good pieces.",
      "Two of us, and a very spoiled cat.",
      "Reading, and having friends over for dinner.",
      "No, not yet.",
      "Collected and eclectic, like my grandmother's house in Lisbon.",
      "Keep going.",
      "That's enough for now.",
    ],
    expect: { start: "fresh", approach: "customized", timeline: "1-3mo", budget: "invest", people: 2, pets: ["cat"], uses: ["reading", "hosting", "eating"], kids: "no", look: "eclectic" },
    notes: ["We're moving into my late grandfather's flat", "Like my grandmother's house in Lisbon"],
  },
];

// ---- The free interpreter (Phase 0 only) ---------------------------------------
//
// PHASE 0 STAND-IN. In Phase 1 the live agent (ElevenLabs + Claude, with
// AGENT_PROMPT and TOOLS above) hears the answer and calls record_answer and
// note_detail itself, and this keyword matcher goes away. It's deterministic and
// free: choice labels, ids, obvious synonyms and numbers, plus a few out-of-order
// facts (household, kids and ages, pets, timeline, budget, start, look), so the
// scripted demo can show one reply filling several questions without any AI.

export interface Heard {
  // in tree order; the screen checks each with recordAnswer before saving
  answers: { id: string; value: Answer }[];
  notes: string[];
  // yes/no to a prefill or an offer; stop to end now
  intent: "yes" | "no" | "stop" | null;
  // the kids' ages as said, for saying them back ("a four- and a seven-year-old")
  years?: number[];
}

const NUM_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen"];
const NUM = `\\d{1,2}|${NUM_WORDS.join("|")}`;
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUM_WORDS.indexOf(s));
const KID = "kids?|children|child|sons?|daughters?|boys|girls|little ones|toddlers?|baby|babies";

// Obvious ways people say each choice, beyond the label's own words
const SYN: Record<string, Record<string, RegExp>> = {
  start: {
    fresh: /\b(fresh|new (place|flat|apartment|house|home)|just moved|moving (in|into)|empty|from scratch)\b/,
    refresh: /\b(refresh|already live|been here|lived here|update|freshen|redo)\b/,
  },
  approach: {
    standard: /\b(pull(ed)? (it )?together|done for me|do it for me|finished room|take care of it|whatever you think)\b/,
    customized: /\b(built around|around (me|us)|(my|our) (things|stuff|pieces)|things (i|we) (love|have)|personal)\b/,
  },
  tradeoff: {
    speed: /\b(soon|quick\w*|fast|speed|hurry|asap)\b/, right: /\b(just right|right|perfect|no rush|take (my|our) time)\b/,
    budget: /\b(budget|money|cost|price|cheap)\b/, style: /\b(look|style|beautiful)\b/,
    function: /\b(function\w*|works?|practical|storage|comfort\w*)\b/, custom: /\b(personal|story|mine|meaning\w*)\b/,
  },
  timeline: {
    asap: /\b(asap|as soon as|right away|urgent|quickly|soon as)\b/,
    "1-3mo": /\b(months?|weeks|summer|spring|autumn|fall|winter|this year)\b/,
    no_rush: /\b(no rush|no hurry|whenever|take (our|my) time|eventually|slowly|no (particular )?date|no deadline)\b/,
  },
  budget: {
    lean: /\b(lean|tight|cheap|affordable|frugal|not much|small)\b/,
    mid: /\b(middle|mid|moderate|reasonable|medium)\b/,
    invest: /\b(invest|splurge|premium|generous|quality)\b/,
    unsure: /\b(not sure|no idea|don't know|unsure|depends)\b/,
  },
  uses: {
    relax: /\b(relax\w*|chill\w*|lounging|unwind\w*|rest|sofa|couch|collapse)\b/, tv: /\b(tv|television|movies?|films?|netflix|watch\w*|a show|shows|series)\b/,
    reading: /\b(read\w*|books?)\b/, hosting: /\b(host\w*|guests?|friends|people over|entertain\w*|part(y|ies))\b/,
    eating: /\b(eat\w*|dinners?|meals?|breakfast|lunch|dining)\b/, working: /\b(work\w*|office|desk|laptop|study\w*)\b/,
    // "a one-bed" is a flat, not sleeping in the living room
    // and "the dog sleeps on the couch" is the dog's: only her own sleeping counts
    sleeping: /\b((i|we|i'll|we'll|i'd|i often|i usually) (sleep|nap)\w*|sleep in here|sleeping in here|naps?|in bed|guest bed|sofa bed)\b/, play: /\b(play\w*|toys|playroom)\b/,
  },
  priorities: {
    storage: /\b(storage|store|clutter|stuff)\b/, seating: /\b(seat\w*|sit)\b/, light: /\b(light|dark|bright\w*)\b/,
    layout: /\b(layout|flow|arrange\w*)\b/, calm: /\b(calm\w*|peace\w*)\b/, finished: /\b(finished|complete|pulled together)\b/,
  },
  kids: {
    home: /\b(yes|yeah|yep|we do|i do|at home|(our|my|the|two|three) (kids|children))\b/,
    visit: /\b(visit\w*|grandkids|grandchildren|nieces?|nephews?|weekends)\b/,
    no: /\b(no|nope|none|not yet|just us|just me)\b/,
  },
  kid_ages: { under3: /\b(baby|babies|toddlers?|infant|newborn)\b/, "3to7": /\b(preschool\w*|little ones|kindergarten)\b/, "8to12": /\b(tweens?|primary)\b/, teen: /\b(teen\w*)\b/ },
  pets: { dog: /\b(dogs?|pupp(y|ies)|pup)\b/, cat: /\b(cats?|kittens?)\b/, other: /\b(rabbits?|birds?|fish|hamsters?|guinea pigs?|lizards?|bunn(y|ies)|tortoise|turtle)\b/, none: /\b(no pets|none|nope|no)\b/ },
  pets_on_furniture: { yes: /\b(yes|yeah|of course|always|allowed|theirs)\b/, no: /\b(no|never|not allowed|floor)\b/ },
  work_from_home: { daily: /\b(every day|most days|daily|full.?time|all the time)\b/, sometimes: /\b(sometimes|occasionally|now and then|a few days|once a week|part)\b/, no: /\b(never|no|don't work|not really)\b/ },
  video_calls: { yes: /\b(yes|yeah|yep|all the time|often|sometimes)\b/, no: /\b(no|never|nope|rarely)\b/ },
  hosting: { weekly: /\b(every week|weekly|all the time|often|a lot)\b/, sometimes: /\b(now and then|sometimes|occasionally|monthly|every month)\b/, rarely: /\b(rarely|never|hardly|not (much|often))\b/ },
  hosting_style: { table: /\b(table|dinner)\b/, sofa: /\b(sofa|couch|piled)\b/, both: /\b(both|mix)\b/ },
  unwind: { music: /\b(music|records|vinyl|piano|guitar)\b/, games: /\b(games?|puzzles?)\b/, plants: /\b(plants?|garden\w*)\b/, quiet: /\b(quiet|nothing|silence)\b/ },
  look: {
    midcentury: /\b(mid.?century|retro|sixties|teak)\b/, scandi: /\b(scandi\w*|nordic|danish)\b/, minimal: /\b(minimal\w*|modern|clean)\b/,
    eclectic: /\b(eclectic|collected|boho|maximal\w*)\b/, traditional: /\b(traditional|classic)\b/, organic: /\b(earthy|natural|organic|rustic)\b/,
    industrial: /\b(industrial|loft|brick)\b/, unsure: /\b(not sure|no idea|don't know|unsure)\b/,
  },
  color: { light: /\b(light|calm|airy|white|bright)\b/, warm: /\b(warm|earthy|earth)\b/, bold: /\b(bold|colou?rful|vibrant|lots of colou?r)\b/ },
  pattern: { love: /\b(love|lots|bring it)\b/, little: /\b(little|bit|some|touch)\b/, plain: /\b(plain|no pattern|solid|hate)\b/ },
  anchor: { none: /\b(nothing|none|no|not really)\b/ },
};

// Out of order: what a reply says about other questions, only from unmistakable phrasings
const FACTS: Record<string, Record<string, RegExp>> = {
  start: { fresh: /\b(just moved|moving (in|into)|new (place|flat|apartment|house|home)|starting fresh|fresh start|from scratch)\b/, refresh: /\b(a refresh|lived here|been here)\b/ },
  approach: { customized: /\b(built around (me|us|the things)|around (my|our) (things|stuff|pieces))\b/ },
  timeline: { asap: /\b(asap|as soon as possible|right away)\b/, "1-3mo": /\b(next|few|couple of|two|three) months\b/, no_rush: /\b(no rush|no hurry|take (our|my) time)\b/ },
  look: { midcentury: /\bmid.?century\b/, scandi: /\b(scandinavian|scandi|nordic)\b/, minimal: /\bminimalist\b/, eclectic: /\beclectic\b/, industrial: /\bindustrial\b/ },
};

// Words in a label worth matching on their own ("Warm, dark wood" → warm, dark, wood)
const STOP = new Set(["with", "that", "them", "more", "feel", "just", "your", "this", "have", "most", "very", "into", "take", "keep", "yes", "the", "and", "for", "but", "not", "it's", "a", "an", "of", "it", "my", "me", "on", "in", "to", "or", "so", "go", "bit", "sure"]);
const words = (label: string) => label.toLowerCase().replace(/[^a-zé' ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Did her words name this choice? A synonym or a label word ("on the sofa with a show" names relax and tv,
// never sleeping). Used to ink only the choices she named in a multi answer the designer recorded.
export function choiceSaid(qid: string, choiceId: string, text: string): boolean {
  const q = BY_ID.get(qid);
  if (!q || (q.kind.type !== "multi" && q.kind.type !== "single")) return true;
  const t = ` ${text.toLowerCase().replace(/[’‘]/g, "'")} `;
  if (SYN[qid]?.[choiceId]?.test(t)) return true;
  const label = q.kind.choices.find((c) => c.id === choiceId)?.label ?? choiceId;
  return words(label).some((w) => new RegExp(`\\b${esc(w.slice(0, 5))}`).test(t));
}

// Each choice's score against the reply: a synonym hit counts double, each label word once
function scores(q: Question, k: Known, t: string): { id: string; n: number }[] {
  return choicesOf(q, k).map((c) => {
    const syn = SYN[q.id]?.[c.id]?.test(t) ? 2 : 0;
    const own = new RegExp(`\\b${esc(c.id.toLowerCase())}\\b`).test(t) ? 1 : 0;
    return { id: c.id, n: syn + own + words(c.label).filter((w) => new RegExp(`\\b${esc(w)}`).test(t)).length };
  });
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];

function matchSingle(q: Question, k: Known, t: string): string | null {
  const s = scores(q, k, t).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  if (s.length && (s.length === 1 || s[0].n > s[1].n)) return s[0].id;
  // "the second one"
  const o = ORDINALS.findIndex((w) => new RegExp(`\\b${w}\\b`).test(t));
  const choices = choicesOf(q, k);
  return o >= 0 && o < choices.length && !s.length ? choices[o].id : null;
}

function matchMulti(q: Question, k: Known, t: string): string[] {
  const choices = choicesOf(q, k);
  const hit = scores(q, k, t).filter((x) => x.n > 0).map((x) => x.id);
  // "No, a dog": an exclusive choice only stands alone
  const plain = hit.filter((id) => !choices.find((c) => c.id === id)?.exclusive);
  return plain.length ? plain : hit.slice(0, 1);
}

// How many people, from who they name: "me, my partner and our two kids" → 4
function household(t: string): number | null {
  const m = t.match(new RegExp(`\\b(${NUM}) (of us|people|adults)\\b`));
  if (m) return toNum(m[1]);
  if (/\b((just|only) me|on my own|by myself|live alone)\b/.test(t)) return 1;
  const partner = /\b(partner|husband|wife|boyfriend|girlfriend|spouse|fianc[eé]e?)\b/.test(t) ? 1 : 0;
  const mates = (() => {
    const r = t.match(new RegExp(`\\b(${NUM}) (room|flat|house)mates\\b`));
    return r ? toNum(r[1]) : /\b(a )?(room|flat|house)mate\b/.test(t) ? 1 : 0;
  })();
  const kids = kidCount(t);
  // "we" and "our" don't say how many adults, so only count when they name who
  if (!partner && !mates && !(kids && /\b(me|i|myself)\b/.test(t))) return null;
  return 1 + partner + mates + kids;
}

function kidCount(t: string): number {
  const m = t.match(new RegExp(`\\b(${NUM}) (${KID})\\b`));
  if (m) return toNum(m[1]);
  return [...t.matchAll(new RegExp(`\\b(a|one|our|my) (son|daughter|baby|toddler|kid|child)\\b`, "g"))].length;
}

function kidsFact(t: string): "home" | "visit" | "no" | null {
  if (new RegExp(`\\bno (${KID})\\b|\\bdon't have (any )?(${KID})\\b`).test(t)) return "no";
  if (/\b(grandkids|grandchildren|nieces?|nephews?)\b/.test(t) || new RegExp(`\\b(${KID}) (visit|come over|stay)`).test(t)) return "visit";
  if (new RegExp(`\\b(our|my|the|a|${NUM}) (${KID})\\b`).test(t)) return "home";
  return null;
}

const ageBucket = (n: number) => (n < 3 ? "under3" : n <= 7 ? "3to7" : n <= 12 ? "8to12" : n <= 19 ? "teen" : null);

// Kids' ages: "4 and 7", "a 4 year old", "ages 4 and 7"; with a kid word, only the numbers after it
function kidAges(t: string, anyNumber: boolean, years: number[] = []): string[] {
  const out = new Set<string>();
  for (const [, w] of t.matchAll(/\b(baby|babies|toddlers?|infant|teen\w*)\b/g)) out.add(/teen/.test(w) ? "teen" : "under3");
  const kidAt = t.search(new RegExp(`\\b(${KID})\\b`));
  for (const m of t.matchAll(new RegExp(`\\b(${NUM})\\b(?! (${KID}|of us|people|adults|years? (here|ago)|months?|weeks?))`, "g"))) {
    const n = toNum(m[1]);
    const aged = new RegExp(`^\\s*[- ]?(years?|yrs?)[- ]?old`).test(t.slice(m.index! + m[0].length));
    if (!anyNumber && !aged && (kidAt < 0 || m.index! < kidAt)) continue;
    const b = ageBucket(n);
    if (!b) continue;
    out.add(b);
    years.push(n);
  }
  return [...out];
}

// Personal-story cues: a person, a place from their past, a memory, an object with a story
const STORY = /\b(grand(mother|father|ma|pa|mum|mom|dad|parents)|nana|nan|granny|mum|mom|mother|dad|father|aunt|uncle|late|passed|childhood|grew up|growing up|reminds? me|always loved|loved|heirloom|inherited|wedding|honeymoon)\b/;
// Questions whose whole answer is the story; nothing is split out of these as a note
const STORY_QUESTIONS = new Set(["routine", "avoid", "inspiration", "places", "places_feel", "meaningful_detail"]);

// PHASE 0 STAND-IN for the live agent (see above). focus is the question on screen,
// with its prefill if there's one waiting to be confirmed.
export function interpret(text: string, k: Known, focus?: { id: string; prefill?: Answer }): Heard {
  const t = ` ${text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'é\- ]+/g, " ").replace(/\s+/g, " ")} `;
  const q = focus ? BY_ID.get(focus.id) : undefined;
  const found = new Map<string, Answer>();
  const years: number[] = [];

  const intent: Heard["intent"] = /\b(that's enough|enough for now|i'm done|i am done|done for now|stop here|let's stop|can we stop|that's all|that's it for now)\b/.test(t)
    ? "stop"
    : /^ (yes|yeah|yep|yup|correct|right|that's right|exactly|sure|definitely|absolutely|sounds right|spot on|it is|mhm|uh huh|keep going|go on|carry on|ok|okay|why not|go deeper|add more)\b/.test(t)
      ? "yes"
      : /^ (no|nope|not really|not quite|nah|actually no)\b/.test(t)
        ? "no"
        : null;

  // the question on screen: broad matching against its own choices
  if (q && intent !== "stop") {
    const kind = q.kind;
    if (kind.type === "single") {
      const id = matchSingle(q, k, t);
      if (id) found.set(q.id, id);
    } else if (kind.type === "multi") {
      const ids = q.id === "kid_ages" ? [...new Set([...kidAges(t, true, years), ...matchMulti(q, k, t)])] : matchMulti(q, k, t);
      if (ids.length) found.set(q.id, ids);
    } else if (kind.type === "number") {
      const first = t.match(new RegExp(`\\b(${NUM})\\b`));
      const n = household(t) ?? (first ? toNum(first[1]) : null);
      if (n !== null && n >= kind.min && n <= kind.max) found.set(q.id, n);
    } else {
      found.set(q.id, /^ (nothing|no|nope|not really|can't think|nothing comes to mind|pass) ?$/.test(t) ? "" : text.trim());
    }
    // "yes" to a prefill is the prefill, unless they named a choice too
    if (!found.has(q.id) && intent === "yes" && focus?.prefill !== undefined) found.set(q.id, focus.prefill);
  }

  // out of order: facts for other questions they haven't answered
  const open = (id: string) => id !== focus?.id && k.answers[id] === undefined;
  for (const [id, by] of Object.entries(FACTS)) {
    if (!open(id)) continue;
    const hit = Object.entries(by).filter(([, re]) => re.test(t));
    if (hit.length === 1) found.set(id, hit[0][0]);
  }
  if (open("budget") && /\b(budget|spend|money)\b/.test(t)) {
    const id = matchSingle(BY_ID.get("budget")!, k, t);
    if (id) found.set("budget", id);
  }
  const people = household(t);
  if (open("people") && people !== null && people <= 12) found.set("people", people);
  const kids = kidsFact(t) ?? (found.get("people") !== undefined && kidCount(t) ? "home" : null);
  if (open("kids") && kids) found.set("kids", kids);
  const withKids = kids === "home" || kids === "visit" || k.answers.kids === "home" || k.answers.kids === "visit";
  if (open("kid_ages") && withKids) {
    const ages = kidAges(t, false, years);
    if (ages.length) found.set("kid_ages", ages);
  }
  if (open("pets")) {
    const pets = /\bno pets\b/.test(t) ? ["none"] : (["dog", "cat"] as const).filter((id) => SYN.pets[id].test(t));
    if (pets.length) found.set("pets", pets);
  }

  // story details, split out of the reply as said, unless the question asked for the story itself
  const notes = q && STORY_QUESTIONS.has(q.id)
    ? []
    : text.split(/[.!?;]+|,\s*(?=like |because |by the way)|\bby the way\b/i).map((s) => s.trim().replace(/^(and|but|so)\s+/i, "").replace(/[,\s]+$/, "")).filter((s) => s && STORY.test(s.toLowerCase()));

  const order = QUESTIONS.map((x) => x.id);
  return {
    answers: [...found].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([id, value]) => ({ id, value })),
    notes,
    intent,
    ...(years.length ? { years: [...new Set(years)] } : {}),
  };
}
