import type { Answer } from "@/lib/taste/questions";
import { shoppingOf } from "@/lib/taste/shopping";
import { MATERIAL, type TasteState } from "@/lib/taste/visual";
import { PRODUCTS, fitScore, hasTaste, isBasics, twinOf, type Kind, type Product } from "./catalog";

// The room furnished from the brief (Maeve, 2026-10-30: "pieces are added automatically as a proposed
// design, not a catalog to add from"). What a living room needs that the room doesn't already have, in the
// order a designer places it (seating first, then what relates to it), each the best fit for her taste at
// the price her budget and her way of shopping point to, and never against the brief she confirmed: no
// bouclé or loose linen where a pet sits, nothing she marked a never. Each pick carries its reason, in
// craft-standards.md terms. Placement is lib/play/placement.ts's job.

export interface Brief {
  taste?: TasteState;
  answers: Record<string, Answer>;
  // her budget in dollars, when she gave a figure
  cap?: number;
  // what she said, for the pet and the way she uses the room
  said?: string;
}

export interface Pick {
  product: Product;
  // why this piece, for her: the room's need and the brief's facts behind it
  reason: string;
  // a stand-in for something to find secondhand or vintage, with what to look for
  hunt?: string;
}

// a living room's essentials, in placing order; chair, shelf and art only when the brief calls for them
const ORDER: Kind[] = ["sofa", "table", "rug", "chair", "lamp", "shelf", "art"];
const CASE_GOODS: Kind[] = ["table", "shelf", "lamp", "art"];

const listOf = (v: Answer | undefined) => (Array.isArray(v) ? v : typeof v === "string" ? [v] : []);
const matName = (id: string) => (MATERIAL.get(id)?.label ?? id.replace(/_/g, " ")).toLowerCase();
const inches = (m: number) => Math.round((m * 39.37) / 2) * 2;

/** Her budget as a figure from the page's practical lines ("budget: about $4,000", "$3–4k"): the top of a range. */
export function budgetCap(lines: string[]): number | undefined {
  for (const t of lines) {
    if (!/budget|\$|k\b/i.test(t)) continue;
    const nums = [...t.matchAll(/\$?\s?(\d[\d,.]*)\s?(k|grand|thousand)?/gi)].map((m) => parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1)).filter((n) => n >= 100);
    if (nums.length) return Math.max(...nums);
  }
  return undefined;
}

/** The pet that sits on the furniture, if the brief has one. */
export function petOf(answers: Record<string, Answer>, said = ""): "cat" | "dog" | null {
  const pets = listOf(answers.pets);
  if (pets.includes("cat") || /\b(cat|kitten)s?\b/i.test(said)) return "cat";
  if (pets.includes("dog") || /\b(dog|puppy|greyhound|retriever|terrier|spaniel|labrador|collie|poodle|doodle)s?\b/i.test(said)) return "dog";
  return null;
}

/** The kinds this room still needs, given the kinds of pieces already standing in it. */
export function needs(have: Kind[], answers: Record<string, Answer>, said = ""): Kind[] {
  const uses = listOf(answers.uses);
  const people = typeof answers.people === "number" ? answers.people : 2;
  const reads = uses.includes("reading") || /\bread(ing)?\b|\bbooks?\b/i.test(said);
  const want = new Set<Kind>(["sofa", "table", "rug", "lamp", "art"]);
  if (people >= 2 || reads || uses.includes("hosting")) want.add("chair");
  if (reads) want.add("shelf");
  return ORDER.filter((k) => want.has(k) && !have.includes(k));
}

/** One pick per needed kind, with its reason. */
export function propose(have: Kind[], brief: Brief): Pick[] {
  const { taste, answers, cap, said = "" } = brief;
  const shop = shoppingOf(answers)?.channels ?? [];
  const pet = petOf(answers, said);
  // lean, thrift and in-stock shoppers start on the lookalike; designer shoppers and investors on the original
  const save = answers.budget === "lean" || shop.some((c) => c === "secondhand" || c === "affordable");
  const spend = answers.budget === "invest" || shop.includes("designer");
  const hunts = shop.includes("secondhand") || shop.includes("vintage");
  const fit = (p: Product) => (hasTaste(taste) ? fitScore(p, taste) : 0);
  const never = new Set(taste?.materials.never ?? []);
  // claws and paws: no bouclé or loose linen to pull, no velvet to hold hair
  const petSafe = (p: Product) => !pet || !(["sofa", "chair"].includes(p.category) && ["boucle", "linen", "velvet"].includes(p.material));
  const ok = (p: Product) => petSafe(p) && !never.has(p.material);
  const people = typeof answers.people === "number" ? answers.people : null;

  const picks: Pick[] = [];
  const sofa = () => picks.find((x) => x.product.category === "sofa")?.product;
  for (const kind of needs(have, answers, said)) {
    const pool = PRODUCTS.filter((p) => p.category === kind && ok(p));
    const best = [...pool].sort((a, b) => fit(b) - fit(a) || (spend ? b.price - a.price : a.price - b.price))[0];
    if (!best) continue;
    const twin = twinOf(best);
    const product = twin && ok(twin) && ((save && !isBasics(best)) || (spend && isBasics(best))) ? twin : best;
    picks.push({ product, reason: reasonFor(product, { taste, pet, people, sofa: sofa(), lookalike: product !== best ? best : undefined }) });
  }
  // over her figure: the most expensive pieces step down to their lookalikes until it fits
  if (cap) {
    const total = () => picks.reduce((n, x) => n + x.product.price, 0);
    for (const x of [...picks].sort((a, b) => b.product.price - a.product.price)) {
      if (total() <= cap) break;
      const twin = twinOf(x.product);
      if (twin && twin.price < x.product.price && ok(twin)) {
        const i = picks.indexOf(x);
        picks[i] = { product: twin, reason: reasonFor(twin, { taste, pet, people, sofa: sofa(), lookalike: x.product }) };
      }
    }
  }
  // a secondhand shopper finds case goods, lighting and art: the piece in the room is a stand-in for the hunt
  if (hunts)
    for (const x of picks)
      if (CASE_GOODS.includes(x.product.category)) x.hunt = huntFor(x.product, shop.includes("vintage") && !shop.includes("secondhand") ? "vintage" : "secondhand");
  return picks;
}

interface Why {
  taste?: TasteState;
  pet: "cat" | "dog" | null;
  people: number | null;
  sofa?: Product;
  // the original, when this is its lookalike
  lookalike?: Product;
}

// The craft reason first (what it does in the room), then the brief's fact (her pick, her pet, her money)
function reasonFor(p: Product, w: Why): string {
  // a lookalike borrows its original's material: "the oak look" when its name says it is ash
  const liked = (w.taste?.materials.liked ?? []).filter((m) => m === p.material || m === p.accentMaterial).map(matName)
    .map((m) => (new RegExp(m.split(" ").pop() ?? m, "i").test(p.name) ? m : `${m} look`));
  const yours = liked.length ? `${liked.join(" and ")}, as you picked` : "";
  const less = w.lookalike ? `the look of the ${w.lookalike.name.replace(/,.*$/, "")} for ${money(w.lookalike.price - p.price)} less` : "";
  const parts: string[] = [];
  switch (p.category) {
    case "sofa":
      parts.push(`${inches(p.w)}" facing the focal point; seats ${Math.max(2, Math.floor(p.w / 0.66))}`);
      if (w.pet) parts.push(petNote(p, w.pet));
      break;
    case "table": {
      const two = w.sofa ? `about two thirds of the sofa's ${inches(w.sofa.w)}"` : "sized to the seating";
      parts.push(`${inches(p.w)}" long, ${two}, 14–18" in front of it`);
      break;
    }
    case "rug":
      parts.push("under the front legs of the seating, 18\" of floor kept at the walls");
      break;
    case "chair":
      parts.push("a second seat angled to the sofa, within talking distance");
      break;
    case "lamp":
      parts.push("beside the seating with a warm 2700K bulb: the low light for evenings");
      break;
    case "shelf":
      parts.push("for the books, backed against a wall and clear of the window");
      break;
    case "art":
      parts.push("one piece, hung with its center at about 57\"");
      break;
  }
  return [...parts, yours, less].filter(Boolean).join("; ");
}

// honest about what a pet does to it: no fabric is claw-proof
function petNote(p: Product, pet: "cat" | "dog"): string {
  if (p.material === "leather") {
    const faux = /faux/i.test(p.name);
    const what = faux ? "faux leather" : "leather";
    return pet === "cat"
      ? `${what}: no loops for claws to catch and hair wipes off; ${faux ? "claws will mark it" : "it will scratch, and on leather that wears in"}`
      : `${what}: hair wipes off and it cleans up after the dog`;
  }
  return pet === "cat" ? `${matName(p.material)}, a close weave with no loops to catch` : `${matName(p.material)}, a close weave that brushes clean after the dog`;
}

function huntFor(p: Product, where: "secondhand" | "vintage"): string {
  const what = p.category === "table" ? `${/oval/i.test(p.name) ? "an oval" : "a"} coffee table about ${inches(p.w)}" long` : p.category === "shelf" ? `an open bookcase about ${inches(p.w)}" wide` : p.category === "lamp" ? "a floor lamp" : "art at about this size";
  return `Find ${where}: ${what}, under ${money(Math.ceil((p.price * 0.8) / 10) * 10)}`;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
