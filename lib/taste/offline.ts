import { QUESTIONS, walk, type Answer, type Known } from "./questions";
import { acknowledge, asked, interpret, noteDetail, recordAll, spokenLine } from "./agent";
import { KEEP_GOING, missing, negated, newPace, target, type Facts, type Length, type Pace, type Protect, type SectionKey } from "./pace";
import { related, type State, type Turn } from "./session";
import { openQuestions, ruleDecisions, sizeLine, spaceLines } from "./craft";
import { blend, blendName, type SetId } from "./visual";
import { shopsNamed, sourcingLine } from "./shopping";

// The free fallback when the live designer can't be reached (no key, an error, or the
// turn cap): the Phase 0 keyword interpreter from agent.ts, walking a fixed plan through
// the three sections. Each section's minimum comes first (lib/taste/pace.ts); depth steps
// follow only while the chosen length has room, with the stopping point offered once the
// minimum is in. Closes with a template concept (dossier.md §3.4). Same Turn shape as the
// live route, so the page doesn't know the difference, except that it's plainer.

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

// min: names the item in pace.ts's missing() this step covers
type Step = ({ q: string } | { set: SetId } | { about: true }) & { min?: string };
const PLAN: Record<SectionKey, Step[]> = {
  // start and approach (the persona halves) are read, never asked; function is inferred from "about"
  you: [
    { about: true, min: "a little about them" }, { q: "tradeoff", min: "their priorities" },
    { q: "people" }, { q: "routine" }, { q: "pets" }, { q: "pets_on_furniture" }, { q: "kid_ages" },
  ],
  style: [{ set: "rooms", min: "the rooms set" }, { set: "palettes", min: "the palettes set" }, { set: "materials" }, { set: "patterns" }, { q: "avoid" }],
  // how personal first, then the practical close
  extras: [{ q: "meaningful_detail" }, { q: "places" }, { q: "places_feel" }, { q: "anchor" }, { q: "shop", min: "how they like to shop" }, { q: "brands" }, { q: "budget", min: "a budget range" }, { q: "timeline", min: "a date that matters" }],
};
const ORDER: SectionKey[] = ["you", "style", "extras"];
const ABOUT = "Tell me a little about yourself, and how you see yourself using the space.";
const SECTION_LINE: Record<string, string> = {
  style: "That's a good picture of you. Now, the look of the space.",
  extras: "That's a clear read on your style. Last part, the extras.",
};
const SET_LINE: Record<SetId, string> = {
  rooms: "Have a look at these rooms. Tap any you could see yourself living in.",
  palettes: "Now color. Which of these palettes feels most like you?",
  materials: "Which materials would you love to have around?",
  patterns: "And pattern. Which of these would you happily live with?",
};
const STOP_LINE = "That's enough for me to go on. Keep going, or move on?";

const factsOf = (s: State, answers: Record<string, Answer>): Facts => ({ answers, shown: s.taste.shown, practical: s.convo.dossier.filter((d) => d.zone === "practical" && !d.crossed).map((d) => d.text) });

// Is this step still open? Minimum steps while their item is missing; depth steps while the tree asks them
function open(k: Known, s: State, pace: Pace, sec: SectionKey, step: Step): boolean {
  if (step.min) return missing(pace, sec, factsOf(s, k.answers)).some((m) => m.startsWith(step.min!));
  if ("set" in step) return !s.taste.shown.includes(step.set);
  if ("about" in step) return false;
  const st = walk(k, "all").find((x) => x.id === step.q);
  return !!st && st.status !== "hidden" && st.status !== "skip" && k.answers[step.q] === undefined;
}

// The practical questions asked plainly, as a designer would: never a bracket offered as a guess
// ("For budget, would somewhere in the middle feel right?"), and a date that matters rather than "how fast"
const PLAIN: Record<string, string> = {
  budget: "What feels right to spend on this room? A range is perfect.",
  timeline: "Is there a date it needs to be ready for?",
};
function lineFor(id: string, k: Known): string {
  if (PLAIN[id]) return PLAIN[id];
  return spokenLine(BY_ID.get(id)!, walk(k, "all").find((x) => x.id === id), k);
}

// Money and dates said anywhere, in her words, for the practical strip: "$1,500 total", "before Thanksgiving"
const MONEY = /(?:\b(?:under|about|around|up to|max(?:imum)?|less than|roughly|maybe)\s+)?(?:[$£€]\s?\d[\d,.]*k?|\b\d[\d,.]*\s?(?:k|grand|dollars|pounds|euros)\b|\b(?:a|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)(?: and a half)?\s+(?:thousand|grand)\b)(?:\s+(?:total|all in|tops|hard cap|max))?/i;
const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
const DATE_SAID = new RegExp(`\\b(?:before|by|for|until|in time for)\\s+(?:thanksgiving|christmas|the holidays|easter|(?:${MONTHS})|(?:the )?(?:summer|spring|autumn|fall|winter)|next (?:week|month|year)|school|(?:her|his|my|our|their) \\w+(?:'s)? (?:visit|wedding|birthday|arrival)|the \\w+ (?:visit|party))\\b|\\blease (?:ends|is up)(?: in)? (?:${MONTHS})\\b`, "i");
function practicalSaid(text: string): Turn["dossier"] {
  const out: Turn["dossier"] = [];
  const money = text.match(MONEY)?.[0];
  if (money) out.push({ zone: "practical", text: `budget: ${money.trim()}`, because: null, icon: "none", sure: true, replaces: null });
  // "before my sister visits at Thanksgiving": from the date word back to its "before"
  const holiday = /\b(christmas|thanksgiving|the holidays|easter|new year)\b/i;
  // or the clause the holiday sits in: "my mom visits at Christmas"
  const clause = text.split(/[,.;!?]|\bbut\b|\band\b(?= (?:i|we|my|our)\b)/i).find((c) => holiday.test(c))?.trim().replace(/^(and|so|but)\s+/i, "");
  const date = text.match(new RegExp(`\\b(?:before|by|until|in time for)\\b[^.,;!?]{0,40}?\\b(?:thanksgiving|christmas|the holidays|easter|${MONTHS})\\b`, "i"))?.[0] ?? text.match(DATE_SAID)?.[0] ?? (clause && clause.split(/\s+/).length <= 9 ? clause : undefined);
  // written to her: "before my sister visits" → "before your sister visits"
  if (date) out.push({ zone: "practical", text: date.trim().replace(/\bmy\b/gi, "your").replace(/\bour\b/gi, "your"), because: null, icon: "sun", sure: true, replaces: null });
  return out;
}

// A question already asked once and left unanswered isn't asked again; the conversation moves on
function askedBefore(k: Known, s: State, step: Step): boolean {
  if (!("q" in step)) return false;
  const q = BY_ID.get(step.q);
  if (!q) return false;
  const line = lineFor(q.id, k);
  return s.convo.transcript.some((l) => l.who === "agent" && l.text.includes(line));
}

// The next step in plan order (each plan puts its minimum where a designer would ask it: first in
// "you" and "style", as the practical close of "extras"), taking depth only while the length has room
// beyond what the minimum still needs; null means on to the read-back. Quick is the minimum only.
// offer: the minimum is in and there's depth to come, so the stopping point is due first.
function nextStep(k: Known, s: State, pace: Pace, from: SectionKey): { section: SectionKey; step: Step; offer: boolean } | null {
  for (const sec of ORDER.slice(Math.max(0, ORDER.indexOf(from)))) {
    const left = missing(pace, sec, factsOf(s, k.answers)).length;
    const room = pace.length === "quick" ? 0 : target(pace, sec) - (pace.replies[sec] ?? 0) - left;
    const steps = PLAN[sec].filter((st) => open(k, s, pace, sec, st) && (st.min || room > 0) && !askedBefore(k, s, st));
    const step = steps[0];
    if (!step) continue;
    const offer = !step.min && !left && pace.length !== "quick" && !pace.offered.includes(sec) && sec === from;
    return { section: sec, step, offer };
  }
  return null;
}

const STOP = /\b(that's enough|enough for now|i'm done|done for now|stop here|let's stop|that's all)\b/i;

// Priorities as said: what they protect, any of them ("quick, and it has to work for the dog" → speed, function)
const PROTECT_SAID: [Protect, RegExp][] = [
  ["speed", /\b(soon|quick\w*|fast|hurry|asap|speed)\b/i], ["just_right", /\b(just right|get it right|perfect|no rush|take (my|our) time|love this)\b/i],
  ["style", /\b(look|style|beautiful|pretty)\b/i], ["budget", /\b(budget|money|cost|price|cheap|afford\w*)\b/i],
  ["function", /\b(function\w*|works?|practical|storage|comfort\w*)\b/i], ["personal", /\b(personal|story|meaning\w*|mine)\b/i],
];

// One offline turn. text is what they said (or the [tap] summary); cur is the question the last line asked.
export function offlineTurn(base: Omit<Known, "answers">, s: State, text: string | null, cur: string | null, event = false): Turn & { cur: string | null } {
  const k: Known = { ...base, answers: s.answers };
  const pace = s.convo.pace ?? newPace();
  let ack = "";
  const empty: Omit<Turn, "say" | "section"> = {
    answers: [], notes: [], quote: null, moods: [], styles: [], buckets: [], dossier: [], cross_out: [], not_styles: [], show: "none", suggestions: [], concept: null,
    priorities: null, resize: "none", stop_offered: false,
  };
  let found: { id: string; value: Answer }[] = [];
  let notes: string[] = [];
  let stop = false;
  let priorities: Turn["priorities"] = null;
  let resize: Turn["resize"] = "none";
  let drawn: Turn["dossier"] = [];
  let keptSaid = "";

  if (text && !event && !KEEP_GOING.test(text)) {
    if (STOP.test(text)) stop = true;
    // "about" is open: whatever it says about the room's uses, who's there and pets is read from it
    const focus = cur === "about" ? "uses" : cur;
    const step = focus ? walk(k, "all").find((x) => x.id === focus) : undefined;
    const st = step && asked(step, k);
    const prefill = cur !== "about" && st?.status === "prefill" ? st.value : undefined;
    const heard = interpret(text, k, focus && BY_ID.has(focus) ? { id: focus, prefill } : undefined);
    const all = heard.notes.reduce(noteDetail, s.notes);
    notes = all.slice(s.notes.length);
    // shops she names while saying how she shops answer "any shops you love?" too
    const shops = cur === "shop" && k.answers.brands === undefined ? shopsNamed(text) : [];
    if (shops.length) heard.answers.push({ id: "brands", value: shops.join(", ") });
    const { answers, recorded } = recordAll(k, heard.answers);
    found = recorded.map((id) => ({ id, value: answers[id] }));
    // the piece she names beats a scan item that only shares a word with it: "my late dad's brown corduroy
    // armchair" is not the bouclé armchair the scan found, so it goes on the page in her words
    const named = text.match(/\b(?:my|our)\s+((?:[\w'-]+\s){0,4}?(?:armchair|chair|sofa|couch|table|rug|lamp|desk|bookcase|chest|cabinet|dresser|mirror|bench|stool|clock|piano|sideboard|trunk|quilt))\b/i)?.[1];
    if (named) {
      const scanId = answers.anchor;
      const item = typeof scanId === "string" ? base.scan?.items.find((i) => i.id === scanId) : undefined;
      const words = (t: string) => t.toLowerCase().split(/[^a-zé']+/).filter((w) => w.length > 3);
      const shared = item ? words(item.name).filter((w) => words(named).includes(w)).length : 0;
      if (!item || shared < 2) {
        found = found.filter((f) => f.id !== "anchor");
        if (cur === "anchor" || /\b(stays|keep|keeping|staying)\b/i.test(text)) keptSaid = `your ${named.replace(/^late\s+/i, "")}${cur === "anchor" ? " — the anchor" : ""}`;
      }
    }
    if (cur === "tradeoff") {
      // "I'd rather it look good than be done fast" protects the look, not speed
      const protect = PROTECT_SAID.filter(([, re]) => [...text.matchAll(new RegExp(re.source, "gi"))].some((m) => !negated(text, m.index ?? 0))).map(([p]) => p);
      priorities = { words: text.trim().slice(0, 90), protect };
      // their priorities size the interview when they didn't pick a length themselves
      // never shorter when the look or getting it right matters to them
      const careful = protect.includes("style") || protect.includes("just_right");
      const to: Length | null = protect.includes("speed") && !careful ? "quick" : protect.includes("just_right") ? "deep" : null;
      if (to && !pace.chosen && to !== pace.length) resize = to;
    }
    // no echo openers ("And a dog, noted.", "Thank you, that helps."): only care for a loss, and the resize
    const used = s.convo.transcript.filter((l) => l.who === "agent").map((l) => l.text);
    const care = notes.length ? acknowledge({ k: { ...k, answers }, cur: cur ?? "", recorded, prefill, years: heard.years, notes, used }) : "";
    ack = /\bsorry\b/i.test(care) ? care.match(/[^.]*\bsorry\b[^.]*\./i)?.[0] ?? "" : "";
    if (resize === "quick") ack = "Then I'll keep this short.";
    else if (resize === "deep") ack = "Then let's take our time.";
    drawn = [...practicalSaid(text), ...(keptSaid ? [{ zone: "keep" as const, text: keptSaid, because: null, icon: "star" as const, sure: true, replaces: null }] : [])];
  }

  // what she said this turn counts at once: a budget or a date in her words covers that minimum
  const after: State = {
    ...s,
    answers: { ...s.answers, ...Object.fromEntries(found.map((f) => [f.id, f.value])) },
    convo: { ...s.convo, dossier: [...s.convo.dossier, ...drawn.map((d, i) => ({ ...d, id: `said-${i}`, at: s.convo.turns + 1 }))] },
  };
  const k2: Known = { ...base, answers: after.answers };
  // the pace after this turn: the priorities and the reply just given count
  const sec = (ORDER.includes(s.convo.section as SectionKey) ? s.convo.section : "extras") as SectionKey;
  const paceNow: Pace = { ...pace, length: resize !== "none" ? resize : pace.length, priorities: priorities ?? pace.priorities };
  const answers = found.map((f) => ({ ...f, quote: text ?? "" }));
  const rest = { priorities, resize, dossier: drawn };

  // in the read-back (or sent there by "finished with this section"), the template concept
  const atReadback = s.convo.section === "readback" || s.convo.section === "done";
  const next = stop || atReadback ? null : nextStep(k2, after, paceNow, sec);

  // a correction to a drawn brief: edits, as the live designer makes them, never a new brief
  if (atReadback && s.convo.concept?.program !== undefined && text && !event) {
    const edits = correctionEdits(s.convo.concept, text);
    const what = edits.filter((e) => e.op !== "add").length;
    return { ...empty, ...rest, answers, notes, say: what || edits.length ? "Redrawn: I've crossed out what changed and added what you said." : "Noted.", section: "readback", concept: null, edits, cur: null };
  }
  if (!next) {
    const concept = template(k2, after);
    const line = atReadback && s.convo.concept ? "Thank you. I've noted that on the page." : "Here's what I heard. Tell me anything I got wrong.";
    return { ...empty, ...rest, answers, notes, say: [atReadback && s.convo.concept ? "" : ack, line].filter(Boolean).join(" "), section: "readback", concept, cur: null };
  }
  const roomName = base.intake?.room?.trim().toLowerCase();
  const opening = !s.convo.transcript.length ? `Hi, I'm glad you're here. ${base.scan ? `I've had a look at your ${roomName || "room"}. ` : ""}` : "";
  const join = (...xs: string[]) => xs.map((x) => x.trim()).filter(Boolean).join(" ");
  if (next.offer) return { ...empty, ...rest, answers, notes, say: join(ack, STOP_LINE), section: next.section, stop_offered: true, suggestions: ["Keep going", "Move on"], cur: null };
  const turnLine = next.section !== s.convo.section && SECTION_LINE[next.section] ? SECTION_LINE[next.section] : "";
  if ("set" in next.step)
    return { ...empty, ...rest, answers, notes, say: join(opening, ack, turnLine, SET_LINE[next.step.set]), section: next.section, show: next.step.set, cur: null };
  if ("about" in next.step) return { ...empty, ...rest, answers, notes, say: join(opening, ack, turnLine, ABOUT), section: next.section, cur: "about" };
  const q = BY_ID.get(next.step.q)!;
  const line = lineFor(q.id, k2);
  const kind = q.kind;
  // the practical questions are open: her figure, her date
  const suggestions = q.id === "tradeoff" ? ["Done quickly", "Getting it just right", "The look", "The budget", "How it works", "Making it personal"] : q.id === "shop" ? ["Secondhand and vintage", "Mid-range shops", "Designer pieces"] : q.id === "budget" ? [] : q.id === "timeline" ? ["No particular date"] : kind.type === "single" ? kind.choices.slice(0, 3).map((c) => c.label) : [];
  return { ...empty, ...rest, answers, notes, say: join(opening, ack, turnLine, line), section: next.section, suggestions, cur: q.id };
}

// The brief, from what's recorded: one plain sentence, then program, constraints, direction, the
// rule-based decisions (lib/taste/craft.ts) with the fact behind each, nevers and open questions.
// The palette (60-30-10) and materials with finishes are added from the picks on the page (ReadBack).
const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"];
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

// The free interpreter's correction: lines that her words contradict go (anything that says a piece she
// names stays, any blanket "existing pieces stay", any open question she just answered), and her words are
// added as a constraint, in "you". Everything else is untouched.
const GOES = /\b(has to go|goes|going|isn'?t staying|not staying|replac\w*|get rid of|getting rid|is out|out of here)\b/i;
const BLANKET_STAY = /\b(existing|current|all|everything|the rest)\b[^.;]*\b(stays?|staying|kept|keep)\b|\bspend only on (the )?gaps|\bfill(ing)? (in )?the gaps\b/i;
export function correctionEdits(c: NonNullable<State["convo"]["concept"]>, said: string): NonNullable<Turn["edits"]> {
  const ops: NonNullable<Turn["edits"]> = [];
  const pieces = [...said.toLowerCase().matchAll(/\b(sofa|couch|armchair|chair|table|rug|lamp|bookcase|bookshelf|shelf|desk|console|sideboard|cabinet|mirror|bench|tv|ottoman|bed|curtains)\b/g)].map((m) => (m[1] === "couch" ? "sofa" : m[1]));
  const goes = GOES.test(said);
  const scan = (key: string, prefix: string, xs: string[]) =>
    xs.forEach((x, i) => {
      const t = x.toLowerCase();
      const names = pieces.some((p) => t.includes(p));
      const staysAnswered = /\b(stay|staying|keep|keeping|go|going)\b/.test(t) && /\b(stays?|goes|go|keeping|staying)\b/i.test(said);
      if (key === "open_questions" ? names || staysAnswered || related(x, said) : (goes && names && /\b(stays?|staying|kept|keep(ing)?|recover|reupholster|cover)\b/.test(t)) || (goes && BLANKET_STAY.test(x))) ops.push({ op: key === "open_questions" ? "answer_open" : "remove", id: `${prefix}-${i}`, section: null, text: null });
    });
  scan("constraints", "con", c.constraints ?? []);
  scan("direction", "dir", c.direction ?? []);
  scan("program", "prog", c.program ?? []);
  scan("decisions", "dec", (c.decisions ?? []).map((d) => `${d.decision} ${d.because}`));
  scan("open_questions", "open", c.open_questions ?? []);
  const yours = said.trim().replace(/^(one thing|actually|oh|and|but|also)[:,]?\s*/i, "").replace(/\bmy\b/gi, "your").replace(/\bI'm\b/g, "you're").replace(/\bwe're\b/gi, "you're").replace(/\bI\b/g, "you").replace(/\bwe\b/gi, "you").replace(/[.!]+$/, "");
  if (yours) ops.push({ op: "add", id: null, section: "constraints", text: yours.charAt(0).toUpperCase() + yours.slice(1) });
  return ops;
}

export function template(k: Known, s: State): NonNullable<Turn["concept"]> {
  const a = k.answers;
  const room = k.intake?.room?.trim().toLowerCase() || "room";
  const said = s.convo.transcript.filter((l) => l.who === "you" && !l.event).map((l) => l.text).join(" \n ");
  const n = typeof a.people === "number" ? a.people : null;
  const petKind = Array.isArray(a.pets) && !a.pets.includes("none") ? (a.pets.includes("cat") ? "cat" : a.pets.includes("dog") ? "dog" : "pet") : /\b(cat|kitten)\b/i.test(said) ? "cat" : /\b(dog|puppy|greyhound|retriever|terrier|spaniel|lab|labrador|mutt|collie|poodle|doodle)\b/i.test(said) ? "dog" : "";
  // "Juniper the cat", "a dog called Biscuit"
  const petName = said.match(/\b([A-Z][a-z]+),? (?:the|my|our) (?:cat|dog)\b/)?.[1] ?? said.match(/\b(?:cat|dog|greyhound|retriever) (?:called|named) ([A-Z][a-z]+)/)?.[1] ?? said.match(/\b([A-Z][a-z]+),? (?:our|my) (?:\w+ )?(?:lab|dog|cat|mix|puppy)\b/)?.[1];
  const pet = petKind ? `${petName ? `${petName} the ` : "a "}${petKind}` : "";
  const label = (id: string) => {
    const q = BY_ID.get(id);
    const v = a[id];
    return q && q.kind.type === "single" && typeof v === "string" ? q.kind.choices.find((c) => c.id === v)?.label ?? v : "";
  };
  const has = (v: string) => Array.isArray(a.uses) && a.uses.includes(v);

  // what the room has to do, as verbs, from her answers and her own words
  const wfh = /\b(work(ing)? from home|wfh|remote|my desk|laptop|work (at|from) the (table|desk|window))\b/i.test(said) || a.work_from_home === "daily" || a.work_from_home === "sometimes" || has("working");
  const days = said.match(/\b(\w+|\d) days? a week\b/i)?.[0];
  const floor = /\b(on the floor|floor cushions|board games)\b/i.test(said);
  const friends = said.match(/\b(\w+)(?: or (\w+))? friends\b/i);
  const homework = /\bhomework\b/i.test(said);
  const verbs = [
    wfh ? `work from home${days ? ` ${days}` : ""}` : "",
    has("reading") || /\bread(ing)?\b/i.test(said) ? "read" : "",
    has("tv") || /\b(tv|a show|shows|films?|movies?)\b/i.test(said) ? "watch TV" : "",
    has("hosting") || friends || floor ? `have friends over${floor ? " on the floor" : ""}` : "",
    has("eating") ? "eat" : "",
    homework ? "do homework" : "",
  ].filter(Boolean);
  const you = n === null || n === 1 ? "you" : `the ${WORDS[n] ?? n} of you`;
  const kids = a.kids === "home" ? "kids at home" : a.kids === "visit" ? "kids who visit" : "";

  const program = [
    [n === null ? "" : n === 1 ? "One adult" : `${WORDS[n] ?? n} people`, pet, kids].filter(Boolean).join(" + "),
    wfh ? `Works from home${days ? `, ${days}` : ""}` : "",
    friends || floor ? `Friends over${friends ? `: ${friends[0].replace(/\s*friends$/i, "")}` : ""}${floor ? ", on the floor" : ""}` : "",
    homework ? "Homework after school" : "",
    (() => {
      const also = verbs.filter((v) => /^(read|watch TV|eat)$/.test(v)).map((v) => ({ read: "reading", "watch TV": "TV", eat: "meals" })[v] ?? v);
      return also.length ? `Also: ${list(also)}` : "";
    })(),
  ].filter(Boolean);

  // practical lines in her words come first; a bracket answer only where she gave no figure or date
  const practical = s.convo.dossier.filter((d) => d.zone === "practical" && !d.crossed).map((d) => d.text);
  const money = practical.some((t) => /[$£€]|\d|thousand|grand/i.test(t));
  const date = practical.some((t) => !/^budget/i.test(t));
  const bins = k.sort?.bins ?? {};
  const keeping = (k.scan?.items ?? []).filter((i) => bins[i.id] === "keep" || bins[i.id] === "move").map((i) => i.name.toLowerCase());
  const constraints = [
    k.space ? `Room: ${sizeLine(k.space)}` : "",
    keeping.length ? `Keeping: ${list(keeping.slice(0, 4))}` : "",
    ...practical.map((t) => (/^budget:/i.test(t) ? `Budget: ${t.replace(/^budget:\s*/i, "").replace(/^(\w)/, (m) => m.toLowerCase())}` : /^(before|by|until|in time)\b/i.test(t) ? `Ready ${t}` : `Date: ${t}`)),
    !money && a.budget && a.budget !== "unsure" ? `Budget: ${label("budget").toLowerCase()}` : "",
    !date && a.timeline ? `Timing: ${label("timeline").toLowerCase()}` : "",
    sourcingLine(a),
    /\b(rent(ing|al)?|lease|landlord)\b/i.test(said) ? "Renting: nothing that needs the landlord's sign-off" : "",
    a.pets_on_furniture === "yes" && pet ? `${pet.charAt(0).toUpperCase()}${pet.slice(1)} is allowed on the sofa` : "",
  ].filter(Boolean);
  const b = blend(s.taste);
  // the captured room's size and light, as clearances and window treatment
  const direction = [...(b.length ? [`Style: ${blendName(b)}`] : []), ...(k.space ? spaceLines(k.space, said) : [])];
  // nevers come from the page (her words and her taps, one line per rejected room); the tree's avoid
  // answer lists whole photo captions, so it isn't copied here
  const never: string[] = [];
  // the personal detail she gave, in her words, becomes one decision
  // "keep it simple" to the nod question is a no, not a detail
  const declined = (v: unknown) => typeof v !== "string" || !v.trim() || /^\W*(keep it simple|simple|no|nope|nothing|none|not really|pass)\b/i.test(v);
  const detail = !declined(a.meaningful_detail) ? (a.meaningful_detail as string).trim() : s.notes[0] ?? (typeof a.places === "string" && a.places.trim() ? a.places.trim() : undefined);
  const nod = detail?.replace(/^(my|our) /i, "your ").replace(/[.]$/, "");
  // one sentence: who, what it has to do, and who else is on the sofa
  const statement = `A ${room} where ${you} ${verbs.length ? list(verbs.slice(0, 3)) : "can settle in"}${pet ? `, with ${pet}${a.pets_on_furniture === "yes" ? " on the sofa" : ""}` : ""}.`;
  const pace = s.convo.pace ?? newPace();
  const still = missing(pace, "extras", factsOf(s, a)).map((m) => (m.startsWith("a budget") ? "Budget range" : m.startsWith("how they") ? "Where you like to shop" : "A date it needs to be ready for"));
  return {
    title: `Your ${room}`, statement, moods: [], program, constraints, direction,
    decisions: [...ruleDecisions(k, s.taste, said), ...(nod ? [{ decision: "One small nod (a framed print, a cushion or an object on a shelf), not a theme", because: nod }] : [])],
    nevers: never, open_questions: [...openQuestions(k, s.taste), ...still],
  };
}
