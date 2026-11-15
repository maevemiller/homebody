import wada from "@/docs/reference/design-principles/data/wada-sanzo-colors.json";

// Color science for the design engine (docs/reference/design-principles/color.md): sRGB → Lab, ΔE2000,
// undertone, LRV and chroma, and Wada Sanzō's 348 combinations looked up by Lab distance from an anchor
// color (§1, "anchor matching"). Pure code, no model calls; the 60 KB data file never goes in a prompt.

export type Lab = [number, number, number];

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** CIE relative luminance Y (0–1) from sRGB. */
export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Light reflectance value, about Y × 100 (color.md §3). */
export const lrv = (hex: string) => Math.round(luminance(hex) * 100);

export function hexToLab(hex: string): Lab {
  const [r, g, b] = hexToRgb(hex).map(lin);
  // sRGB D65 → XYZ, normalised to the D65 white
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToHex([L, a, b]: Lab): string {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883;
  const r = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  const g = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  const bl = 0.0557 * x - 0.204 * y + 1.057 * z;
  const enc = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);
  return rgbToHex(enc(r), enc(g), enc(bl));
}

export const chroma = (lab: Lab) => Math.hypot(lab[1], lab[2]);
export const hueAngle = (lab: Lab) => ((Math.atan2(lab[2], lab[1]) * 180) / Math.PI + 360) % 360;

/** CIEDE2000 color difference. About 2 is just noticeable; ≤ 10 counts as "the same color" for anchor matching. */
export function deltaE(l1: Lab, l2: Lab): number {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (a: number, b: number) => (a === 0 && b === 0 ? 0 : ((Math.atan2(b, a) / rad) + 360) % 360);
  const h1p = h(a1p, b1), h2p = h(a2p, b2);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) dhp = Math.abs(h2p - h1p) <= 180 ? h2p - h1p : h2p - h1p > 180 ? h2p - h1p - 360 : h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) hbp = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

export const distance = (a: string, b: string) => deltaE(hexToLab(a), hexToLab(b));

/** A neutral reads as a neutral: low chroma (greys, whites, blacks, oat, greige, most woods at a distance). */
export const isNeutral = (hex: string) => chroma(hexToLab(hex)) < 14;

/** Undertone by the Lab sign test (color.md §3): b* > 0 warm (yellow), b* < 0 cool (blue); greige sits between. */
export function undertone(hex: string): "warm" | "cool" | "neutral" {
  const [, a, b] = hexToLab(hex);
  if (b > 4 || (a > 4 && b > 0)) return "warm";
  if (b < -3 || (a < -3 && b < 2)) return "cool";
  return "neutral";
}

export type Value = "light" | "mid" | "dark";
export const valueOf = (hex: string): Value => {
  const L = hexToLab(hex)[0];
  return L > 80 ? "light" : L < 30 ? "dark" : "mid";
};

/** A hue family name, for "at most 3 non-neutral hue families" (rule 7). Neutrals return null. */
export function hueFamily(hex: string): string | null {
  const lab = hexToLab(hex);
  if (chroma(lab) < 14) return null;
  const h = hueAngle(lab);
  const names: [number, string][] = [[20, "red"], [55, "orange"], [80, "ochre"], [100, "yellow"], [160, "green"], [230, "teal"], [290, "blue"], [340, "violet"], [361, "red"]];
  return names.find(([lim]) => h < lim)![1];
}

/** The same hue, less chroma: what a color becomes when it covers a large area (color.md §3, area effect). */
export function quieten(hex: string, by = 0.45): string {
  const [L, a, b] = hexToLab(hex);
  return labToHex([Math.min(96, L + 4), a * (1 - by), b * (1 - by)]);
}

// ---- Wada Sanzō ----

export interface WadaColor {
  name: string;
  hex: string;
  lab: Lab;
  combinations: number[];
}

export const WADA: WadaColor[] = (wada as { name: string; hex: string; lab: number[]; combinations: number[] }[]).map((c) => ({
  name: c.name, hex: c.hex, lab: c.lab as Lab, combinations: c.combinations,
}));

const BY_COMBO = new Map<number, WadaColor[]>();
for (const c of WADA) for (const n of c.combinations) BY_COMBO.set(n, [...(BY_COMBO.get(n) ?? []), c]);

export interface WadaMatch {
  combination: number;
  // the Wada color matched to the anchor, and how far it is
  matched: WadaColor;
  dE: number;
  // the other colors in the combination: proven companions for the anchor
  companions: WadaColor[];
  // how well the companions sit with the person's palette (lower is better), when one was given
  paletteFit?: number;
}

/**
 * Combinations from Wada's dictionary that contain a color within `maxDE` (ΔE2000) of the anchor, best first.
 * With a palette (the person's swatches), candidates are re-ranked by how close their companions sit to it,
 * and colors near a "never" swatch are penalised (color.md §1, steps 1–2).
 */
export function wadaMatches(anchorHex: string, opts: { maxDE?: number; limit?: number; palette?: string[]; never?: string[] } = {}): WadaMatch[] {
  const { maxDE = 10, limit = 5, palette, never } = opts;
  const anchor = hexToLab(anchorHex);
  const near = WADA.map((c) => ({ c, dE: deltaE(anchor, c.lab) })).filter((x) => x.dE <= maxDE).sort((a, b) => a.dE - b.dE);
  // nothing that close: widen to the three nearest so there are always candidates
  const pool = near.length ? near : WADA.map((c) => ({ c, dE: deltaE(anchor, c.lab) })).sort((a, b) => a.dE - b.dE).slice(0, 3);
  const out: WadaMatch[] = [];
  const seen = new Set<number>();
  for (const { c, dE } of pool) {
    for (const n of c.combinations) {
      if (seen.has(n)) continue;
      seen.add(n);
      const companions = (BY_COMBO.get(n) ?? []).filter((x) => x.name !== c.name);
      const m: WadaMatch = { combination: n, matched: c, dE, companions };
      if (palette?.length) {
        const pl = palette.map(hexToLab);
        const fit = companions.reduce((s, x) => s + Math.min(...pl.map((p) => deltaE(p, x.lab))), 0) / Math.max(1, companions.length);
        const nv = (never ?? []).map(hexToLab);
        const bad = companions.some((x) => nv.some((p) => deltaE(p, x.lab) < 12)) ? 25 : 0;
        m.paletteFit = fit + bad;
      }
      out.push(m);
    }
  }
  out.sort((a, b) => (a.paletteFit ?? 0) + a.dE - ((b.paletteFit ?? 0) + b.dE));
  return out.slice(0, limit);
}

/** Do two colors go together? A shared Wada combination (each within ΔE 10), or a recognised harmony by hue. */
export function harmonize(a: string, b: string): { ok: boolean; why: string } {
  const la = hexToLab(a), lb = hexToLab(b);
  if (chroma(la) < 14 || chroma(lb) < 14) return { ok: true, why: "a neutral goes with anything" };
  for (const m of wadaMatches(a, { limit: 40 })) {
    if (m.companions.some((c) => deltaE(c.lab, lb) <= 10)) return { ok: true, why: `Wada Sanzō pairs them (combination ${m.combination})` };
  }
  const d = Math.abs(hueAngle(la) - hueAngle(lb)) % 360;
  const gap = d > 180 ? 360 - d : d;
  if (gap <= 40) return { ok: true, why: "analogous hues" };
  if (gap >= 150) return { ok: true, why: "complementary hues" };
  return { ok: false, why: "no shared combination or harmony" };
}

/** Assign roles by value and chroma, not order (color.md §1 step 3): lightest quiet → 60, deepest → 30, most saturated → 10. */
export function assignRoles(hexes: string[]): { dominant: string; secondary: string; accent: string } | null {
  if (hexes.length < 2) return null;
  const labs = hexes.map((h) => ({ h, lab: hexToLab(h) }));
  const accent = [...labs].sort((x, y) => chroma(y.lab) - chroma(x.lab))[0];
  const rest = labs.filter((x) => x !== accent);
  const dominant = [...rest].sort((x, y) => y.lab[0] - chroma(y.lab) - (x.lab[0] - chroma(x.lab)))[0];
  const secondary = rest.find((x) => x !== dominant) ?? dominant;
  return { dominant: quieten(dominant.h, 0.5), secondary: secondary.h, accent: accent.h };
}
