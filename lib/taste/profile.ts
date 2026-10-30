import { PERSONAS } from "../personas";
import { QUESTIONS, walk, type Answer, type Known, type ProfileField, type Question } from "./questions";

// The AI profile as a list of assumptions, for the dev-only "What Homebody
// assumes about me" view. Pure: it reads the question tree's own rules and
// their `because`, so every assumption cites the answer, scan signal or sort
// choice it came from. Anything not said or inferred is "Not yet known";
// it never guesses past what the rules already infer.

export const NOT_YET_KNOWN = "Not yet known";

export type ProfileSource = "capture answer" | "taste answer" | "scan signal" | "keep-move-remove choice" | "said in conversation";

export interface Assumption {
  // a ProfileField from the tree, or a profile-only one like the persona
  field: ProfileField | "persona" | "scan.style" | "scan.price_level" | "scan.lifestyle" | "sort.pattern" | "intake.space" | "intake.bringing" | "intake.wish" | "story.note";
  label: string;
  group: string;
  value: string;
  // null while it's not yet known
  source: ProfileSource | null;
  // said: they answered it; sure: inferred firmly enough to skip asking; guess: a prefill they haven't
  // confirmed, or an inference resting on one; reading: what the scan read, never said by them
  status: "said" | "sure" | "guess" | "reading" | "unknown";
  // the why, naming its evidence
  because: string;
  // where it came from, in words, with how firm it is
  from: string;
  // the evidence in a few words, for reasons built from several rows (the persona)
  on?: string;
}

// The ProfileField names, in words, with the section they sit in
const FIELD: Record<ProfileField, [group: string, label: string]> = {
  "bucket.start": ["Persona", "Starting point"],
  "bucket.approach": ["Persona", "Approach"],
  "bucket.tradeoff": ["Persona", "What to protect"],
  "bucket.timeline": ["Budget and timing", "Timeline"],
  "bucket.budget": ["Budget and timing", "Budget"],
  "household.size": ["Household", "People using the room"],
  "household.kids": ["Household", "Kids"],
  "household.kid_ages": ["Household", "Kids' ages"],
  "household.pets": ["Household", "Pets"],
  "household.pets_on_furniture": ["Household", "Pets on the sofa"],
  "space.uses": ["The room", "What it's used for"],
  "space.priorities": ["The room", "What it needs to get right"],
  "work.from_home": ["Lifestyle", "Works from the room"],
  "work.calls": ["Lifestyle", "Video calls"],
  "lifestyle.hosting": ["Lifestyle", "Hosting"],
  "lifestyle.hosting_style": ["Lifestyle", "Hosting style"],
  "lifestyle.unwind": ["Lifestyle", "Unwinding"],
  "lifestyle.routine": ["Lifestyle", "Daily routine"],
  "style.look": ["Style", "Look"],
  "style.look_detail": ["Style", "Look, more specifically"],
  "style.inspiration": ["Style", "A place that felt right"],
  "style.color": ["Style", "Color"],
  "style.bold_colors": ["Style", "Bold colors"],
  "style.pattern": ["Style", "Pattern"],
  "style.materials": ["Style", "Materials"],
  "style.avoid": ["Style", "Never wants"],
  "style.anchor_piece": ["Meaningful details", "Anchor piece"],
  "story.places": ["Meaningful details", "Places that feel like home"],
  "story.places_feel": ["Meaningful details", "What home felt like there"],
  "story.meaningful_detail": ["Meaningful details", "Something small to nod to"],
};

export const GROUPS = ["Persona", "Budget and timing", "Household", "The room", "Lifestyle", "Style", "Meaningful details", "From the capture"];

const quote = (s: string) => `"${s}"`;

const SOURCE_WORDS: Record<ProfileSource, string> = {
  "taste answer": "Your answers here",
  "capture answer": "Your answers in Space Capture",
  "scan signal": "The scan's reading of the room",
  "keep-move-remove choice": "Your keep, move and remove taps",
  "said in conversation": "Said in conversation",
};
const STATUS_WORDS: Record<Assumption["status"], string> = {
  said: "", sure: "", unknown: "", guess: ", a guess you haven't confirmed", reading: ", not something you said",
};
const fromWords = (source: ProfileSource | null, status: Assumption["status"]) => (source ? SOURCE_WORDS[source] + STATUS_WORDS[status] : "");

// An answer in words, using the question's own choice labels
function show(q: Question, k: Known, a: Answer): string {
  if (typeof a === "number") return String(a);
  const kind = q.kind;
  const choices = kind.type === "single" || kind.type === "multi" ? [...(q.choicesFrom?.(k) ?? []), ...kind.choices] : [];
  const label = (id: string) => choices.find((c) => c.id === id)?.label ?? id;
  if (Array.isArray(a)) return a.length ? a.map(label).join(" · ") : "None picked";
  if (kind.type === "text") return a.trim() ? a : "Nothing came to mind";
  return label(a);
}

// Which of the four signals a rule's answer rests on: re-run it with less known,
// and the smallest set that still lands on the same answer is the source. The first
// two use only what they actually said, so an answer the tree inferred from the scan
// (uses, say) doesn't pass for a taste answer.
function sourceOf(q: Question, k: Known, said: Record<string, Answer>, value: Answer): ProfileSource {
  const same = (part: Known) => {
    const r = q.known?.(part);
    return !!r && JSON.stringify("skip" in r ? r.skip : r.prefill) === JSON.stringify(value);
  };
  if (same({ answers: said })) return "taste answer";
  if (same({ intake: k.intake, answers: said })) return "capture answer";
  if (same({ intake: k.intake, scan: k.scan, answers: k.answers })) return "scan signal";
  return "keep-move-remove choice";
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
// a choice label mid-sentence ("Built around me" → "built around me")
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// notes: personal-story details said in the conversation, in their words, beside the story answers
export function buildProfile(known: Omit<Known, "answers">, answers: Record<string, Answer>, notes: string[] = []): Assumption[] {
  const base: Known = { ...known, answers };
  const steps = walk(base, "all");
  // what the tree treats as known by the end: answers plus every skip and prefill
  const all: Record<string, Answer> = { ...answers };
  for (const st of steps) if (st.status === "skip" || st.status === "prefill") all[st.id] = st.value;
  const guessed = steps.filter((st) => st.status === "prefill" && answers[st.id] === undefined).map((st) => st.id);
  const k: Known = { ...known, answers: all, guessed };
  // rules re-run against everything known except the question itself
  const without = (id: string): Known => {
    const rest = { ...all };
    delete rest[id];
    return { ...known, answers: rest, guessed };
  };
  // a skip that no longer holds once the unconfirmed guesses are taken out rests on a guess
  const restsOnGuess = (q: Question, value: Answer) => {
    const firm = { ...all };
    for (const id of [...guessed, q.id]) delete firm[id];
    const r = q.known?.({ ...known, answers: firm });
    return !r || !("skip" in r) || JSON.stringify(r.skip) !== JSON.stringify(value);
  };

  const out: Assumption[] = [];
  const byId: Record<string, Assumption> = {};

  for (const st of steps) {
    if (st.status === "hidden") continue;
    const q = QUESTIONS.find((x) => x.id === st.id)!;
    const [group, label] = FIELD[q.feeds];
    let a: Assumption;
    if (answers[q.id] !== undefined) {
      // what the tree would have guessed, so a changed or confirmed guess shows
      const r = q.known?.(without(q.id));
      const guess = r ? ("skip" in r ? r.skip : r.prefill) : undefined;
      const value = show(q, k, answers[q.id]);
      const guessFrom = guess === undefined ? "" : SOURCE_WORDS[sourceOf(q, without(q.id), answers, guess)].toLowerCase();
      const because =
        guess === undefined ? "You picked it"
        : JSON.stringify(guess) === JSON.stringify(answers[q.id]) ? `You confirmed the guess. ${r!.because}`
        : `You picked it over the guess ${quote(show(q, k, guess))}. ${r!.because}`;
      a = {
        field: q.feeds, label, group, value, source: "taste answer", status: "said", because,
        from: guess === undefined ? "Your answer here" : `Your answer here, ${JSON.stringify(guess) === JSON.stringify(answers[q.id]) ? "backing" : "over"} ${guessFrom}`,
        on: "your answer",
      };
    } else if (st.status === "skip" || st.status === "prefill") {
      const source = sourceOf(q, without(q.id), answers, st.value);
      const status = st.status === "prefill" || restsOnGuess(q, st.value) ? "guess" : "sure";
      a = { field: q.feeds, label, group, value: show(q, k, st.value), source, status, because: st.because, from: fromWords(source, status), on: st.on };
    } else {
      a = { field: q.feeds, label, group, value: NOT_YET_KNOWN, source: null, status: "unknown", because: "", from: "" };
    }
    byId[q.id] = a;
    out.push(a);
  }

  out.unshift(persona(byId.start, byId.approach, all));

  for (const n of notes)
    out.push({ field: "story.note", label: "Something they shared", group: "Meaningful details", value: n, source: "said in conversation", status: "said", because: "Came up in the conversation, unprompted", from: SOURCE_WORDS["said in conversation"] });

  // Signals from the capture no question has turned into an answer yet
  const cap = (field: Assumption["field"], label: string, value: string | undefined, source: ProfileSource, because: string) => {
    // the scan's readings are its own, never something they said
    const status = source === "scan signal" ? "reading" : "said";
    out.push(value ? { field, label, group: "From the capture", value, source, status, because, from: fromWords(source, status) } : { field, label, group: "From the capture", value: NOT_YET_KNOWN, source: null, status: "unknown", because: "", from: "" });
  };
  const i = known.intake;
  const space = i?.scope ? (i.scope === "room" ? `One room${i.room ? `, the ${i.room}` : ""}` : `A whole ${i.scope}${i.room ? `, starting with the ${i.room}` : ""}`) : undefined;
  cap("intake.space", "The space", space && `${space}${i?.access ? (i.access === "yes" ? ", in it now" : ", can't be there yet") : ""}`, "capture answer", "You said so at the start of Space Capture");
  cap("intake.bringing", "Bringing pieces", i?.bringing && (i.bringing === "yes" ? (i.brought?.length ? i.brought.join(" · ") : "Yes") : "No"), "capture answer", i?.bringing === "yes" ? "You said you're bringing pieces from elsewhere" : "You said you aren't bringing anything");
  cap("intake.wish", "Something in mind", i?.wish && (i.wish === "yes" ? i.wishUrl || "Yes" : "No"), "capture answer", i?.wish === "yes" ? "You said you already have something in mind" : "You said nothing specific is in mind yet");
  const sig = known.scan?.profile_signals;
  const pieces = known.scan?.items.length ? plural(known.scan.items.length, "piece") : "pieces";
  cap("scan.style", "Style cues", sig?.style.join(" · "), "scan signal", `How the scan read the look of the ${pieces} in the room`);
  cap("scan.price_level", "Price level", sig?.price_level, "scan signal", `How the scan priced the ${pieces} in the room`);
  cap("scan.lifestyle", "Lifestyle hints", sig?.lifestyle.join(" · "), "scan signal", `What the scan guessed about how you live from the ${pieces} in the room`);
  const s = known.sort;
  const n = s ? s.keep + s.move + s.remove : 0;
  // untouched pieces count in keep but say nothing, so only taps are cited
  const taps = s ? s.tappedKeep + s.move + s.remove : 0;
  cap(
    "sort.pattern", "Sorting",
    s && n ? `Tapped keep on ${s.tappedKeep}, moving ${s.move}, removing ${s.remove}` : undefined,
    "keep-move-remove choice",
    s && n ? `Your taps on ${plural(taps, "piece")}; the ${s.keep - s.tappedKeep} left untouched say nothing` : "",
  );
  return out;
}

// start × approach → the 2×2 persona. Both halves have to be known; confidence
// is how firmly: said or sure counts 2, an unconfirmed guess counts 1.
function persona(start: Assumption | undefined, approach: Assumption | undefined, all: Record<string, Answer>): Assumption {
  const base = { field: "persona" as const, label: "Persona bucket", group: "Persona" };
  const mode = all.start;
  const tier = all.approach;
  const p = Object.values(PERSONAS).find((x) => x.mode === mode && x.tier === tier);
  if (!p || !start || !approach) return { ...base, value: NOT_YET_KNOWN, source: null, status: "unknown", because: "", from: "" };
  const score = [start, approach].reduce((t, a) => t + (a.status === "guess" ? 1 : 2), 0);
  const confidence = score === 4 ? "confident" : score === 3 ? "likely" : "early guess";
  // the weaker half is the one the bucket rests on
  const weak = start.status === "guess" || approach.status !== "guess" ? start : approach;
  const status = score === 4 ? (start.status === "said" && approach.status === "said" ? "said" : "sure") : "guess";
  // what each half rests on, said once when they share it
  const rests =
    start.status === "said" && approach.status === "said" ? "both are your answers"
    : start.on && start.on === approach.on ? `both rest on ${start.on}`
    : `the starting point rests on ${start.on ?? "the scan and sort"}, the approach on ${approach.on ?? "the scan and sort"}`;
  return {
    ...base,
    value: `${p.name} (${confidence})`,
    source: weak.source,
    status,
    because: `${start.value} + ${lower(approach.value)} → ${p.name}; ${rests}`,
    from: fromWords(weak.source, status),
  };
}
