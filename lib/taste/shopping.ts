import type { Answer } from "./questions";

// How she likes to shop (Maeve, 2026-10-30: "what kind of shopper are you… it shapes which brands to build
// from"). The tree's shop and brands answers, as the structured preference sourcing reads: Plug & Play
// ranks real products by it, and the brief carries it as one Sourcing line plus the decisions it drives.

export const CHANNELS = ["secondhand", "vintage", "affordable", "mid", "designer", "makers"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface Shopping {
  channels: Channel[];
  // shops and makers she named, in her words
  brands: string[];
}

const SAID: Record<Channel, string> = {
  secondhand: "secondhand",
  vintage: "vintage",
  affordable: "affordable in-stock shops",
  mid: "mid-range shops",
  designer: "designer pieces",
  makers: "small makers",
};

// Shops and sites people name in passing, as they're written
const KNOWN_SHOPS: [string, RegExp][] = [
  ["Facebook Marketplace", /\b(facebook|fb) marketplace\b|\bmarketplace\b/i], ["Craigslist", /\bcraigslist\b/i], ["eBay", /\bebay\b/i],
  ["Chairish", /\bchairish\b/i], ["1stDibs", /\b1st ?dibs\b/i], ["Etsy", /\betsy\b/i], ["IKEA", /\bikea\b/i], ["Target", /\btarget\b/i],
  ["Wayfair", /\bwayfair\b/i], ["West Elm", /\bwest elm\b/i], ["Article", /\barticle\b/i], ["CB2", /\bcb2\b/i],
  ["Crate & Barrel", /\bcrate (and|&) barrel\b/i], ["Pottery Barn", /\bpottery barn\b/i], ["Anthropologie", /\banthropologie\b/i],
  ["Design Within Reach", /\b(design within reach|dwr)\b/i], ["RH", /\b(rh|restoration hardware)\b/i], ["Goodwill", /\bgoodwill\b/i],
];

/** The shops she named in a reply, in their usual spelling. */
export const shopsNamed = (text: string): string[] => KNOWN_SHOPS.filter(([, re]) => re.test(text)).map(([name]) => name);

export function shoppingOf(a: Record<string, Answer>): Shopping | null {
  const channels = (Array.isArray(a.shop) ? a.shop : typeof a.shop === "string" ? [a.shop] : []).filter((c): c is Channel => (CHANNELS as readonly string[]).includes(c));
  const brands = typeof a.brands === "string" ? a.brands.split(/,|;|\band\b|\//).map((b) => b.trim().replace(/[.!]+$/, "")).filter((b) => b && !/^(no|none|nothing|not really)$/i.test(b)) : [];
  return channels.length || brands.length ? { channels, brands } : null;
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** The brief's Sourcing line, or "" when she hasn't said. */
export function sourcingLine(a: Record<string, Answer>): string {
  const s = shoppingOf(a);
  if (!s) return "";
  const how = s.channels.map((c) => SAID[c]);
  return `Sourcing: ${[how.length ? list(how) : "", s.brands.length ? `starting with ${list(s.brands.slice(0, 4))}` : ""].filter(Boolean).join("; ")}`;
}

/** What a designer does with it: where the money goes and what it costs in time. */
export function sourcingDecisions(a: Record<string, Answer>, inAHurry: boolean): { decision: string; because: string }[] {
  const s = shoppingOf(a);
  if (!s) return [];
  const has = (c: Channel) => s.channels.includes(c);
  const out: { decision: string; because: string }[] = [];
  if (has("secondhand") || has("vintage"))
    out.push({
      decision: "Case goods, lighting and art secondhand or vintage; the sofa and anything upholstered new or reupholstered",
      because: has("vintage") ? "loves vintage and antiques" : "shops thrift and secondhand",
    });
  if (has("makers") && !inAHurry) out.push({ decision: "One made-to-order piece as the anchor, ordered first (about 8–16 weeks)", because: "loves small makers" });
  if (has("designer") && (has("affordable") || has("mid") || has("secondhand")))
    out.push({ decision: "Splurge on the one piece touched daily (the sofa or the rug); save on case goods and accessories", because: "mixes designer pieces with everyday finds" });
  return out;
}
