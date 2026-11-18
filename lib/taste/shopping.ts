// "What kind of shopper are you?" (Maeve, 2026-10-30: "ask what kind of shopper she is: thrift,
// designer, brands she likes, where she sources things. It shapes which brands to build from.")
// Asked in Extras as one short tap-through sheet (components/taste/ShopperSheet.tsx), stored as structured
// preferences on the taste state, and mapped to sources and channel weights per
// docs/reference/sourcing/README.md §7, so Plug & Play and checkout can rank real products by it.
// Pure data and functions, shared by the page, the live route's prompt and the free interpreter.

export const TIERS = [
  { id: "budget", label: "Budget-friendly", hint: "IKEA, Target" },
  { id: "mid", label: "Mid-market", hint: "West Elm, Article, CB2" },
  { id: "designer", label: "Designer", hint: "investment pieces" },
  { id: "vintage", label: "Thrift and vintage", hint: "one of a kind" },
  { id: "mix", label: "A mix", hint: "high and low" },
] as const;
export type TierId = (typeof TIERS)[number]["id"];

// Channels and the sources each one weights (README §7's table)
export const CHANNELS = [
  { id: "fast", label: "Amazon, delivered fast", sources: ["Amazon", "Walmart", "Target"] },
  { id: "big_box", label: "IKEA and Target", sources: ["Target", "IKEA", "Walmart"] },
  { id: "showroom", label: "West Elm, CB2, Crate & Barrel", sources: ["West Elm", "CB2", "Crate & Barrel"] },
  { id: "dtc", label: "Online brands, like Article or Floyd", sources: ["Article", "Floyd", "Burrow", "Castlery"] },
  { id: "secondhand", label: "Marketplace, eBay and Etsy", sources: ["Etsy", "eBay", "Chairish", "AptDeco", "Facebook Marketplace"] },
  { id: "antiques", label: "Antique shops and auctions", sources: ["1stDibs", "Chairish", "Etsy vintage"] },
  { id: "custom", label: "Made to order", sources: ["Maiden Home", "Joybird", "Interior Define"] },
  { id: "local", label: "Local makers", sources: ["Etsy makers", "local makers"] },
] as const;
export type ChannelId = (typeof CHANNELS)[number]["id"];

export const SECONDHAND = [
  { id: "new", label: "New, mostly" },
  { id: "either", label: "Either, if it's right" },
  { id: "secondhand", label: "Secondhand first" },
] as const;
export type SecondhandId = (typeof SECONDHAND)[number]["id"];

export const SPLURGE = ["Sofa", "Rug", "Lighting", "Art", "Dining table", "Bed", "A statement chair", "Storage"] as const;
export const NO_SPLURGE = "Spread it evenly";

// Brands to tap, a mix of tiers; anything else is typed
export const BRANDS = ["IKEA", "Article", "West Elm", "CB2", "Crate & Barrel", "Pottery Barn", "Anthropologie", "Floyd", "Burrow", "Design Within Reach", "RH", "Etsy"] as const;

export interface Shopping {
  tiers: TierId[];
  channels: ChannelId[];
  secondhand?: SecondhandId;
  splurge: string[];
  brands_like: string[];
  brands_avoid: string[];
  // her typed words, as she wrote them
  said?: string;
  // derived (README §7): channel weights 0–1, the sources they point to in order, and the practical flags
  weights: Partial<Record<ChannelId, number>>;
  sources: string[];
  secondhand_ok: boolean;
  assembly_ok?: boolean;
  lead_time_max_weeks?: number;
}

export interface ShoppingPicks {
  tiers: TierId[];
  channels: ChannelId[];
  secondhand?: SecondhandId;
  splurge: string[];
  brands: string[];
  said: string;
}

// What a tier says about channels, before she names any
const TIER_WEIGHTS: Record<TierId, Partial<Record<ChannelId, number>>> = {
  budget: { big_box: 1, fast: 0.6, secondhand: 0.3 },
  mid: { showroom: 1, dtc: 0.8 },
  designer: { custom: 0.8, showroom: 0.5, antiques: 0.5 },
  vintage: { secondhand: 1, antiques: 0.6, local: 0.3 },
  mix: { showroom: 0.5, dtc: 0.4, big_box: 0.4, secondhand: 0.5 },
};

const NEG = /^\s*(no|not|never|avoid|hate|nothing from|anything but|skip)\b[\s:,-]*/i;

// Her typed line, read for brands: "Article, Muji, no IKEA" → like Article and Muji, avoid IKEA
export function readBrands(said: string): { like: string[]; avoid: string[]; assembly_ok?: boolean } {
  const like: string[] = [];
  const avoid: string[] = [];
  // each comma-separated part is a like or, led by "no"/"never"/"avoid", an avoid for every name in it
  for (const part of said.split(/[,;\n]|\.\s/)) {
    const neg = NEG.test(part);
    for (const raw of part.replace(NEG, "").split(/\band\b|\bor\b|\//i)) {
      const name = raw.trim().replace(/[.!]+$/, "").replace(/^(i (love|like)|love|like)\s+/i, "").trim();
      if (!name || name.split(/\s+/).length > 3 || /\b(assembl|flat.?pack|delivery|white glove|anything|stuff|things)/i.test(name)) continue;
      const brand = BRANDS.find((b) => b.toLowerCase() === name.toLowerCase()) ?? name.replace(/^\w/, (c) => c.toUpperCase());
      (neg ? avoid : like).push(brand);
    }
  }
  const assembly_ok = /\b(hate|no|don'?t|never)\b[^.]*\b(assembl|flat.?pack)|white glove/i.test(said) ? false : undefined;
  return { like, avoid, assembly_ok };
}

export function toShopping(p: ShoppingPicks): Shopping {
  const typed = readBrands(p.said);
  const brands_like = [...new Set([...p.brands, ...typed.like])].filter((b) => !typed.avoid.some((a) => a.toLowerCase() === b.toLowerCase()));
  const brands_avoid = [...new Set(typed.avoid)];
  const weights: Partial<Record<ChannelId, number>> = {};
  const add = (c: ChannelId, w: number) => (weights[c] = Math.min(1, Math.max(weights[c] ?? 0, w)));
  for (const t of p.tiers) for (const [c, w] of Object.entries(TIER_WEIGHTS[t]) as [ChannelId, number][]) add(c, w);
  for (const c of p.channels) add(c, 1);
  if (p.secondhand === "new") {
    delete weights.secondhand;
    delete weights.antiques;
  } else if (p.secondhand === "secondhand") add("secondhand", 1);
  else if (p.secondhand === "either") add("secondhand", 0.5);
  // a brand she avoids drops out of the sources; a brand she loves leads
  const ranked = (Object.entries(weights) as [ChannelId, number][]).sort((a, b) => b[1] - a[1]);
  const off = (s: string) => brands_avoid.some((a) => a.toLowerCase() === s.toLowerCase());
  const sources = [...new Set([...brands_like, ...ranked.flatMap(([c]) => CHANNELS.find((x) => x.id === c)!.sources)])].filter((s) => !off(s));
  return {
    tiers: p.tiers, channels: p.channels, secondhand: p.secondhand,
    splurge: p.splurge.filter((x) => x !== NO_SPLURGE), brands_like, brands_avoid,
    said: p.said.trim() || undefined,
    weights, sources,
    secondhand_ok: p.secondhand !== "new",
    assembly_ok: typed.assembly_ok,
    lead_time_max_weeks: p.channels.includes("custom") ? 16 : undefined,
  };
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const tierLabel = (id: TierId) => TIERS.find((t) => t.id === id)!.label;

// The brief's Sourcing row: where the pieces come from and where the money goes, each line a decision
export function sourcingLines(s: Shopping): string[] {
  const out: string[] = [];
  const tiers = s.tiers.filter((t) => t !== "mix").map((t) => lower(tierLabel(t)));
  const where = s.tiers.includes("mix") ? `A mix of high and low${tiers.length ? `, leaning ${tiers.join(", ")}` : ""}` : tiers.length ? tiers.join(", ").replace(/^\w/, (c) => c.toUpperCase()) : "";
  const from = s.sources.slice(0, 5);
  if (where || from.length) out.push(`${where || "Sources"}${from.length ? `: ${from.join(", ")}` : ""}`);
  if (s.secondhand === "secondhand") out.push("Secondhand first: one-off pieces found as they come up, new only where nothing turns up");
  else if (s.secondhand === "either") out.push("New or secondhand, whichever piece fits best");
  else if (s.secondhand === "new") out.push("New pieces only");
  if (s.splurge.length) out.push(`Splurge on the ${list(s.splurge.map(lower))}; save on the rest`);
  if (s.lead_time_max_weeks) out.push("Made to order is fine: allow 8–16 weeks for those pieces");
  if (s.assembly_ok === false) out.push("Delivered assembled; no flat-pack");
  if (s.brands_avoid.length) out.push(`Never from ${list(s.brands_avoid)}`);
  return out;
}

// One line for the designer (and the hidden profile): what she tapped and typed
export function describeShopping(s: Shopping): string {
  const parts = [
    s.tiers.length ? `kind of shopper: ${s.tiers.map(tierLabel).join(", ").toLowerCase()}` : "",
    s.channels.length ? `shops at: ${s.channels.map((c) => CHANNELS.find((x) => x.id === c)!.label).join("; ")}` : "",
    s.secondhand ? `new or secondhand: ${SECONDHAND.find((x) => x.id === s.secondhand)!.label.toLowerCase()}` : "",
    s.splurge.length ? `would splurge on: ${s.splurge.join(", ").toLowerCase()}` : "",
    s.brands_like.length ? `brands they like: ${s.brands_like.join(", ")}` : "",
    s.brands_avoid.length ? `brands they avoid: ${s.brands_avoid.join(", ")}` : "",
    s.said ? `in their words: "${s.said}"` : "",
  ].filter(Boolean);
  return parts.length ? `Shopping (the page adds the Sourcing row itself): ${parts.join("; ")}` : "Shopping: skipped, nothing recorded";
}

// A short fact for her page while they talk: "vintage and mid-market · splurge: sofa"
export function shoppingFact(s: Shopping): { text: string; because?: string } | null {
  const tiers = s.tiers.map((t) => lower(tierLabel(t)));
  const text = tiers.length ? `shops ${tiers.join(", ")}` : s.channels.length ? `shops ${lower(CHANNELS.find((c) => c.id === s.channels[0])!.label)}` : s.brands_like.length ? `likes ${list(s.brands_like.slice(0, 3))}` : "";
  if (!text) return null;
  return { text, because: s.splurge.length ? `splurge on the ${list(s.splurge.map(lower))}` : undefined };
}
