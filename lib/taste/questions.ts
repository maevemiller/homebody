import type { RoomItem, RoomSpec } from "../scan/spec";

// The Taste Builder question tree, as data. The conversation screen, the AI
// profile and the dev-only "What Homebody assumes about me" view all read this
// one tree, so a question's wording, branch and skip rule live in one place.
// Prompts are spoken lines: the same tree runs as text now and voice later.

// Broad to specific, bucketing first: the earliest answers narrow everything after
export const STAGES = [
  "bucketing", "functional", "functional_branch", "lifestyle", "style_broad", "style_specific", "story",
] as const;
export type Stage = (typeof STAGES)[number];

export type Answer = string | string[] | number;

export interface Choice {
  id: string;
  label: string;
  // picking it clears the others in a multi choice ("No pets" with "A dog" can't both be true)
  exclusive?: boolean;
}

export type AnswerKind =
  | { type: "single"; choices: Choice[] }
  | { type: "multi"; choices: Choice[] }
  | { type: "text"; placeholder: string }
  | { type: "number"; min: number; max: number };

// What Space Capture already knows when Taste Builder opens. Mirrors the
// CaptureFlow Answers fields we read, the scan's spec, and the sort counts.
// `keep` includes untouched pieces, as "Done" leaves them where they are, but
// only taps are signals: `tappedKeep` counts the pieces someone actually tapped
// Keep on, and untouched pieces never count as kept.
export interface Known {
  intake?: {
    scope?: "room" | "apartment" | "house";
    room?: string;
    access?: "yes" | "no";
    have?: string[];
    bringing?: "yes" | "no";
    brought?: string[];
    wish?: "yes" | "no";
    wishUrl?: string;
  };
  scan?: Pick<RoomSpec, "profile_signals" | "items">;
  // the captured room's size and windows, in feet, for the brief's clearances and light (lib/taste/saved.ts)
  space?: Space;
  sort?: {
    keep: number;
    tappedKeep: number;
    move: number;
    remove: number;
    bins?: Record<string, "keep" | "move" | "remove" | undefined>;
  };
  answers: Record<string, Answer>;
  // answers walk() filled in from prefills, which nobody has confirmed yet
  guessed?: string[];
}

export interface Space {
  // the footprint's bounding box, long side first, in feet
  length: number;
  width: number;
  ceiling: number;
  windows: { width: number }[];
  doors: number;
  // the capture's light reading, in its words ("big south-facing window, bright afternoons")
  light: string;
}

// Named so every skip or prefill can cite where it came from
export type Source =
  | "intake.scope" | "intake.room" | "intake.access" | "intake.have" | "intake.bringing" | "intake.wish"
  | "scan.style" | "scan.price_level" | "scan.lifestyle" | "scan.items"
  | "sort.counts"
  | "answers";

// skip: we're sure enough not to ask. prefill: ask it as a quick confirm
// ("Sounds like you're starting fresh, right?"). `because` is the cited reason
// the assumptions view shows; `on` names the evidence in a few words, for
// reasons built from several answers (the persona).
export type KnownRule = (k: Known) => ({ skip: Answer } | { prefill: Answer }) & { because: string; on?: string } | null;

export type ProfileField =
  | "bucket.start" | "bucket.approach" | "bucket.tradeoff" | "bucket.timeline" | "bucket.budget"
  | "shopping.channels" | "shopping.brands"
  | "household.size" | "space.uses" | "space.priorities"
  | "household.kids" | "household.kid_ages" | "household.pets" | "household.pets_on_furniture"
  | "work.from_home" | "work.calls"
  | "lifestyle.hosting" | "lifestyle.hosting_style" | "lifestyle.unwind" | "lifestyle.routine"
  | "style.look" | "style.color" | "style.bold_colors" | "style.pattern" | "style.materials" | "style.avoid"
  | "style.look_detail" | "style.inspiration" | "style.anchor_piece"
  | "story.places" | "story.places_feel" | "story.meaningful_detail";

export interface Question {
  id: string;
  stage: Stage;
  prompt: string;
  kind: AnswerKind;
  // choices built from what's known (their own pieces), listed before the kind's fixed ones
  choicesFrom?: (k: Known) => Choice[];
  // core questions make the short path; the rest is depth people can come back to
  core: boolean;
  // branch condition on earlier answers; absent means everyone at this stage sees it
  showIf?: (k: Known) => boolean;
  from: Source[];
  known?: KnownRule;
  feeds: ProfileField;
  // why it earns its time; also the doc's one-liner
  why: string;
}

const c = (id: string, label: string, exclusive?: boolean): Choice => (exclusive ? { id, label, exclusive } : { id, label });
const has = (k: Known, id: string, v: string) => {
  const a = k.answers[id];
  return Array.isArray(a) ? a.includes(v) : a === v;
};
const items = (k: Known) => k.scan?.items ?? [];
const sorted = (k: Known) => {
  const s = k.sort;
  return s ? s.keep + s.move + s.remove : 0;
};
// Only taps are signals: a Keep or Move tap says "this stays"; untouched doesn't
const tappedKeeps = (k: Known) => (k.sort ? k.sort.tappedKeep + k.sort.move : 0);
const tappedKeptItems = (k: Known): RoomItem[] =>
  items(k).filter((i) => k.sort?.bins?.[i.id] === "keep" || k.sort?.bins?.[i.id] === "move");
// Still in the room (not marked to remove), offered as picks, never assumed as answers
const stayingItems = (k: Known): RoomItem[] => items(k).filter((i) => k.sort?.bins?.[i.id] !== "remove");
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
// "kept or moved 3 pieces: the walnut console, …", so every row citing these taps names the same pieces
const keptPieces = (k: Known) => {
  const names = tappedKeptItems(k).map((i) => i.name);
  return `kept or moved ${plural(tappedKeeps(k), "piece")}${names.length ? `: ${listed(names)}` : ""}`;
};
const scanHas = (k: Known, ...cats: RoomItem["category"][]) => items(k).some((i) => cats.includes(i.category));
const styleText = (k: Known) => (k.scan?.profile_signals.style ?? []).join(" ").toLowerCase();
const listed = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const quoted = (xs: string[]) => `"${xs.join(" · ")}"`;

const LOOKS = [
  c("midcentury", "Warm mid-century"), c("scandi", "Light and Scandinavian"), c("minimal", "Modern and minimal"),
  c("eclectic", "Collected and eclectic"), c("traditional", "Classic and traditional"),
  c("organic", "Earthy and natural"), c("industrial", "Industrial loft"), c("unsure", "Not sure yet"),
];

// Scan style cues are free text, so match on the words a designer would use
const LOOK_WORDS: [string, RegExp][] = [
  ["midcentury", /mid.?century|retro|60s|teak|walnut/],
  ["scandi", /scandi|nordic|danish|hygge|japandi/],
  ["minimal", /minimal|modern|contemporary|clean/],
  ["eclectic", /eclectic|boho|maximal|vintage|collected/],
  ["traditional", /traditional|classic|antique|farmhouse/],
  ["organic", /organic|natural|earthy|rustic|wabi/],
  ["industrial", /industrial|loft|brick/],
];

// The look the scan's style cues point to, if any
const scanLook = (k: Known) => {
  const s = styleText(k);
  return (s && LOOK_WORDS.find(([, re]) => re.test(s))?.[0]) || null;
};
// What each look usually means for the palette, for when their look overrules the scan's
const LOOK_COLOR: Record<string, string> = {
  midcentury: "warm", scandi: "light", minimal: "light", eclectic: "bold", traditional: "warm", organic: "warm", industrial: "warm",
};

// Scan items as the uses rule names them
const ITEM_WORDS: Partial<Record<RoomItem["category"], string>> = {
  sofa: "a sofa", sectional: "a sectional", tv: "a TV", bookshelf: "a bookshelf", dining_table: "a dining table",
  desk: "a desk", office_chair: "an office chair", bed: "a bed",
};

// Scan materials to the choices below; only tapped keeps feed the prefill
const MATERIAL_CHOICE: Partial<Record<RoomItem["primary_material"], string>> = {
  wood_light: "pale_wood", wood_mid: "warm_wood", wood_dark: "warm_wood", fabric: "linen",
  velvet: "velvet", boucle: "boucle", leather: "leather", metal_brass: "brass", metal_black: "black_metal",
  marble: "stone", stone: "stone", wicker: "rattan", ceramic: "ceramic", glass: "glass",
};

export const QUESTIONS: readonly Question[] = [
  // 1. Bucketing: the 2×2 and the tradeoffs from the April 12 notes
  {
    id: "start",
    stage: "bucketing",
    prompt: "Are you starting fresh in a new place, or giving a room you already live in a refresh?",
    kind: { type: "single", choices: [c("fresh", "Starting fresh"), c("refresh", "A refresh")] },
    core: true,
    from: ["intake.scope", "intake.access", "intake.have", "scan.items", "sort.counts"],
    known: (k) => {
      const i = k.intake;
      const away = i?.access === "no";
      if (away && k.scan && items(k).length === 0)
        return { skip: "fresh", because: "Can't be in the space yet and the scan found it empty", on: "an empty space you can't get into yet" };
      if (away && (i?.scope !== "room" || i.have?.includes("floorplan")))
        return { prefill: "fresh", because: `Can't be in the space yet, planning ${i?.scope === "room" ? "from a floor plan" : `a whole ${i?.scope}`}`, on: "planning from away" };
      const n = sorted(k);
      if (n && k.sort!.remove / n >= 0.5)
        return { prefill: "fresh", because: `Removing ${k.sort!.remove} of ${n} pieces`, on: `removing ${k.sort!.remove} of ${n} pieces` };
      // only pieces they tapped Keep or Move on; leaving the sort untouched says nothing
      const kept = tappedKeeps(k);
      if (i?.access === "yes" && kept)
        return { prefill: "refresh", because: `In the room now and ${keptPieces(k)}`, on: `the ${plural(kept, "piece")} you kept or moved` };
      return null;
    },
    feeds: "bucket.start",
    why: "Half the 2×2. Fresh starts need a full plan; refreshes work around what stays.",
  },
  {
    id: "approach",
    stage: "bucketing",
    prompt: "Would you like a finished room pulled together for you, or one built around you and the things you already love?",
    kind: { type: "single", choices: [c("standard", "Pulled together for me"), c("customized", "Built around me and my things")] },
    core: true,
    from: ["intake.bringing", "intake.wish", "sort.counts"],
    known: (k) => {
      const n = sorted(k);
      const kept = tappedKeeps(k);
      if (k.intake?.bringing === "yes") return { prefill: "customized", because: "Bringing pieces from elsewhere", on: "the pieces you're bringing" };
      if (k.intake?.wish === "yes") return { prefill: "customized", because: "Already has something specific in mind", on: "what you already have in mind" };
      if (n && k.sort!.remove / n >= 0.5) return { prefill: "standard", because: `Clearing out ${k.sort!.remove} of ${n} pieces`, on: `removing ${k.sort!.remove} of ${n} pieces` };
      if (kept) return { prefill: "customized", because: capital(keptPieces(k)), on: `the ${plural(kept, "piece")} you kept or moved` };
      return null;
    },
    feeds: "bucket.approach",
    why: "The other half of the 2×2. It picks the persona, the service tier and how much we curate.",
  },
  {
    id: "tradeoff",
    stage: "bucketing",
    prompt: "Where do your priorities lie with this room?",
    kind: {
      type: "single",
      choices: [
        c("speed", "Getting it done soon"), c("right", "Getting it just right"), c("budget", "The budget"), c("style", "The look"),
        c("function", "How it works day to day"), c("custom", "Making it personal"),
      ],
    },
    core: false,
    from: [],
    feeds: "bucket.tradeoff",
    why: "The April 12 tradeoff, asked early and open-ended (Maeve, 2026-10-29). It sizes the interview and sets what we give up first when the plan can't have everything.",
  },
  {
    id: "timeline",
    stage: "bucketing",
    prompt: "When would you love for it to be done?",
    kind: { type: "single", choices: [c("asap", "As soon as possible"), c("1-3mo", "In the next few months"), c("no_rush", "No rush")] },
    core: true,
    from: [],
    feeds: "bucket.timeline",
    why: "Decides in-stock over made-to-order, and whether we plan in phases.",
  },
  {
    id: "budget",
    stage: "bucketing",
    prompt: "What kind of budget feels right for this?",
    kind: { type: "single", choices: [c("lean", "Keep it lean"), c("mid", "Somewhere in the middle"), c("invest", "Happy to invest"), c("unsure", "Not sure yet")] },
    core: true,
    from: ["scan.price_level"],
    known: (k) => {
      const p = k.scan?.profile_signals.price_level.toLowerCase() ?? "";
      // never prefill "lean": it tells people their things look cheap
      const level = /mid/.test(p) ? "mid" : /high|premium|designer|luxury/.test(p) ? "invest" : null;
      return level ? { prefill: level, because: `Existing pieces read as "${k.scan!.profile_signals.price_level}"` } : null;
    },
    feeds: "bucket.budget",
    why: "Every recommendation is priced. A range here beats guessing, and avoids a price that feels like paying for a quiz.",
  },
  {
    id: "shop",
    stage: "bucketing",
    prompt: "Where do you like to find things for your home?",
    kind: {
      type: "multi",
      choices: [
        c("secondhand", "Thrift and secondhand"), c("vintage", "Vintage and antiques"), c("affordable", "Affordable, in stock"),
        c("mid", "Mid-range shops"), c("designer", "Designer pieces"), c("makers", "Small makers, made to order"),
      ],
    },
    core: true,
    from: [],
    feeds: "shopping.channels",
    why: "Decides where every piece is sourced: secondhand finds, the shops they trust, or made to order, and so which brands the plan is built from (Maeve, 2026-10-30).",
  },
  {
    id: "brands",
    stage: "bucketing",
    prompt: "Are there any shops or makers you already love?",
    kind: { type: "text", placeholder: "Article, Facebook Marketplace, a ceramicist on Etsy…" },
    core: false,
    from: [],
    feeds: "shopping.brands",
    why: "Real products come from the places they already trust first.",
  },

  // 2. Functional, for everyone
  {
    id: "people",
    stage: "functional",
    prompt: "How many people use this room most days?",
    kind: { type: "number", min: 1, max: 12 },
    core: true,
    from: [],
    feeds: "household.size",
    why: "Seating, table size and storage all scale with it.",
  },
  {
    id: "uses",
    stage: "functional",
    prompt: "What do you mostly use this room for?",
    kind: {
      type: "multi",
      choices: [
        c("relax", "Relaxing"), c("tv", "Watching TV"), c("reading", "Reading"), c("hosting", "Having people over"),
        c("eating", "Eating"), c("working", "Working"), c("sleeping", "Sleeping"), c("play", "Kids' play"),
      ],
    },
    core: true,
    from: ["intake.room", "scan.items", "scan.lifestyle"],
    known: (k) => {
      const room = (k.intake?.room ?? "").toLowerCase();
      const uses = new Set<string>();
      // the evidence, named: did the room's name count, which pieces, which scan hints
      let named = false;
      const found = new Set<string>();
      const hints: string[] = [];
      const by = (re: RegExp | null, ...cats: RoomItem["category"][]) => {
        const hit = !!re?.test(room);
        named ||= hit;
        // pieces marked to remove say what the room did, not what it's for
        const seen = stayingItems(k).filter((i) => cats.includes(i.category)).map((i) => ITEM_WORDS[i.category]!);
        seen.forEach((w) => found.add(w));
        return hit || seen.length > 0;
      };
      if (by(/living|lounge|family/, "sofa", "sectional")) uses.add("relax");
      if (by(null, "tv")) uses.add("tv");
      const readHints = k.scan?.profile_signals.lifestyle.filter((l) => /read|book/i.test(l)) ?? [];
      if (by(null, "bookshelf") || readHints.length) {
        uses.add("reading");
        if (!stayingItems(k).some((i) => i.category === "bookshelf")) hints.push(...readHints);
      }
      if (by(/dining/, "dining_table")) uses.add("eating");
      if (by(/office|study/, "desk", "office_chair")) uses.add("working");
      if (by(/bed/, "bed")) uses.add("sleeping");
      const because = [
        named ? capital(k.intake!.room!) : "",
        found.size ? `the scan found ${listed([...found])}` : "",
        hints.length ? `the scan read you as ${quoted(hints)}` : "",
      ].filter(Boolean).join("; ");
      return uses.size ? { prefill: [...uses], because: capital(because) } : null;
    },
    feeds: "space.uses",
    why: "The room's jobs decide the furniture list before style comes into it.",
  },
  {
    id: "priorities",
    stage: "functional",
    // works for a fresh start too: there's no "now" to improve on yet
    prompt: "What does this room most need to get right?",
    kind: {
      type: "multi",
      choices: [
        c("storage", "More storage"), c("seating", "More seating"), c("light", "Better light"), c("layout", "A better layout"),
        c("calm", "Feel calmer"), c("finished", "Feel finished"),
      ],
    },
    core: false,
    from: ["sort.counts"],
    known: (k) => (k.sort?.move ? { prefill: ["layout"], because: `Marked ${plural(k.sort.move, "piece")} to move` } : null),
    feeds: "space.priorities",
    why: "Names the problem to solve, so the plan fixes it rather than only restyling it.",
  },

  // 3. Functional branches
  {
    id: "kids",
    stage: "functional_branch",
    prompt: "Are there kids at home, or kids who visit a lot?",
    kind: { type: "single", choices: [c("home", "Yes, at home"), c("visit", "They visit"), c("no", "No")] },
    // core: a safety call (glass, corners, grabbing height), not a nice-to-know
    core: true,
    from: ["answers"],
    known: (k) => (has(k, "uses", "play") ? { prefill: "home", because: 'Said the room is used for "Kids\' play"' } : null),
    feeds: "household.kids",
    why: "Kids change materials, sharp corners and what sits at grabbing height.",
  },
  {
    id: "kid_ages",
    stage: "functional_branch",
    prompt: "How old are they?",
    kind: { type: "multi", choices: [c("under3", "Under 3"), c("3to7", "3 to 7"), c("8to12", "8 to 12"), c("teen", "Teenagers")] },
    // a branch inside the kids slot, so it only joins the core path when there are kids
    core: true,
    showIf: (k) => has(k, "kids", "home") || has(k, "kids", "visit"),
    from: [],
    feeds: "household.kid_ages",
    why: "A toddler and a teenager need opposite things from the same room.",
  },
  {
    id: "pets",
    stage: "functional_branch",
    prompt: "Any pets?",
    kind: { type: "multi", choices: [c("dog", "A dog"), c("cat", "A cat"), c("other", "Something else"), c("none", "No pets", true)] },
    core: false,
    from: [],
    feeds: "household.pets",
    why: "Fur, claws and muddy paws rule out some fabrics and rugs.",
  },
  {
    id: "pets_on_furniture",
    stage: "functional_branch",
    prompt: "Are they allowed on the sofa?",
    kind: { type: "single", choices: [c("yes", "Yes, it's theirs too"), c("no", "No")] },
    core: false,
    showIf: (k) => has(k, "pets", "dog") || has(k, "pets", "cat"),
    from: [],
    feeds: "household.pets_on_furniture",
    why: "Decides between performance fabric and anything delicate like velvet or bouclé.",
  },
  {
    id: "work_from_home",
    stage: "functional_branch",
    prompt: "How often do you work from this room?",
    kind: { type: "single", choices: [c("daily", "Most days"), c("sometimes", "Sometimes"), c("no", "Never")] },
    core: false,
    from: ["answers", "scan.items"],
    known: (k) => {
      // a desk or "Working" says they work here, not how often: ask, with nothing chosen
      if (scanHas(k, "desk", "office_chair") || has(k, "uses", "working")) return null;
      // resting on uses they haven't confirmed, it's only a guess too
      if (k.guessed?.includes("uses")) return { prefill: "no", because: "Working isn't among the uses guessed from the room" };
      if (k.answers.uses !== undefined) return { skip: "no", because: "Didn't list working as a use for this room" };
      return null;
    },
    feeds: "work.from_home",
    why: "A desk that has to disappear at 6pm is a different piece from a home office.",
  },
  {
    id: "video_calls",
    stage: "functional_branch",
    prompt: "Do you take video calls in here?",
    kind: { type: "single", choices: [c("yes", "Yes"), c("no", "No")] },
    core: false,
    showIf: (k) => has(k, "work_from_home", "daily") || has(k, "work_from_home", "sometimes"),
    from: [],
    feeds: "work.calls",
    why: "Then the wall behind you and the light on your face matter.",
  },

  // 4. Lifestyle
  {
    id: "hosting",
    stage: "lifestyle",
    prompt: "How often do people come over?",
    kind: { type: "single", choices: [c("weekly", "Every week or so"), c("sometimes", "Now and then"), c("rarely", "Rarely")] },
    core: false,
    // no prefill: a ticked box says they host, not how often
    showIf: (k) => k.answers.uses === undefined || has(k, "uses", "hosting"),
    from: ["answers"],
    feeds: "lifestyle.hosting",
    why: "Frequent hosts need flexible seating and surfaces; others can give that space to comfort.",
  },
  {
    id: "hosting_style",
    stage: "lifestyle",
    prompt: "When friends come over, is it dinner around a table, or everyone piled on the sofa?",
    kind: { type: "single", choices: [c("table", "Dinner at a table"), c("sofa", "On the sofa"), c("both", "A bit of both")] },
    core: false,
    showIf: (k) => has(k, "hosting", "weekly") || has(k, "hosting", "sometimes"),
    from: [],
    feeds: "lifestyle.hosting_style",
    why: "Decides whether the money goes to a table or to the seating.",
  },
  {
    id: "unwind",
    stage: "lifestyle",
    // reading and TV are already covered by uses, so this only asks what's left
    prompt: "What else helps you unwind in here?",
    kind: {
      type: "multi",
      choices: [c("music", "Music"), c("games", "Games"), c("plants", "Pottering with plants"), c("quiet", "Just quiet")],
    },
    core: false,
    // no prefill: a plant in the scan or a lifestyle hint is inferred from photos, not said by them
    from: [],
    feeds: "lifestyle.unwind",
    why: "A reading corner, a movie setup and a plant shelf each want a different spot by the light.",
  },
  {
    id: "routine",
    stage: "lifestyle",
    prompt: "Walk me through a normal day in this room, from morning to night.",
    kind: { type: "text", placeholder: "Coffee by the window, then…" },
    core: false,
    from: [],
    feeds: "lifestyle.routine",
    why: "Routines surface needs no checklist catches, like where the bag lands at the door.",
  },

  // 5. Broad style
  {
    id: "look",
    stage: "style_broad",
    // Voice: show the looks as pictures, or speak at most four of them, never all eight
    prompt: "Which of these feels most like home to you?",
    kind: { type: "single", choices: LOOKS },
    core: true,
    from: ["scan.style"],
    known: (k) => {
      const look = scanLook(k);
      // a prefill, not a skip: what they own isn't always what they love
      return look ? { prefill: look, because: `The scan read the room as ${quoted(k.scan!.profile_signals.style)}` } : null;
    },
    feeds: "style.look",
    why: "One answer that steers every product pick after it.",
  },
  {
    id: "color",
    stage: "style_broad",
    prompt: "Do you like your rooms calm and light, warm and earthy, or bold with color?",
    kind: { type: "single", choices: [c("light", "Calm and light"), c("warm", "Warm and earthy"), c("bold", "Bold with color")] },
    core: false,
    from: ["scan.style", "answers"],
    known: (k) => {
      // a look they picked over the scan's overrules the scan's colors too: go by their look
      const look = k.answers.look;
      const scan = scanLook(k);
      if (typeof look === "string" && look !== "unsure" && look !== scan && !k.guessed?.includes("look")) {
        const v = LOOK_COLOR[look];
        const name = LOOKS.find((l) => l.id === look)?.label ?? look;
        const over = scan ? ` over the scan's ${quoted(k.scan!.profile_signals.style)}` : "";
        return v ? { prefill: v, because: `Picked "${name}"${over}, a look that usually runs ${v === "bold" ? "bold" : v === "light" ? "calm and light" : "warm and earthy"}` } : null;
      }
      const s = styleText(k);
      const v = /bold|colou?rful|maximal|jewel/.test(s) ? "bold" : /warm|earthy|terracotta/.test(s) ? "warm" : /light|airy|bright|scandi/.test(s) ? "light" : null;
      return v ? { prefill: v, because: `The scan read the room as ${quoted(k.scan!.profile_signals.style)}` } : null;
    },
    feeds: "style.color",
    why: "Palette is the fastest way to make new pieces feel like they belong with old ones.",
  },
  {
    id: "pattern",
    stage: "style_broad",
    prompt: "How do you feel about pattern?",
    kind: { type: "single", choices: [c("love", "Love it"), c("little", "A little goes a long way"), c("plain", "Keep it plain")] },
    core: false,
    from: [],
    feeds: "style.pattern",
    why: "Rugs, pillows and curtains are where pattern lives, and they're easy to get wrong.",
  },
  {
    id: "materials",
    stage: "style_broad",
    prompt: "Which materials do you love having around?",
    kind: {
      type: "multi",
      choices: [
        c("pale_wood", "Pale wood"), c("warm_wood", "Warm, dark wood"), c("linen", "Linen and cotton"), c("velvet", "Velvet"),
        c("boucle", "Bouclé"), c("leather", "Leather"), c("brass", "Brass"), c("black_metal", "Black metal"),
        c("stone", "Stone and marble"), c("rattan", "Rattan and cane"), c("ceramic", "Ceramic"), c("glass", "Glass"),
      ],
    },
    core: false,
    from: ["scan.items", "sort.counts"],
    known: (k) => {
      // owning something isn't loving it (see look), so only pieces they tapped to keep,
      // and only the few materials that show up most among them
      const counts = new Map<string, number>();
      const pieces = new Map<string, string[]>();
      for (const i of tappedKeptItems(k))
        for (const m of new Set([i.primary_material, i.secondary_material])) {
          const id = MATERIAL_CHOICE[m];
          if (!id) continue;
          counts.set(id, (counts.get(id) ?? 0) + 1);
          pieces.set(id, [...(pieces.get(id) ?? []), i.name]);
        }
      const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
      const named = [...new Set(top.flatMap((id) => pieces.get(id)!))];
      return top.length ? { prefill: top, because: `The most common materials in the pieces you kept or moved: ${listed(named)}` } : null;
    },
    feeds: "style.materials",
    why: "New pieces should echo the materials of what stays.",
  },
  {
    id: "avoid",
    stage: "style_broad",
    prompt: "Is there anything you never want to see in your home?",
    kind: { type: "text", placeholder: "Glass tables, anything grey…" },
    core: false,
    from: [],
    feeds: "style.avoid",
    why: "One hard no saves a dozen wrong suggestions.",
  },

  // 6. Specific style: one follow-up per look, plus two that branch off color and the sort
  ...(
    [
      ["midcentury", "Are you drawn to the clean original sixties pieces, or a softer, newer take on them?", [c("original", "The originals"), c("softer", "A softer take")]],
      ["scandi", "Cozy and layered like a Copenhagen flat, or pared back and airy?", [c("cozy", "Cozy and layered"), c("airy", "Pared back and airy")]],
      ["minimal", "Warm minimal, with wood and texture, or crisp and gallery-like?", [c("warm", "Warm minimal"), c("crisp", "Crisp")]],
      ["eclectic", "Should it look collected over years, or curated and bold?", [c("collected", "Collected over years"), c("curated", "Curated and bold")]],
      ["traditional", "Classic and polished, or relaxed and a bit worn in?", [c("polished", "Polished"), c("relaxed", "Relaxed")]],
      ["organic", "Earthy and handmade, or calm and spa-like?", [c("handmade", "Earthy and handmade"), c("spa", "Calm and spa-like")]],
      ["industrial", "Raw, with brick and metal, or softened with warm textiles?", [c("raw", "Raw"), c("softened", "Softened")]],
    ] as [string, string, Choice[]][]
  ).map(([look, prompt, choices]): Question => ({
    id: `look_${look}`,
    stage: "style_specific",
    prompt,
    kind: { type: "single", choices },
    core: false,
    showIf: (k) => has(k, "look", look),
    from: ["answers"],
    feeds: "style.look_detail",
    why: "Splits the look in two, because the two halves shop very differently.",
  })),
  {
    id: "inspiration",
    stage: "style_specific",
    prompt: "Is there a place that felt exactly right to you? A hotel, a café, a friend's home?",
    kind: { type: "text", placeholder: "That little hotel in Lisbon…" },
    core: false,
    showIf: (k) => has(k, "look", "unsure"),
    from: ["answers"],
    feeds: "style.inspiration",
    why: "People who can't name a style can almost always name a place.",
  },
  {
    id: "bold_colors",
    stage: "style_specific",
    prompt: "Which colors pull you in?",
    kind: {
      type: "multi",
      choices: [c("green", "Greens"), c("blue", "Blues"), c("terracotta", "Terracotta and rust"), c("ochre", "Mustard and ochre"), c("pink", "Pinks"), c("jewel", "Deep jewel tones")],
    },
    core: false,
    showIf: (k) => has(k, "color", "bold"),
    from: [],
    feeds: "style.bold_colors",
    why: "Bold only works if it's the right bold.",
  },
  // One question for the hero piece and the piece with a story: we already know the list, so it's a pick
  {
    id: "anchor",
    stage: "style_specific",
    prompt: "Is there one piece everything else should work around? Maybe one with a story behind it?",
    kind: { type: "single", choices: [c("none", "Nothing in particular")] },
    choicesFrom: (k) => [
      ...stayingItems(k).map((i) => c(i.id, i.name)),
      ...(k.intake?.bringing === "yes" ? (k.intake.brought ?? []).map((b, n) => c(`brought_${n}`, b)) : []),
    ],
    core: false,
    showIf: (k) => stayingItems(k).length > 0 || (k.intake?.bringing === "yes" && (k.intake.brought?.length ?? 0) > 0),
    from: ["scan.items", "sort.counts", "intake.bringing"],
    feeds: "style.anchor_piece",
    why: "Designers start from one hero piece, often the one someone carried from home to home; this names it instead of guessing.",
  },

  // 7. Personal story: woven in subtly, never a theme
  {
    id: "places",
    stage: "story",
    prompt: "Where have you lived, or where are you from, that still feels like home?",
    kind: { type: "text", placeholder: "Grew up in Pune, five years in Copenhagen…" },
    core: false,
    from: [],
    feeds: "story.places",
    why: "Where someone's from shapes what feels like home, like Indian textiles or Copenhagen candlelight.",
  },
  {
    id: "places_feel",
    stage: "story",
    prompt: "What did you love about how homes felt there?",
    kind: { type: "text", placeholder: "The colors, the light, the brass…" },
    core: false,
    showIf: (k) => typeof k.answers.places === "string" && k.answers.places.trim() !== "",
    from: ["answers"],
    feeds: "story.places_feel",
    why: "Turns a place into something we can buy: a color, a material, a kind of light.",
  },
  {
    id: "meaningful_detail",
    stage: "story",
    prompt: "Is there something small that means a lot to you, a person, a place, a thing, that we could quietly nod to?",
    kind: { type: "text", placeholder: "My grandmother loved butterflies" },
    core: false,
    from: [],
    feeds: "story.meaningful_detail",
    // used once, as one small considered nod, never as a theme
    why: "One small personal touch is what makes a room feel like theirs and not a showroom.",
  },
];

export const CORE = QUESTIONS.filter((q) => q.core);

export type Step =
  | { id: string; status: "ask" }
  | { id: string; status: "prefill" | "skip"; value: Answer; because: string; on?: string }
  | { id: string; status: "hidden" };

// Walks the tree in order against what's known. Prefills are treated as
// confirmed so later branches see them, which is how the conversation will
// read once someone says "yes, that's right".
export function walk(known: Known, depth: "core" | "all" = "core"): Step[] {
  const k: Known = { ...known, answers: { ...known.answers }, guessed: [...(known.guessed ?? [])] };
  return QUESTIONS.filter((q) => depth === "all" || q.core).map((q): Step => {
    if (q.showIf && !q.showIf(k)) return { id: q.id, status: "hidden" };
    if (k.answers[q.id] !== undefined) return { id: q.id, status: "skip", value: k.answers[q.id], because: "Already answered" };
    const r = q.known?.(k);
    if (!r) return { id: q.id, status: "ask" };
    const value = "skip" in r ? r.skip : r.prefill;
    k.answers[q.id] = value;
    if ("prefill" in r) k.guessed!.push(q.id);
    return { id: q.id, status: "skip" in r ? "skip" : "prefill", value, because: r.because, on: r.on };
  });
}
