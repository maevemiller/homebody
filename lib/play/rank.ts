import type { TasteState } from "@/lib/taste/visual";
import { distance, harmonize, isNeutral, wadaMatches } from "@/lib/design/color";
import { fitScore, hasTaste, type Product } from "./catalog";
import { prefScore, shoppingScore, type BriefRead, type Prefs } from "./prefs";

// One score for "how right is this product for her, in this room": the visual picks (fitScore), her likes,
// dislikes and swipes (prefs), how she shops (brief.shopping), and color: whether it sits in a Wada Sanzō
// combination with the room's anchor colors (the kept sofa, the rug, the walls).

export interface RankCtx {
  taste?: TasteState;
  prefs: Prefs;
  brief: BriefRead;
  // colors already fixed in the room: kept large pieces first
  anchors: string[];
  // materials the brief rules out
  never: string[];
}

const anchorCache = new Map<string, string[]>();
/** Wada companions of an anchor color: colors proven to go with it. */
function companions(anchor: string, palette?: string[]) {
  const k = `${anchor}|${palette?.join(",") ?? ""}`;
  if (!anchorCache.has(k)) anchorCache.set(k, wadaMatches(anchor, { limit: 6, palette }).flatMap((m) => m.companions.map((c) => c.hex)));
  return anchorCache.get(k)!;
}

export function colorScore(p: Product, anchors: string[]): number {
  if (!anchors.length) return 0;
  if (isNeutral(p.color)) return 0.4;
  let s = 0;
  const loud = anchors.filter((a) => !isNeutral(a));
  for (const a of loud.slice(0, 2)) s += harmonize(p.color, a).ok ? 0.6 : -0.8;
  for (const a of anchors.slice(0, 2)) if (companions(a).some((c) => distance(c, p.color) < 12)) s += 1;
  return s;
}

export function rank(p: Product, ctx: RankCtx): number {
  if (ctx.never.includes(p.material) || ctx.prefs.disliked.includes(p.id)) return -100;
  const taste = hasTaste(ctx.taste) ? fitScore(p, ctx.taste) : 0;
  return taste + prefScore(p, ctx.prefs) + shoppingScore(p, ctx.brief.shopping) + colorScore(p, ctx.anchors);
}

/** What made it rank well, in a few words for its reason line. */
export function rankReason(p: Product, ctx: RankCtx): string | null {
  const t = ctx.taste;
  if (ctx.prefs.liked.includes(p.id)) return "you liked it";
  if (t?.materials.liked.includes(p.material)) return `${p.material.replace(/_/g, " ")}, which you picked`;
  if ((ctx.prefs.material[p.material] ?? 0) > 0.5) return `${p.material.replace(/_/g, " ")}, which you've liked`;
  const brands = ctx.brief.shopping?.brands ?? [];
  if (p.real && brands.some((b) => p.real!.brand.toLowerCase().includes(b.toLowerCase()))) return `${p.real.brand}, a brand you named`;
  if (ctx.anchors.length && !isNeutral(p.color) && colorScore(p, ctx.anchors) > 0.9) return "its color sits in a Wada Sanzō combination with your room";
  if (t && p.palettes.some((id) => t.palettes.liked.includes(id))) return "in a palette you picked";
  return null;
}
