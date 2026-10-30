import type { Answer } from "./questions";
import type { SetId } from "./visual";

// How long the Taste Builder conversation runs, and when each section has enough (Maeve, 2026-10-29;
// docs/taste-builder.md "Length and minimums"). Three sections, each with a small design minimum: what a
// designer can't start without. The length they pick (or that their priorities point to) sets how far
// past the minimum each section goes. The live route and the free interpreter both read this file, and
// the page uses it to show how much is left.

export const SECTION_KEYS = ["you", "style", "extras"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const LENGTHS = {
  quick: { label: "Quick", time: "about 2 min", blurb: "Just the essentials" },
  standard: { label: "Standard", time: "about 5 min", blurb: "A good read on your style" },
  deep: { label: "In depth", time: "about 15 min", blurb: "For people who love this part" },
} as const;
export type Length = keyof typeof LENGTHS;
export const LENGTH_IDS = Object.keys(LENGTHS) as Length[];

// Their replies per section at each length, minimum included. Quick is the minimum and nothing more.
const TARGET: Record<Length, Record<SectionKey, number>> = {
  quick: { you: 2, style: 2, extras: 3 },
  standard: { you: 3, style: 4, extras: 4 },
  deep: { you: 5, style: 6, extras: 6 },
};

// What their priorities protect, as the designer reads them (open-ended words, mapped onto these)
export const PROTECTS = ["speed", "just_right", "style", "budget", "function", "personal"] as const;
export type Protect = (typeof PROTECTS)[number];

export interface Pace {
  length: Length;
  // they picked the length themselves (intro or the in-conversation control); their priorities then
  // shift the emphasis between sections but don't override it
  chosen?: boolean;
  // their replies in each section (a "keep going" doesn't count)
  replies: Partial<Record<SectionKey, number>>;
  // sections where the designer has offered the stopping point
  offered: SectionKey[];
  // their priorities, in their words, and what they protect
  priorities?: { words: string; protect: Protect[] };
}

export const newPace = (length: Length = "standard", chosen = false): Pace => ({ length, chosen, replies: {}, offered: [] });

// Older saved conversations used life / taste / story
export const OLD_SECTION: Record<string, SectionKey> = { life: "you", taste: "style", story: "extras" };

export function target(p: Pace, sec: SectionKey): number {
  const base = TARGET[p.length][sec];
  if (p.length === "quick") return base;
  const protect = p.priorities?.protect ?? [];
  const lean = (protect.includes("style") && sec === "style") || (protect.includes("personal") && sec === "extras") || (protect.includes("function") && sec === "you");
  return base + (lean ? 1 : 0);
}

export interface Facts {
  answers: Record<string, Answer>;
  shown: SetId[];
  // practical lines the designer drew in her words ("before Thanksgiving", "$3–4k"); a budget counts
  // only as a figure or a range, not "budget-minded"
  practical: string[];
}

const DATE = /\bby\b|\bbefore\b|\buntil\b|christmas|thanksgiving|holiday|month|week|spring|summer|autumn|fall|winter|move-in|\bdate\b|asap|soon/i;

// What each section can't do without. Kept small on purpose; everything else is depth.
export function missing(p: Pace, sec: SectionKey, f: Facts): string[] {
  const out: string[] = [];
  if (sec === "you") {
    if (!(p.replies.you ?? 0)) out.push("a little about them and how they'll use the space");
    if (!p.priorities && f.answers.tradeoff === undefined) out.push("their priorities");
  } else if (sec === "style") {
    if (!f.shown.includes("rooms")) out.push("the rooms set");
    if (!f.shown.includes("palettes")) out.push("the palettes set");
  } else {
    if (f.answers.shop === undefined && !f.practical.some((t) => /^(shops?|sourcing)\b/i.test(t))) out.push("how they like to shop");
    if (f.answers.budget === undefined && !f.practical.some((t) => /[$£€]|\d|thousand|hundred|grand\b/i.test(t))) out.push("a budget range");
    const hurry = p.priorities?.protect.includes("speed") || f.answers.tradeoff === "speed";
    if (f.answers.timeline === undefined && !hurry && !f.practical.some((t) => DATE.test(t))) out.push("a date that matters");
  }
  return out;
}

// About how many more of their replies, from this section on: honest, never less than what's still missing
export function remaining(p: Pace, from: string, f: Facts): number {
  const i = SECTION_KEYS.indexOf(from as SectionKey);
  if (i < 0) return 0;
  // Quick is the minimum and nothing more, so only what's missing counts
  return SECTION_KEYS.slice(i).reduce((n, sec) => {
    const need = missing(p, sec, f).length;
    return n + (p.length === "quick" ? need : Math.max(target(p, sec) - (p.replies[sec] ?? 0), need));
  }, 0);
}

export const nextSection = (sec: string): SectionKey | "readback" => {
  const i = SECTION_KEYS.indexOf(sec as SectionKey);
  return i >= 0 && i < SECTION_KEYS.length - 1 ? SECTION_KEYS[i + 1] : "readback";
};

// "I'm finished with this section", "move on", "next section"
export const FINISH = /^\W*(i'?m |i am )?(finished|done) with (this|that) (section|part|bit)\b|^\W*(move on|next section|let'?s move on|skip (this|ahead) (section|part))\b/i;
// "Keep going" after the stopping point: not a reply about the room
export const KEEP_GOING = /^\W*(keep going|carry on|go on|more|let'?s keep going)\W*$/i;

// Is this match negated in its own clause? "I'd rather it look good than be done fast", "not in a hurry"
export function negated(text: string, index: number): boolean {
  const before = text.slice(0, index).split(/[.,;!?]|\bbut\b/i).pop() ?? "";
  return /\b(than|not|no|never|isn'?t|don'?t|doesn'?t|rather than|instead of|less)\b/i.test(before);
}
const firstPlain = (re: RegExp, text: string) => {
  for (const m of text.matchAll(new RegExp(re.source, "gi"))) if (!negated(text, m.index ?? 0)) return true;
  return false;
};

// Asking for a different length in so many words (or saying plainly they're in a hurry); null when they didn't
export function askedLength(text: string, now: Length): Length | null {
  if (firstPlain(/\b(wrap (it |this )?up|in a (real )?hurry|short on time|running out of time|let'?s be quick|speed (this|it) up|keep it (short|quick)|just (want|need) it done|need it (done|livable|finished|sorted)( \w+)? (fast|quickly|soon)|speed first|speed,? honestly|as fast as possible|asap)\b/, text)) return "quick";
  if (firstPlain(/\b(more time|got time|go deeper|happy to go deeper|take (my|our) time with this|i love this)\b/, text)) return now === "quick" ? "standard" : "deep";
  return null;
}

// The pace, as the designer reads it each turn
export function paceBrief(p: Pace, sec: string, f: Facts, finished: boolean): string {
  const lines: string[] = [];
  lines.push(`Length: ${LENGTHS[p.length].label} (${LENGTHS[p.length].time}), ${p.chosen ? "chosen by them" : "the default; their priorities may resize it"}.`);
  if (p.priorities) lines.push(`Their priorities: "${p.priorities.words}" → ${p.priorities.protect.join(", ") || "nothing specific"}.`);
  if (finished) lines.push(sec === "readback" ? "They just said they're finished with the last section: go to the read-back now." : `They just said they're finished with the previous section. Open "${sec}" now with its first question, in one light line; don't ask anything more from the section they left.`);
  for (const s of SECTION_KEYS) {
    const m = missing(p, s, f);
    const r = p.replies[s] ?? 0;
    const here = s === sec ? " ← here" : "";
    lines.push(`- ${s}${here}: ${r} of about ${target(p, s)} replies. Minimum ${m.length ? `still needs: ${m.join("; ")}` : "covered"}.${p.offered.includes(s) ? " Stopping point already offered." : ""}`);
  }
  // what's already known about money and dates: never asked again
  const money = f.practical.find((t) => /[$£€]|\d|thousand|grand/i.test(t));
  const when = f.practical.find((t) => !/^budget/i.test(t) && DATE.test(t));
  if (money || f.answers.budget !== undefined) lines.push(`Budget KNOWN (${money ?? `answer: ${f.answers.budget}`}): never ask it again; confirm it and go deeper.`);
  if (when || f.answers.timeline !== undefined) lines.push(`Date KNOWN (${when ?? `answer: ${f.answers.timeline}`}): never ask it again.`);
  lines.push(`About ${remaining(p, sec, f)} replies left in all.`);
  // the one call the designer most often gets wrong: stopping when the section is done at this length
  if (!finished && SECTION_KEYS.includes(sec as SectionKey)) {
    const s = sec as SectionKey;
    const done = !missing(p, s, f).length && (p.length === "quick" || (p.replies[s] ?? 0) >= target(p, s));
    const next = nextSection(s);
    if (done) lines.push(`→ This section is done at their length. Move on now: ${next === "readback" ? "go to the read-back (section readback)" : `open "${next}" with its first question`}. Ask nothing more from "${s}".`);
    else if (!missing(p, s, f).length && p.length !== "quick" && !p.offered.includes(s)) lines.push(`→ The minimum here is covered: offer the stopping point now (stop_offered true), unless they just chose to keep going.`);
  }
  return lines.join("\n");
}
