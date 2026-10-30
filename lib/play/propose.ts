import type { Answer } from "@/lib/taste/questions";
import { shoppingOf } from "@/lib/taste/shopping";
import type { TasteState } from "@/lib/taste/visual";
import { PRODUCTS, fitScore, hasTaste, isBasics, twinOf, type Kind, type Product } from "./catalog";

// The room furnished from the brief (Maeve, 2026-10-30: "pieces are added automatically as a proposed
// design, not a catalog to add from"). What a living room needs that the room doesn't already have, in the
// order a designer places it (seating first, then what relates to it), each the best fit for her taste,
// at the price her budget and her way of shopping point to. Placement is lib/play/placement.ts's job.

export interface Brief {
  taste?: TasteState;
  answers: Record<string, Answer>;
  // her budget in dollars, when she gave a figure
  cap?: number;
}

// a living room's essentials, in placing order; chair, shelf and art only when the brief calls for them
const ORDER: Kind[] = ["sofa", "table", "rug", "chair", "lamp", "shelf", "art"];

const listOf = (v: Answer | undefined) => (Array.isArray(v) ? v : typeof v === "string" ? [v] : []);

/** Her budget as a figure from the page's practical lines ("budget: about $4,000", "$3–4k"): the top of a range. */
export function budgetCap(lines: string[]): number | undefined {
  for (const t of lines) {
    if (!/budget|\$|k\b/i.test(t)) continue;
    const nums = [...t.matchAll(/\$?\s?(\d[\d,.]*)\s?(k|grand|thousand)?/gi)].map((m) => parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1)).filter((n) => n >= 100);
    if (nums.length) return Math.max(...nums);
  }
  return undefined;
}

/** The kinds this room still needs, given the kinds of pieces already standing in it. */
export function needs(have: Kind[], answers: Record<string, Answer>): Kind[] {
  const uses = listOf(answers.uses);
  const people = typeof answers.people === "number" ? answers.people : 2;
  const want = new Set<Kind>(["sofa", "table", "rug", "lamp", "art"]);
  if (people >= 2 || uses.includes("reading") || uses.includes("hosting")) want.add("chair");
  if (uses.includes("reading")) want.add("shelf");
  return ORDER.filter((k) => want.has(k) && !have.includes(k));
}

/** One product per needed kind: best taste fit, then the lookalike or the original as her money and shopping say. */
export function propose(have: Kind[], brief: Brief): Product[] {
  const { taste, answers, cap } = brief;
  const shop = shoppingOf(answers)?.channels ?? [];
  // lean, thrift and in-stock shoppers start on the lookalike; designer shoppers and investors on the original
  const save = answers.budget === "lean" || shop.some((c) => c === "secondhand" || c === "affordable");
  const spend = answers.budget === "invest" || shop.includes("designer");
  const fit = (p: Product) => (hasTaste(taste) ? fitScore(p, taste) : 0);
  const out: Product[] = [];
  for (const kind of needs(have, answers)) {
    const pool = PRODUCTS.filter((p) => p.category === kind && (kind !== "table" || !/side/i.test(p.name)));
    const best = [...pool].sort((a, b) => fit(b) - fit(a) || (save ? a.price - b.price : spend ? b.price - a.price : a.price - b.price))[0];
    if (!best) continue;
    const twin = twinOf(best);
    out.push(twin && ((save && !isBasics(best)) || (spend && isBasics(best))) ? twin : best);
  }
  // over her figure: the most expensive pieces step down to their lookalikes until it fits
  if (cap) {
    const total = () => out.reduce((n, p) => n + p.price, 0);
    for (const p of [...out].sort((a, b) => b.price - a.price)) {
      if (total() <= cap) break;
      const twin = twinOf(p);
      if (twin && twin.price < p.price) out[out.indexOf(p)] = twin;
    }
  }
  return out;
}
