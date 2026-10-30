import localFont from "next/font/local";

// Homebody's type (Maeve, 2026-10-30): an elegant serif for display over a quiet, refined sans,
// on a monochrome palette. Editorial rather than tech: think Aesop, Kinfolk, a design studio.
// Self-hosted; licenses in public/fonts/LICENSES.md.
//
// Each face writes --ff-display or --ff-sans, so a pairing is just a set of classes: on <html>
// for the whole site (app/layout.tsx), or on a wrapper with .type-scope to re-type what's
// inside it (the specimen at /demo/type). There's no handwriting face: notebook marks are
// typographic (italic, grey, a small "?").
//
// To change the site's type, change LIVE at the bottom of this file. That's the only edit.

// ---- Display serifs ----

const gambetta = localFont({
  src: [
    { path: "./Gambetta-Variable.woff2", weight: "300 700", style: "normal" },
    { path: "./Gambetta-VariableItalic.woff2", weight: "300 700", style: "italic" },
  ],
  variable: "--ff-display",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const boska = localFont({
  src: [
    { path: "./Boska-Variable.woff2", weight: "200 900", style: "normal" },
    { path: "./Boska-VariableItalic.woff2", weight: "200 900", style: "italic" },
  ],
  variable: "--ff-display",
  display: "swap",
  preload: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

// ---- Text sans ----

const switzer = localFont({
  src: [
    { path: "./Switzer-Variable.woff2", weight: "100 900", style: "normal" },
    { path: "./Switzer-VariableItalic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--ff-sans",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

const generalSans = localFont({
  src: [
    { path: "./GeneralSans-Variable.woff2", weight: "200 700", style: "normal" },
    { path: "./GeneralSans-VariableItalic.woff2", weight: "200 700", style: "italic" },
  ],
  variable: "--ff-sans",
  display: "swap",
  preload: false,
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

type Font = { variable: string };
export interface Pairing {
  name: string;
  display: Font & { label: string };
  sans: Font & { label: string };
  why: string;
}

const tag = <T extends Font>(f: T, label: string) => ({ variable: f.variable, label });

export const PAIRINGS = {
  gambetta: {
    name: "Gambetta and Switzer",
    display: tag(gambetta, "Gambetta"),
    sans: tag(switzer, "Switzer"),
    why: "A literary serif with a real italic, set light and large, over a plain Swiss grotesk. Calm and bookish: a monograph, not a landing page.",
  },
  boska: {
    name: "Boska and Switzer",
    display: tag(boska, "Boska"),
    sans: tag(switzer, "Switzer"),
    why: "Higher contrast and sharper serifs: couture, closer to a fashion masthead. More drama at display sizes; it needs room to breathe.",
  },
  generalSans: {
    name: "Gambetta and General Sans",
    display: tag(gambetta, "Gambetta"),
    sans: tag(generalSans, "General Sans"),
    why: "The same serif over a rounder, more geometric sans. A touch warmer and more contemporary in the small text.",
  },
} satisfies Record<string, Pairing>;

export type PairingId = keyof typeof PAIRINGS;

/** The site's typefaces. Change this one line to re-type Homebody. */
export const LIVE: PairingId = "gambetta";

/** The classes that load a pairing and point --ff-display and --ff-sans at it */
export const pairingClass = (id: PairingId) => {
  const p: Pairing = PAIRINGS[id];
  return `${p.display.variable} ${p.sans.variable}`;
};
