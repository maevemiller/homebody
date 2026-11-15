import { choiceSaid } from "./agent";
import { QUESTIONS, walk, type Answer, type Known } from "./questions";
import { similar, type Convo, type Icon, type Zone } from "./session";
import { MATERIAL, PALETTE, PATTERN, ROOM, type TasteState } from "./visual";

// The plain facts on the dossier, drawn from what's recorded rather than by the model:
// who's here, what the room's for, what stays, the hard nos and the practical strip.
// Confirmed answers are ink; the tree's unconfirmed guesses are pencil with a "?"
// (dossier.md §3.3). The live designer adds the texture on top (moments, quotes, arrows).

export interface Fact {
  key: string;
  zone: Zone;
  text: string;
  icon?: Icon;
  because?: string;
  sure: boolean;
}

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
const label = (id: string, v: string) => {
  const q = BY_ID.get(id);
  return q && (q.kind.type === "single" || q.kind.type === "multi") ? q.kind.choices.find((c) => c.id === v)?.label ?? v : v;
};
const WORD = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

const USE: Record<string, [string, Icon]> = {
  relax: ["unwinding on the sofa", "sofa"], tv: ["films and TV", "tv"], reading: ["reading", "book"], hosting: ["friends over", "wine"],
  eating: ["meals", "table"], working: ["working", "desk"], sleeping: ["sleep", "bed"], play: ["kids playing", "child"],
};
const AGES: Record<string, string> = { under3: "under 3", "3to7": "3–7", "8to12": "8–12", teen: "teens" };

// drawNotes: the offline interpreter's story notes go on the page as said; the live designer draws its own
// unsure: tree answers the designer recorded that her own words haven't confirmed (pencil)
// said: her own words so far; a guessed choice she has since named ("a book or a show") is ink
export function facts(base: Omit<Known, "answers">, answers: Record<string, Answer>, notes: string[], taste: TasteState, drawNotes = true, unsure: string[] = [], said = ""): Fact[] {
  const out: Fact[] = [];
  const k: Known = { ...base, answers };
  // what the tree guesses but nobody has confirmed: drawn in pencil
  const guess: Record<string, Answer> = {};
  for (const st of walk(k, "all")) if (st.status === "prefill" && answers[st.id] === undefined) guess[st.id] = st.value;
  const val = (id: string) => answers[id] ?? guess[id];
  const sure = (id: string) => answers[id] !== undefined && !unsure.includes(id);

  // who
  const people = val("people");
  if (typeof people === "number") out.push({ key: "people", zone: "who", text: people === 1 ? "just you" : `${WORD[people] ?? people} of you`, icon: "people", sure: sure("people") });
  const kids = val("kids");
  if (kids === "home" || kids === "visit") {
    const ages = val("kid_ages");
    const a = Array.isArray(ages) && ages.length ? ` (${ages.map((x) => AGES[x] ?? x).join(", ")})` : "";
    out.push({ key: "kids", zone: "who", text: `${kids === "home" ? "kids at home" : "kids who visit"}${a}`, icon: "child", because: Array.isArray(ages) && ages.includes("under3") ? "rounded edges; nothing breakable below 3 ft" : "wipeable, low-sheen finishes", sure: sure("kids") });
  }
  const pets = val("pets");
  if (Array.isArray(pets) && !pets.includes("none")) {
    const on = val("pets_on_furniture") === "yes";
    const name = pets.includes("cat") ? "a cat" : pets.includes("dog") ? "a dog" : "a pet";
    out.push({ key: "pets", zone: "who", text: on ? `${name}, allowed on the sofa` : name, icon: pets.includes("cat") ? "cat" : pets.includes("dog") ? "dog" : "heart", because: on ? "tight-weave performance fabric, no loop pile" : undefined, sure: sure("pets") });
  }

  // a day in the room
  const uses = val("uses");
  const wfhSaid = val("work_from_home") === "daily" || val("work_from_home") === "sometimes";
  if (Array.isArray(uses)) for (const u of uses.slice(0, 5)) if (USE[u] && !(u === "working" && wfhSaid)) out.push({ key: `use-${u}`, zone: "day", text: USE[u][0], icon: USE[u][1], sure: sure("uses") || (!!said && choiceSaid("uses", u, said)) });
  const wfh = val("work_from_home");
  if (wfh === "daily" || wfh === "sometimes")
    out.push({ key: "wfh", zone: "day", text: wfh === "daily" ? "works in here most days" : "works in here sometimes", icon: "desk", because: val("video_calls") === "yes" ? "plain, lit wall behind the desk" : wfh === "sometimes" ? "a desk that closes up after work" : undefined, sure: sure("work_from_home") });
  const host = val("hosting_style");
  if (host) out.push({ key: "host", zone: "day", text: host === "table" ? "dinner around a table" : host === "sofa" ? "everyone piled on the sofa" : "table and sofa, both", icon: host === "table" ? "table" : "people", because: host === "table" ? "extendable table; budget to the table" : host === "sofa" ? "seating for extra guests; budget to seating" : undefined, sure: sure("hosting_style") });

  // what stays
  const bins = base.sort?.bins ?? {};
  const fresh = answers.start === "fresh";
  if (!fresh)
    for (const it of base.scan?.items ?? []) if ((bins[it.id] === "keep" || bins[it.id] === "move") && it.id !== answers.anchor) out.push({ key: `keep-${it.id}`, zone: "keep", text: it.name.toLowerCase(), sure: true });
  const anchor = answers.anchor;
  if (typeof anchor === "string" && anchor !== "none") {
    const name = base.scan?.items.find((i) => i.id === anchor)?.name ?? (anchor.startsWith("brought_") ? base.intake?.brought?.[Number(anchor.slice(8))] : anchor);
    if (name) out.push({ key: "anchor", zone: "keep", text: `${name.toLowerCase()} — the anchor`, icon: "star", sure: sure("anchor") });
  }

  // never
  const avoid = answers.avoid;
  if (typeof avoid === "string" && avoid.trim() && !taste.palettes.never.length && !taste.materials.never.length && !taste.patterns.never.length) out.push({ key: "avoid", zone: "never", text: avoid.trim().toLowerCase(), sure: true });
  for (const id of taste.palettes.never) out.push({ key: `np-${id}`, zone: "never", text: PALETTE.get(id)?.name.toLowerCase() ?? id, sure: true });
  for (const id of taste.materials.never) out.push({ key: `nm-${id}`, zone: "never", text: MATERIAL.get(id)?.label.toLowerCase() ?? id, sure: true });
  for (const id of taste.patterns.never) out.push({ key: `nt-${id}`, zone: "never", text: PATTERN.get(id)?.label.toLowerCase() ?? id, sure: true });
  for (const id of taste.rooms.never.slice(0, 2)) out.push({ key: `nr-${id}`, zone: "never", text: (ROOM.get(id)?.alt.split(/,| with | under | onto | against /)[0] ?? id).toLowerCase(), sure: true });

  // story: their details, in their words
  if (drawNotes) for (const [n, note] of notes.entries()) out.push({ key: `note-${n}`, zone: "story", text: note, icon: /grand|mother|father|mum|mom|dad/i.test(note) ? "heart" : undefined, sure: true });
  const places = answers.places;
  if (typeof places === "string" && places.trim()) out.push({ key: "places", zone: "story", text: places.trim(), icon: "pin", sure: true });

  // practical: only what they said. The scan's price reading and the hidden persona read
  // (fresh/refresh, pulled together/built around) never go on their page.
  const budget = answers.budget;
  if (budget && budget !== "unsure") out.push({ key: "budget", zone: "practical", text: `budget: ${label("budget", String(budget)).toLowerCase()}`, sure: sure("budget") });
  const tl = answers.timeline;
  if (tl) out.push({ key: "timeline", zone: "practical", text: `by: ${label("timeline", String(tl)).toLowerCase()}`, icon: "sun", sure: sure("timeline") });
  const shop = answers.shop;
  if (Array.isArray(shop) && shop.length) {
    const names = typeof answers.brands === "string" && answers.brands.trim() ? `; ${answers.brands.trim().replace(/[.!]+$/, "")}` : "";
    out.push({ key: "shop", zone: "practical", text: `shops: ${shop.map((c) => label("shop", c).toLowerCase()).join(", ")}${names}`, icon: "home", sure: sure("shop") });
  }
  return out;
}

// The facts as they go on the page: the offline interpreter's notes only when offline (the live
// designer draws its own), and no budget or date line when the designer has already written
// theirs in their words ("$5–8k, the sofa is the splurge"), so the read-back has no duplicate rows.
export function pageFacts(base: Omit<Known, "answers">, answers: Record<string, Answer>, notes: string[], taste: TasteState, convo: Pick<Convo, "offline" | "dossier" | "designerSet"> & { transcript?: Convo["transcript"] }): Fact[] {
  const designer = convo.dossier.filter((d) => !d.crossed);
  const drawn = designer.filter((d) => d.zone === "practical").map((d) => d.text.toLowerCase());
  const money = drawn.some((t) => /[$£€]|\bbudget\b|\bspend|\bsplurge|\bk\b|\d+k/.test(t));
  const date = drawn.some((t) => /\bby\b|\bbefore\b|\buntil\b|christmas|holiday|month|week|spring|summer|autumn|fall|winter|move-in|\bdate\b/.test(t));
  // where her words (drawn by the designer) already say it, the generic line steps aside rather than repeating it
  const covered = (f: Fact) => designer.some((d) => d.zone === f.zone && similar(d.text, f.text));
  const said = (convo.transcript ?? []).filter((l) => l.who === "you" && !l.event).map((l) => l.text).join(" \n ");
  return facts(base, answers, notes, taste, !!convo.offline, convo.designerSet ?? [], said)
    .filter((f) => !(f.key === "budget" && money) && !(f.key === "timeline" && date))
    .filter((f) => !covered(f));
}
