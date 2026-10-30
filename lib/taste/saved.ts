import type { Answer, Known } from "./questions";
import type { RoomSpec } from "../scan/spec";
import type { Bins } from "@/components/RoomSort";
import type { Convo } from "./session";
import type { TasteState } from "./visual";

// What Taste Builder keeps in this browser, shared by the conversation (/taste)
// and the screen-per-question flow (/taste?mode=screens), so either one resumes
// the other and the assumptions view reads the same answers.

export interface Saved {
  // a question id, or "deeper" (after the core path) or "done"
  cur: string;
  history: string[];
  answers: Record<string, Answer>;
  depth: "core" | "all";
  // personal-story details said along the way ("my grandmother loved butterflies"), in their words
  notes?: string[];
  // the designer conversation (components/taste/TasteStudio): visual picks and the live dossier.
  // Optional, so state saved by the older flows still reads, and they ignore it.
  taste?: TasteState;
  convo?: Convo;
}

export const START: Saved = { cur: "", history: [], answers: {}, depth: "core" };
export const STORE_KEY = "homebody-taste";

// Coming back after finishing ("Tell us more about you") reopens at the next open question;
// with none left, cur falls through to "done" again
export function readSaved(): Saved {
  try {
    const saved: Saved = { ...START, ...JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") };
    return saved.cur === "done" ? { ...saved, cur: "", depth: "all" } : saved;
  } catch {
    return START;
  }
}

// What Space Capture left in this browser, in the shape the tree reads
interface Capture {
  answers?: NonNullable<Known["intake"]>;
  roomId?: string;
  absent?: string[];
}

export async function loadKnown(): Promise<Omit<Known, "answers">> {
  let cap: Capture = {};
  try {
    cap = JSON.parse(localStorage.getItem("homebody-capture") ?? "{}");
  } catch {}
  // no room yet: nothing known, everything is asked
  if (!cap.roomId) return {};
  const a = cap.answers ?? {};
  const intake: Known["intake"] = {
    scope: a.scope, room: a.room, access: a.access, have: a.have,
    bringing: a.bringing, brought: a.brought, wish: a.wish, wishUrl: a.wishUrl,
  };
  const spec: RoomSpec | null = await fetch(`/api/rooms/${cap.roomId}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d?.spec ?? null)
    .catch(() => null);
  if (!spec) return { intake };
  const absent = cap.absent ?? [];
  const items = spec.items.filter((i) => !absent.includes(i.id));
  let bins: Bins = {};
  try {
    bins = JSON.parse(localStorage.getItem(`homebody-bins-${cap.roomId}`) ?? "{}");
  } catch {}
  const count = (b: string) => items.filter((i) => bins[i.id] === b).length;
  // the room's size and windows, for the brief: bounding box of the footprint, in feet
  const FT = 3.28084;
  const xs = spec.footprint.map((p) => p.x);
  const ys = spec.footprint.map((p) => p.y);
  const a1 = (Math.max(...xs) - Math.min(...xs)) * FT;
  const a2 = (Math.max(...ys) - Math.min(...ys)) * FT;
  const space = xs.length >= 3 && a1 > 0 && a2 > 0
    ? {
        length: Math.round(Math.max(a1, a2) * 2) / 2, width: Math.round(Math.min(a1, a2) * 2) / 2, ceiling: Math.round(spec.ceiling_height * FT * 2) / 2,
        windows: spec.openings.filter((o) => o.type === "window" || o.type === "glass_door").map((o) => ({ width: Math.round(o.width * FT * 2) / 2 })),
        doors: spec.openings.filter((o) => o.type === "door" || o.type === "opening").length,
        light: spec.lighting,
      }
    : undefined;
  return {
    intake,
    space,
    scan: { profile_signals: spec.profile_signals, items },
    // untouched pieces stay, so they count in keep, but only taps count in tappedKeep
    sort: { keep: items.length - count("move") - count("remove"), tappedKeep: count("keep"), move: count("move"), remove: count("remove"), bins },
  };
}
