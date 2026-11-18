"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomItem, RoomSpec } from "@/lib/scan/spec";
import type { BuildInfo, RoomStatus } from "@/lib/scan/store";
import { readSaved } from "@/lib/taste/saved";
import type { TasteState } from "@/lib/taste/visual";
import {
  GOOD_FIT, HEROES, KIND_ONE, PRODUCT, PRODUCTS, REAL_CREDIT, hasTaste, kindOf, money, priceLabel, sortCatalog, twinOf, type Product,
} from "@/lib/play/catalog";
import {
  doorZones, initialLayout, pinFixed, readLayout, reconcile, settle, shapeOf, totalCost, wallsOf,
  writeLayout, type Layout, type Piece, type Settled, type Shape,
} from "@/lib/play/layout";
import type { SceneApi, View } from "./PlayScene";
import { Icon, type IconName } from "./icons";
import { renderThumbs } from "./thumbs";
import { bestSpot } from "@/lib/play/placement";
import { EMPTY_PREFS, neverMaterials, react, reactOwn, readBrief, readPrefs, writePrefs, type BriefRead, type Prefs } from "@/lib/play/prefs";
import { propose, withoutUnchosen, type ProposalResult } from "@/lib/play/proposal";
import type { RankCtx } from "@/lib/play/rank";
import { CANDIDATES, catalogMaterial, toDesign } from "@/lib/play/design";
import { ripple as rippleFor, type Ripple } from "@/lib/design/ripple";
import ChangeSheet, { type RippleMode } from "./ChangeSheet";
import SwipeDeck from "./SwipeDeck";
import Walkthrough from "./Walkthrough";
import AskDesigner from "./AskDesigner";
import { ProductThumb, THUMB } from "./ProductThumb";

const PlayScene = dynamic(() => import("./PlayScene"), { ssr: false });

interface Loaded {
  spec: RoomSpec;
  // the room's wall color, measured from the photos when there are any
  wallTint?: string;
  glbUrl: string;
  hdri?: string;
  taste?: TasteState;
  // the confirmed brief and how she shops, read once from this browser
  brief: BriefRead;
  bins: Record<string, string>;
}

interface History {
  past: Layout[];
  now: Layout;
  future: Layout[];
}

type Tab = "tray" | "catalog";

// one line, and at most one thing to do about it
interface Toast {
  text: string;
  action?: { label: string; short: string; run: () => void };
}

const cm = (m: number) => Math.round(m * 100);
const STEP = 0.05;
// keep "6 × 9" and "220 × 95" on one line
const nb = (t: string) => t.replace(/(\d) × (\d)/g, "$1\u00a0×\u00a0$2");
const isPhone = () => window.matchMedia("(max-width: 1023px)").matches;

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Plug & Play: the room arrives furnished from the brief (lib/play/proposal.ts); she reacts to any piece with a
 * tap, asks for a change in chips or words, decides whether the room follows (lib/design/ripple.ts), teaches it
 * her taste with a swipe deck, and moves on to review and buy.
 */
export default function PlayEditor({ id, fromBrief = false }: { id: string; fromBrief?: boolean }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [hist, setHist] = useState<History | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<View>("3d");
  // null until they pick a tab: then the tray if anything's waiting, else the catalog
  const [tab, setTab] = useState<Tab | null>(null);
  const [swapping, setSwapping] = useState(false);
  // the "what I've added" list behind the cost pill
  const [showAdded, setShowAdded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [touched, setTouched] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(EMPTY_PREFS);
  const [deck, setDeck] = useState(false);
  const [asking, setAsking] = useState(false);
  const [walk, setWalk] = useState(false);
  // the last "let the room follow": what the room was before it followed, and what changed
  const [follow, setFollow] = useState<{ before: Layout; result: Ripple } | null>(null);
  // dislikes in a row, for the gentle nudge
  const [misses, setMisses] = useState(0);
  const [proposal, setProposal] = useState<{ added: number; skipped: ProposalResult["skipped"] } | null>(null);
  const [, setThumbs] = useState(0);
  // built-in items as the room model marks them; the name rule in lib/play/layout covers older rooms
  const [builtIn, setBuiltIn] = useState<Map<string, number | undefined>>(new Map());
  const api = useRef<SceneApi | null>(null);

  // Load the room, this browser's sorting and saved layout, and the taste profile
  useEffect(() => {
    let alive = true;
    fetch(`/api/rooms/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { status: RoomStatus; spec: RoomSpec | null; build: (BuildInfo & { light?: { hdri?: string } }) | null } | null) => {
        if (!alive) return;
        if (!body?.spec || !body.build) return setFailed(true);
        const spec = body.spec;
        const capture = readJson<{ roomId?: string; absent?: string[]; answers?: { brought?: string[] } }>("homebody-capture", {});
        const ours = capture.roomId === id;
        const inputs = {
          spec,
          bins: readJson<Record<string, string>>(`homebody-bins-${id}`, {}),
          absent: readJson<string[]>(`homebody-absent-${id}`, ours ? capture.absent ?? [] : []),
          brought: ours ? capture.answers?.brought ?? [] : [],
        };
        const fresh = initialLayout(inputs);
        const saved = readLayout(id);
        const taste = readSaved().taste;
        const hdri = body.build.light?.hdri;
        const brief = readBrief();
        const prefsNow = readPrefs();
        setPrefs(prefsNow);
        setData({
          spec,
          glbUrl: `/api/rooms/${id}/files/build/room.glb?v=${body.build.seconds}-${body.status.refinedAt ?? ""}`,
          hdri: hdri && /^[a-z0-9_]+\.hdr$/.test(hdri) ? `/api/play/hdri/${hdri}` : undefined,
          taste: hasTaste(taste) ? taste : undefined,
          brief,
          bins: inputs.bins,
        });
        let now = saved ? reconcile(saved, fresh, inputs) : fresh;
        // the room starts furnished: a proposal from the brief, once, unless she's already adding her own
        if (!now.proposedAt && !now.pieces.some((p) => p.source === "catalog")) {
          const r = propose({
            spec, layout: now, items: new Map(spec.items.map((i) => [i.id, i])), bins: inputs.bins, brief, prefs: prefsNow,
            taste: hasTaste(taste) ? taste : undefined,
          });
          now = r.layout;
          setProposal({ added: r.added.length, skipped: r.skipped });
        }
        setHist({ past: [], now, future: [] });
        if (fromBrief && !prefsNow.walkthroughSeen) setWalk(true);
        // open on what's waiting to be placed, if anything is; after that the tab is theirs to change
        setTab(now.pieces.some((p) => !p.placed && p.source !== "catalog") ? "tray" : "catalog");
        fetch(`/api/play/look/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((look: { walls?: string } | null) => alive && setData((d) => d && { ...d, wallTint: look?.walls ?? spec.walls.color }))
          .catch(() => {});
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id, fromBrief]);

  // the catalog's pictures, drawn from the same models as the room, once the room is up
  useEffect(() => {
    if (!data) return;
    let alive = true;
    // what the catalog shows first; the lookalike twins (seen in Swap) after
    const t = window.setTimeout(async () => {
      const n = await renderThumbs(HEROES);
      if (alive) setThumbs(n);
    }, 600);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [data]);

  // the lookalike twins only show in Swap and "What you've added": draw them when one of those opens
  const twinsWanted = swapping || showAdded;
  useEffect(() => {
    if (!twinsWanted) return;
    let alive = true;
    renderThumbs(PRODUCTS).then((n) => alive && setThumbs(n));
    return () => {
      alive = false;
    };
  }, [twinsWanted]);

  const layout = hist?.now;
  useEffect(() => {
    if (layout) writeLayout(id, layout);
  }, [id, layout]);

  const items = useMemo(() => new Map<string, RoomItem>((data?.spec.items ?? []).map((i) => [i.id, i])), [data]);
  const shapes = useMemo(() => {
    const out: Record<string, Shape> = {};
    for (const p of layout?.pieces ?? []) {
      const s = shapeOf(p, items);
      out[p.key] = !s.fixed && !p.product && p.item && builtIn.has(p.item) ? { ...s, fixed: true } : s;
    }
    return out;
  }, [layout, items, builtIn]);
  const onFixed = useCallback(
    (fixed: Map<string, number | undefined>) => {
      setBuiltIn(fixed);
      // not an undo step: it's the room, not an edit
      if (data) setHist((h) => (h ? { ...h, now: pinFixed(h.now, data.spec, fixed) } : h));
    },
    [data],
  );
  const footprint = useMemo(() => data?.spec.footprint ?? [], [data]);
  const walls = useMemo(() => wallsOf(footprint), [footprint]);
  const zones = useMemo(() => (data ? doorZones(data.spec, walls) : []), [data, walls]);

  const commit = useCallback((next: Layout) => {
    setHist((h) => (h ? { past: [...h.past, h.now].slice(-100), now: next, future: [] } : h));
  }, []);
  const undo = useCallback(() => setHist((h) => (h && h.past.length ? { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future] } : h)), []);
  const redo = useCallback(() => setHist((h) => (h && h.future.length ? { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1) } : h)), []);

  const flash = useCallback((text: string, ms = 1800, action?: Toast["action"]) => {
    const t: Toast = { text, action };
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), ms);
  }, []);

  const update = useCallback(
    (key: string, patch: (p: Piece) => Partial<Piece> | null) => {
      if (!layout) return;
      let changed = false;
      const pieces = layout.pieces.map((p) => {
        if (p.key !== key) return p;
        const d = patch(p);
        if (!d) return p;
        changed = true;
        return { ...p, ...d };
      });
      if (changed) commit({ ...layout, pieces });
    },
    [layout, commit],
  );

  const wallOk = useCallback((i: number) => api.current?.wallShown(i) ?? true, []);
  const place = useCallback(
    (p: Piece, shape: Shape, x: number, y: number, rot: number) => {
      const s = settle(shape, x, y, rot, footprint, walls, (i) => wallOk(i) || i === p.wall);
      return { x: s.x, y: s.y, rot: s.rot, wall: s.wall ?? (shape.mount === "wall" ? p.wall : undefined) };
    },
    [footprint, walls, wallOk],
  );

  const onMove = useCallback((key: string, to: Settled) => {
    update(key, () => ({ x: to.x, y: to.y, rot: to.rot, wall: to.wall }));
  }, [update]);
  const onRefuse = useCallback((why: string) => flash(why, 2600), [flash]);

  const rotate = (deg: number) => {
    if (!selected) return;
    const shape = shapes[selected];
    if (!shape || shape.mount === "wall") return;
    update(selected, (p) => place(p, shape, p.x, p.y, (((p.rot + deg) % 360) + 360) % 360));
  };

  const nudge = (dir: "up" | "down" | "left" | "right", fine: boolean) => {
    if (!selected || !api.current) return;
    const shape = shapes[selected];
    if (!shape) return;
    const step = fine ? 0.01 : STEP;
    if (shape.mount === "wall" && (dir === "up" || dir === "down")) {
      const ceiling = data?.spec.ceiling_height ?? 2.6;
      update(selected, (p) => ({ elev: Math.max(0.05, Math.min(ceiling - shape.h - 0.05, p.elev + (dir === "up" ? step : -step))) }));
      return;
    }
    const { up, right } = api.current.screenAxes();
    const v = dir === "up" ? up : dir === "down" ? { x: -up.x, y: -up.y } : dir === "right" ? right : { x: -right.x, y: -right.y };
    update(selected, (p) => place(p, shape, p.x + v.x * step, p.y + v.y * step, p.rot));
  };

  const putAway = (key: string) => {
    if (!layout) return;
    const p = layout.pieces.find((x) => x.key === key);
    if (!p) return;
    setSelected(null);
    setSwapping(false);
    if (p.source === "catalog") {
      commit({ ...layout, pieces: layout.pieces.filter((x) => x.key !== key) });
      flash(`Removed ${shapes[key]?.name ?? "it"}`);
    } else {
      update(key, () => ({ placed: false }));
      flash("Back in “To find a spot for”");
    }
  };

  // Where a designer would land a piece tapped in from the panel (lib/play/placement.ts): seating facing the
  // focal point, walkways kept, never on furniture or in a doorway. Null when nowhere is any good.
  const spot = (p: Piece, shape: Shape, shapesNow: Record<string, Shape>) => {
    if (!layout || !data) return null;
    const elev = shape.mount === "wall" ? (p.elev > 0.3 ? p.elev : Math.max(0.9, 1.5 - shape.h / 2)) : 0;
    if (shape.mount === "wall") {
      const at = wallSpot(p, shape, elev);
      return at ? { ...at, elev } : null;
    }
    const pieces = layout.pieces.some((q) => q.key === p.key) ? layout.pieces : [...layout.pieces, p];
    const at = bestSpot(p, shape, { spec: data.spec, footprint, pieces, shapes: shapesNow, zones });
    return at ? { ...at, wall: undefined, elev } : null;
  };

  // a clear stretch of a wall in view: not behind the TV, over a door, or on another hung piece
  const wallSpot = (p: Piece, shape: Shape, elev: number) => {
    const hung = (layout?.pieces ?? []).filter((o) => o.placed && o.key !== p.key && o.wall !== undefined && shapes[o.key]);
    const shown = walls.filter((w) => wallOk(w.i) && w.len > shape.w + 0.2);
    const tries: { at: ReturnType<typeof place>; score: number }[] = [];
    for (const w of shown.length ? shown : walls) {
      for (let t = shape.w / 2 + 0.1; t <= w.len - shape.w / 2 - 0.1; t += 0.1) {
        const at = place(p, shape, w.ax + w.dx * t + w.nx * 0.2, w.ay + w.dy * t + w.ny * 0.2, p.rot);
        if (at.wall !== w.i) continue;
        const along = (x: number, y: number) => (x - w.ax) * w.dx + (y - w.ay) * w.dy;
        const blocked = (data?.spec.openings ?? []).some((op) =>
          op.wall === w.i && t + shape.w / 2 > op.offset - 0.05 && t - shape.w / 2 < op.offset + op.width + 0.05 && elev < op.sill + op.height && elev + shape.h > op.sill);
        const clash = blocked || hung.some((o) => {
          if (o.wall !== w.i) return false;
          const os = shapes[o.key];
          const gap = Math.abs(along(o.x, o.y) - t) - (os.w + shape.w) / 2;
          const vert = Math.min(o.elev + os.h, elev + shape.h) - Math.max(o.elev, elev);
          return gap < 0.1 && vert > -0.05;
        });
        if (!clash) tries.push({ at, score: Math.abs(t - w.len / 2) });
      }
    }
    tries.sort((a, b) => a.score - b.score);
    return tries[0]?.at ?? null;
  };

  // One of theirs of the same kind, for "In place of yours"
  const sameKindOwn = (category: string) => {
    const kind = kindOf(category);
    return kind ? layout?.pieces.find((q) => q.placed && q.source === "room" && shapes[q.key] && !shapes[q.key].fixed && kindOf(shapes[q.key].category) === kind) : undefined;
  };

  // A new piece in place of one of theirs: theirs shows the new piece (a swap), and the waiting copy goes
  const swapInPlace = (ownKey: string, product: Product, waitingKey?: string) => {
    if (!layout) return;
    const own = layout.pieces.find((q) => q.key === ownKey);
    if (!own) return;
    const next: Piece = { ...own, product: product.id };
    const at = place(next, shapeOf(next, items), own.x, own.y, own.rot);
    commit({
      ...layout,
      pieces: layout.pieces.filter((q) => q.key !== waitingKey).map((q) => (q.key === ownKey ? { ...q, product: product.id, ...at } : q)),
    });
    setSelected(ownKey);
    setToast(null);
  };

  // No good spot: it waits in "To find a spot for", and if they own one of these, one tap puts it in its place
  const noRoom = (product: Product | undefined, waitingKey: string) => {
    const own = product ? sameKindOwn(product.category) : undefined;
    const ownName = own ? shapes[own.key].name : "";
    flash("No clear floor here", 5000, own && product
      ? { label: `In place of your ${ownName.charAt(0).toLowerCase() + ownName.slice(1)}`, short: "In place of yours", run: () => swapInPlace(own.key, product, waitingKey) }
      : undefined);
  };

  const placeFromTray = (key: string, at?: Settled & { elev: number }) => {
    if (!layout) return;
    const p = layout.pieces.find((x) => x.key === key);
    const shape = shapes[key];
    if (!p || !shape) return;
    const to = at ?? spot(p, shape, shapes);
    if (!to) return noRoom(shape.product, key);
    commit({ ...layout, pieces: layout.pieces.map((q) => (q.key === key ? { ...q, x: to.x, y: to.y, rot: to.rot, wall: to.wall, elev: to.elev, placed: true } : q)) });
    setSelected(key);
    setTouched(true);
    if (isPhone()) setSheetOpen(false);
  };

  const newPiece = (product: Product): Piece => ({
    key: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    source: "catalog", product: product.id, x: 0, y: 0, rot: 0, elev: 0, placed: true,
  });

  const addProduct = (product: Product, at?: Settled & { elev: number }, piece = newPiece(product)) => {
    if (!layout) return;
    const shape = shapeOf(piece, items);
    const to = at ?? spot(piece, shape, { ...shapes, [piece.key]: shape });
    setTouched(true);
    if (!to) {
      // never onto furniture: it waits in the tray instead
      commit({ ...layout, pieces: [...layout.pieces, { ...piece, placed: false }] });
      return noRoom(product, piece.key);
    }
    commit({ ...layout, pieces: [...layout.pieces, { ...piece, x: to.x, y: to.y, rot: to.rot, wall: to.wall, elev: to.elev }] });
    setSelected(piece.key);
    if (isPhone()) setSheetOpen(false);
  };

  const swapTo = (product: Product | null) => {
    if (!selected) return;
    const piece = layout?.pieces.find((p) => p.key === selected);
    if (!piece) return;
    const next: Piece = { ...piece, product: product?.id };
    const shape = shapeOf(next, items);
    update(selected, () => ({ product: product?.id, ...place(next, shape, piece.x, piece.y, piece.rot) }));
  };

  const updatePrefs = (fn: (p: Prefs) => Prefs) =>
    setPrefs((p) => {
      const n = fn(p);
      writePrefs(n);
      return n;
    });
  const rippleMode: RippleMode = prefs.ripple ?? "keep";

  /**
   * An alternative picked in "Change this": it goes in where the old piece stood (marked as her choice). With
   * "Let the room follow", the ripple engine's proposals (up to three small pieces) go in too, shown in a bar
   * she keeps or undoes; with "Just this piece", only its warnings are said.
   */
  const pickAlternative = (product: Product) => {
    if (!selected || !layout || !data) return;
    const piece = layout.pieces.find((p) => p.key === selected);
    const before = shapes[selected];
    if (!piece || !before) return;
    const next: Piece = { ...piece, product: product.id, chosen: true, why: `Your pick, in place of the ${before.name.charAt(0).toLowerCase()}${before.name.slice(1)}` };
    const shape = shapeOf(next, items);
    const at = place(next, shape, piece.x, piece.y, piece.rot);
    const after: Layout = { ...layout, pieces: layout.pieces.map((q) => (q.key === selected ? { ...next, ...at } : q)) };
    const afterShapes = { ...shapes, [selected]: shape };
    const design = toDesign(after.pieces, afterShapes, items, data.bins);
    const it = piece.item ? items.get(piece.item) : undefined;
    const from = before.product
      ? { color: before.product.color, accent: before.product.accent, material: before.product.material, accentMaterial: before.product.accentMaterial }
      : { color: before.color, material: catalogMaterial(it?.primary_material ?? "") };
    const locked = new Set(after.pieces.filter((q) => q.chosen || q.source !== "catalog").map((q) => q.key));
    const r = rippleFor(
      { key: selected, from, to: { color: product.color, accent: product.accent, material: product.material, accentMaterial: product.accentMaterial } },
      design, CANDIDATES,
      { mode: rippleMode, locked, inRoom: new Set(after.pieces.flatMap((q) => (q.product ? [q.product] : []))) },
    );
    commit(after);
    setTouched(true);
    if (rippleMode === "ripple" && r.proposals.length) {
      const followed: Layout = {
        ...after,
        pieces: after.pieces.map((q) => {
          const prop = r.proposals.find((x) => x.key === q.key);
          if (!prop) return q;
          const moved: Piece = { ...q, product: prop.to, why: prop.why };
          return { ...moved, ...place(moved, shapeOf(moved, items), q.x, q.y, q.rot) };
        }),
      };
      commit(followed);
      setFollow({ before: after, result: r });
    } else if (r.warnings.length) {
      flash(r.warnings[0], 5000, rippleMode === "keep" && r.warnings.some((w) => /one-off|once|twice/.test(w)) ? { label: "Let the room follow next time", short: "Room follows", run: () => { updatePrefs((p) => ({ ...p, ripple: "ripple" })); setToast(null); } } : undefined);
    }
  };

  // one tap: a yes keeps it and steers the ranking; a no is noted, offers a change, and after a few in a row,
  // a gentle nudge toward the swipe deck
  const reactTo = (key: string, by: 1 | -1) => {
    const p = layout?.pieces.find((q) => q.key === key);
    const s = shapes[key];
    if (!p || !s) return;
    if (s.product) updatePrefs((x) => react(x, s.product!, by));
    else {
      const it = p.item ? items.get(p.item) : undefined;
      if (it) updatePrefs((x) => reactOwn(x, { material: catalogMaterial(it.primary_material), color: it.primary_color }, by));
    }
    if (by > 0) {
      setMisses(0);
      if (p.source === "catalog" && !p.chosen) update(key, () => ({ chosen: true }));
      flash(p.source === "catalog" ? "Kept. More like this" : "Noted: you love this one");
      return;
    }
    const n = misses + 1;
    setMisses(n);
    if (n >= 3) {
      flash("Not landing yet? A few quick swipes will help", 7000, { label: "Teach me your taste", short: "Teach me", run: () => { setToast(null); setMisses(0); setDeck(true); } });
    } else if (s.product || p.source === "room") {
      flash("Noted", 5000, { label: "See something else here", short: "Change this", run: () => { setToast(null); openSwap(true); } });
    }
  };

  // re-furnish the unchosen part of the proposal, after the taste moved (the swipe deck)
  const refurnish = (prefsNow: Prefs) => {
    if (!layout || !data) return;
    const r = propose({ spec: data.spec, layout: withoutUnchosen(layout), items, bins: data.bins, brief: data.brief, prefs: prefsNow, taste: data.taste, wall: data.wallTint, builtIn: new Set(builtIn.keys()) });
    commit(r.layout);
    setProposal({ added: r.added.length, skipped: r.skipped });
    setSelected(null);
    flash(`Re-furnished: ${r.added.length} piece${r.added.length === 1 ? "" : "s"} chosen around your answers`, 3500);
  };

  const openSwap = (force = false) => {
    const opening = force || !swapping;
    setAsking(false);
    setSwapping(opening);
    setShowAdded(false);
    if (!opening) {
      if (isPhone()) api.current?.frame(null);
      return;
    }
    setSheetOpen(true);
    // on a phone the room shrinks to the top half: once the sheet is up, bring the piece to its middle
    if (isPhone()) window.setTimeout(() => api.current?.frame(selected), 330);
  };
  const closeSwap = () => {
    setSwapping(false);
    if (isPhone()) api.current?.frame(null);
  };

  // ---- dragging a card from the panel into the room (mouse and pen; fingers tap) ----
  const dragIn = useRef<null | { piece: Piece; shape: Shape; x: number; y: number; moved: boolean; product?: Product; at: (Settled & { elev: number; blocked: boolean }) | null }>(null);
  const startCardDrag = (e: React.PointerEvent, piece: Piece, product?: Product) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    dragIn.current = { piece, shape: shapeOf(piece, items), x: e.clientX, y: e.clientY, moved: false, product, at: null };
  };
  const latestActions = useRef({ placeFromTray, addProduct, flash });
  useEffect(() => {
    latestActions.current = { placeFromTray, addProduct, flash };
  });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragIn.current;
      if (!d || !api.current) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
      d.moved = true;
      document.body.style.cursor = "grabbing";
      d.at = api.current.ghostAt(d.piece, d.shape, e.clientX, e.clientY);
    };
    const up = () => {
      const d = dragIn.current;
      if (!d) return;
      dragIn.current = null;
      document.body.style.cursor = "";
      if (!d.moved) return; // a click: the card's own button handles it
      const ok = !!d.at && !d.at.blocked;
      api.current?.clearGhost(ok);
      if (d.at?.blocked) latestActions.current.flash("That spot's taken");
      if (!ok || !d.at) return;
      if (d.product) latestActions.current.addProduct(d.product, d.at, d.piece);
      else latestActions.current.placeFromTray(d.piece.key, d.at);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  // ---- keyboard ----
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keys.current = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (!selected) return;
      const arrows: Record<string, "up" | "down" | "left" | "right"> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      if (arrows[e.key]) {
        e.preventDefault();
        nudge(arrows[e.key], e.shiftKey);
      } else if (e.key === "r" || e.key === "R") {
        rotate(e.shiftKey ? -15 : -90);
      } else if (e.key === "[" || e.key === "]") {
        rotate(e.key === "[" ? 15 : -15);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        putAway(selected);
      } else if (e.key === "Escape") {
        setSelected(null);
        setSwapping(false);
      }
    };
  });
  useEffect(() => {
    const on = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const onSelect = useCallback((key: string | null) => {
    setSelected(key);
    if (key) setTouched(true);
    if (!key) setSwapping(false);
    // on a phone, picking something up gives the room the screen
    else if (isPhone()) setSheetOpen(false);
  }, []);

  const catalog = useMemo(() => sortCatalog(data?.taste), [data]);

  // what ranking knows: her picks, her taps, her brief and the colors already fixed in the room
  const rankCtx: RankCtx | null = useMemo(() => {
    if (!data || !layout) return null;
    const kept = layout.pieces.filter((p) => p.placed && p.source === "room" && !p.product && shapes[p.key] && !shapes[p.key].fixed);
    const anchors = kept.sort((a, b) => shapes[b.key].w * shapes[b.key].h - shapes[a.key].w * shapes[a.key].h).slice(0, 3).map((p) => shapes[p.key].color);
    return { taste: data.taste, prefs, brief: data.brief, anchors: [...anchors, data.wallTint ?? data.spec.walls.color], never: neverMaterials(data.brief) };
  }, [data, layout, shapes, prefs]);
  const inRoom = useMemo(() => new Set((layout?.pieces ?? []).flatMap((p) => (p.product ? [p.product] : []))), [layout]);
  // the piece "Change this" is about, as the sheet needs it
  const changeCurrent = useMemo(() => {
    const p = selected ? layout?.pieces.find((q) => q.key === selected) : undefined;
    const sh = p ? shapes[p.key] : undefined;
    const kind = sh ? kindOf(sh.category) : undefined;
    if (!p || !sh || !kind) return null;
    const pr = sh.product;
    if (pr) return { id: pr.id, name: pr.name, category: pr.category, sub: pr.sub, price: pr.price, color: pr.color, w: pr.w, material: pr.material, product: pr };
    const it = p.item ? items.get(p.item) : undefined;
    return {
      name: sh.name, category: kind, sub: sh.category === "side_table" || sh.category === "nightstand" ? "side_table" : undefined,
      price: 0, color: sh.color, w: sh.w, material: catalogMaterial(it?.primary_material ?? ""),
    };
  }, [selected, layout, shapes, items]);

  if (failed) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-2xl">We couldn&apos;t open this room</h1>
        <p className="mt-2 text-ink-soft">It may still be building.</p>
        <Link href={`/rooms/${id}`} className="mt-4 inline-block underline">Back to the room</Link>
      </div>
    );
  }
  if (!data || !layout) return <div className="max-w-5xl mx-auto px-6 py-16 text-ink-soft">Setting out your room…</div>;

  const tray = layout.pieces.filter((p) => !p.placed && !shapes[p.key]?.fixed);
  const added = layout.pieces.filter((p) => p.product && PRODUCT.has(p.product));
  const cost = totalCost(layout);
  const sel = selected ? layout.pieces.find((p) => p.key === selected) : undefined;
  const selShape = sel ? shapes[sel.key] : undefined;
  const selKind = selShape ? kindOf(selShape.category) : undefined;
  const swapOpen = swapping && !!sel && !!selKind;
  const activeTab: Tab = tray.length ? tab ?? "catalog" : "catalog";
  const panelBody = asking ? (
    <AskDesigner roomId={id} piece={selShape?.name} onClose={() => setAsking(false)} onAdded={() => flash("Added to your brief. Your designer will pick it up", 3500)} />
  ) : showAdded ? (
    <AddedPanel
      roomId={id}
      pieces={added}
      shapes={shapes}
      total={cost.total}
      estimated={cost.estimated + cost.unpriced > 0}
      onClose={() => setShowAdded(false)}
      onPick={(key) => {
        setSelected(key);
        setShowAdded(false);
        if (isPhone()) setSheetOpen(false);
      }}
      onRemove={(key) => {
        const p = added.find((x) => x.key === key);
        if (!p) return;
        if (p.source === "catalog") commit({ ...layout, pieces: layout.pieces.filter((x) => x.key !== key) });
        else update(key, () => ({ product: undefined }));
      }}
    />
  ) : swapOpen && sel && changeCurrent && rankCtx ? (
    <ChangeSheet
      key={sel.key}
      current={changeCurrent}
      ctx={rankCtx}
      exclude={inRoom}
      ripple={rippleMode}
      onRipple={(m) => updatePrefs((p) => ({ ...p, ripple: m }))}
      onPick={(p) => pickAlternative(p)}
      onBackToOwn={sel.source === "room" && sel.product ? () => swapTo(null) : undefined}
      ownName={sel.item ? items.get(sel.item)?.name : undefined}
      onClose={closeSwap}
      onAskDesigner={() => { setAsking(true); setSheetOpen(true); }}
    />
  ) : (
    <>
      {tray.length > 0 && <div className="px-3 lg:px-4 pt-1 lg:pt-3 shrink-0">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm">
          {([["tray", `To find a spot for${tray.length ? ` · ${tray.length}` : ""}`], ["catalog", "Catalog"]] as const).map(([t, l]) => (
            <button key={t} onClick={() => { setTab(t); setSheetOpen(true); }} aria-pressed={activeTab === t} className={`h-9 rounded-lg px-2 truncate ${activeTab === t ? "bg-segment font-medium shadow-sm" : "text-ink-soft"}`}>{l}</button>
          ))}
        </div>
      </div>}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 lg:px-4 py-3">
        {activeTab === "tray" ? (
          tray.length ? (
            <ul className="flex flex-col gap-2">
              {tray.map((p) => {
                const s = shapes[p.key];
                return (
                  <li key={p.key}>
                    <Card
                      onPointerDown={(e) => startCardDrag(e, p)}
                      onPlace={() => placeFromTray(p.key)}
                      thumb={s.product ? <ProductThumb product={s.product} /> : <Thumb color={s.color} kind={kindOf(s.category) ?? "box"} />}
                      title={nb(s.name)}
                      sub={`${p.source === "brought" ? "Bringing" : p.source === "catalog" ? "New" : "Yours"} · ${cm(s.w)}\u00a0×\u00a0${cm(s.d)} cm`}
                      price={s.product ? priceLabel(s.product, true) : undefined}
                      action="Place"
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft leading-relaxed py-2">
              Everything has a spot. Pieces you put away, or sorted as &ldquo;Move it&rdquo;, wait here until you place them.
            </p>
          )
        ) : (
          <>
            <ProposalCard
              added={layout.pieces.filter((p) => p.proposed && p.placed).length}
              chosen={layout.pieces.filter((p) => p.proposed && p.chosen).length}
              skipped={proposal?.skipped ?? []}
              confirmed={data.brief.confirmed}
              onTeach={() => setDeck(true)}
              onAsk={() => { setAsking(true); setSheetOpen(true); }}
              checkout={`/checkout/${id}`}
            />
            <p className="text-xs text-ink-faint leading-relaxed mb-3">
              Add more. Real pieces first ({REAL_CREDIT}; prices are estimates), then <span className="eyebrow text-amber text-[10px]">Sample</span> pieces with made-up prices.{data.taste ? " Sorted by what fits your taste." : ""}
            </p>
            <ul className="flex flex-col gap-2">
              {catalog.map(({ product, fit }) => {
                const twin = twinOf(product);
                return (
                  <li key={product.id}>
                    <Card
                      onPointerDown={(e) => startCardDrag(e, newPiece(product), product)}
                      onPlace={() => addProduct(product)}
                      thumb={<ProductThumb product={product} />}
                      title={nb(product.name)}
                      sub={`${KIND_ONE[product.category]} · ${cm(product.w)}\u00a0×\u00a0${cm(product.d)} cm`}
                      price={priceLabel(product, true)}
                      badges={[
                        product.real ? { text: `Real · ${product.real.brand}`, tone: "quiet" as const } : { text: "Sample", tone: "amber" as const },
                        twin && twin.price < product.price ? { text: `Lookalike ${money(twin.price)}`, tone: "amber" as const } : null,
                        fit !== null && fit >= GOOD_FIT ? { text: "Fits your taste", tone: "clay" as const } : null,
                      ]}
                      action="Add"
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </>
  );

  // closed on a phone: a strip of things to tap straight into the room (what's waiting first, then the catalog)
  const strip = (
    <div className="lg:hidden flex-1 min-h-0 flex flex-col">
      <div className="flex items-baseline justify-between px-4">
        <p className="text-xs text-ink-soft truncate">{tray.length ? "Tap to place, or add something new" : "Tap a piece in the room to react"}</p>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => setDeck(true)} className="text-xs text-ink-soft font-medium min-h-8">Teach me</button>
          <button onClick={() => setSheetOpen(true)} className="text-xs text-clay font-medium min-h-8">See all</button>
        </div>
      </div>
      <ul className="flex gap-2 overflow-x-auto overscroll-contain px-4 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] [scrollbar-width:none]">
        {tray.map((p) => {
          const s = shapes[p.key];
          return (
            <li key={p.key} className="shrink-0">
              <button onClick={() => placeFromTray(p.key)} className="w-[76px] flex flex-col items-center gap-1 text-[11px]" aria-label={`Place ${s.name}`}>
                <span className="relative">
                  {s.product ? <ProductThumb product={s.product} size="lg" /> : <Thumb color={s.color} kind={kindOf(s.category) ?? "box"} size="lg" />}
                  <span className="absolute -top-1 -right-1 rounded-full bg-amber-tint text-amber text-[9px] font-semibold px-1.5 py-0.5">Place</span>
                </span>
                <span className="w-full truncate text-ink">{s.name}</span>
              </button>
            </li>
          );
        })}
        {catalog.map(({ product }) => (
          <li key={product.id} className="shrink-0">
            <button onClick={() => addProduct(product)} className="w-[76px] flex flex-col items-center gap-1 text-[11px]" aria-label={`Add ${product.name}, ${priceLabel(product)}`}>
              <ProductThumb product={product} size="lg" />
              <span className="w-full truncate text-ink tabular-nums">{priceLabel(product, true)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-bg flex flex-col">
      {/* top bar: back, title, undo/redo, and the running cost (tap it for what's been added) */}
      <header className="glass relative z-10 h-14 shrink-0 border-b flex items-center gap-1 sm:gap-2 px-3 sm:px-4">
        <Link href={`/rooms/${id}`} aria-label="Back to your room" className="h-11 w-11 -ml-1 grid place-items-center rounded-full text-ink-soft hover:text-ink">
          <Icon name="back" />
        </Link>
        <div className="min-w-0 mr-auto leading-tight">
          <p className="eyebrow text-ink-faint">Plug &amp; Play</p>
          <h1 className="text-[1.25rem] leading-tight overflow-hidden text-ellipsis whitespace-nowrap" style={{ textWrap: "nowrap" }}>{/^room$/i.test(data.spec.name) ? "Your room" : data.spec.name}</h1>
        </div>
        <ToolButton icon="undo" label="Undo" onClick={undo} disabled={!hist?.past.length} compact />
        <ToolButton icon="redo" label="Redo" onClick={redo} disabled={!hist?.future.length} compact />
        <button
          onClick={() => {
            setShowAdded((s) => !s);
            setSwapping(false);
            setSheetOpen(true);
          }}
          aria-expanded={showAdded}
          aria-label={`New pieces, ${cost.estimated ? "about " : ""}${money(cost.total)}${cost.estimated ? ", including estimates" : ""}. Show what you've added`}
          title={cost.estimated ? "What you've added (real pieces are estimates until checkout)" : "What you've added"}
          className="ml-1 shrink-0 whitespace-nowrap rounded-full bg-clay text-on-clay pl-3 pr-3 h-10 flex items-center gap-1.5 tabular-nums hover:opacity-90"
        >
          <span className="text-xs opacity-85">New<span className="hidden sm:inline"> pieces</span> ·</span>
          <span className="font-semibold">{cost.estimated || cost.unpriced ? "≈" : ""}{money(cost.total)}</span>
          {cost.count > 0 && <span className="grid place-items-center h-5 min-w-5 px-1 rounded-full bg-bg/20 text-[11px]">{cost.count}</span>}
        </button>
        <Link href={`/checkout/${id}`} aria-label="Next: review and buy" title="Next: review and buy" className="ml-1 shrink-0 h-10 rounded-full border border-line-strong px-3 flex items-center gap-1.5 text-sm hover:bg-surface-2">
          <span className="hidden md:inline">Review and buy</span>
          <Icon name="arrow" size={16} />
        </Link>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* the room */}
        <div className="relative flex-1 min-h-0 bg-surface-2">
          <PlayScene
            url={data.glbUrl}
            hdri={data.hdri}
            wallTint={data.wallTint}
            footprint={footprint}
            pieces={layout.pieces}
            shapes={shapes}
            selected={selected}
            view={view}
            keepClear={zones}
            onFixed={onFixed}
            onSelect={onSelect}
            onMove={onMove}
            onRefuse={onRefuse}
            apiRef={api}
          />
          <div className="glass absolute top-3 left-3 grid grid-cols-2 gap-0.5 rounded-full p-0.5 text-sm shadow-[var(--shadow-1)]">
            {([["3d", "3D", "cube"], ["top", "From above", "plan"]] as const).map(([v, l, ic]) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`h-9 px-3.5 rounded-full flex items-center gap-1.5 transition-colors ${view === v ? "bg-ink text-bg" : "text-ink-soft hover:text-ink"}`}>
                <Icon name={ic} size={16} />
                {l}
              </button>
            ))}
          </div>
          {!sel && (
            <p className="hidden lg:block absolute top-4 right-4 text-xs text-ink-soft bg-surface/80 backdrop-blur rounded-full px-3 py-1.5">
              Drag a piece to move it · drag the room to look around
            </p>
          )}
          {!sel && !touched && (
            <p className="lg:hidden absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-ink-soft bg-surface/90 backdrop-blur rounded-full px-3 py-1.5 shadow-sm">
              Tap a piece to pick it up · drag to look around
            </p>
          )}
          {toast && (
            <div role="status" className="absolute top-[60px] inset-x-3 mx-auto w-fit max-w-full flex items-center gap-1 rounded-full bg-surface/95 backdrop-blur border shadow-[var(--shadow-2)] pl-4 pr-1 py-1 text-sm animate-[rise_0.25s_ease-out]">
              <span className="whitespace-nowrap py-1.5 pr-2">{toast.text}</span>
              {toast.action && (
                <button onClick={toast.action.run} className="whitespace-nowrap rounded-full bg-clay text-on-clay font-medium px-3 min-h-9">
                  <span className="sm:hidden">{toast.action.short}</span>
                  <span className="hidden sm:inline">{toast.action.label}</span>
                </button>
              )}
            </div>
          )}

          {follow && (
            <div role="status" className="absolute top-[60px] inset-x-3 mx-auto max-w-md rounded-2xl bg-surface/97 backdrop-blur border shadow-[var(--shadow-2)] p-3 text-sm animate-[rise_0.25s_ease-out] z-[1]">
              <p className="font-medium">The room followed: {follow.result.proposals.length} small change{follow.result.proposals.length === 1 ? "" : "s"}{follow.result.total_cost ? ` · ≈+${money(follow.result.total_cost)}` : ""}</p>
              <ul className="mt-1.5 flex flex-col gap-1 text-[13px] text-ink-soft">
                {follow.result.proposals.map((x) => <li key={x.key} className="leading-snug">{x.why}</li>)}
              </ul>
              <div className="mt-2.5 flex gap-2 justify-end">
                <button onClick={() => { commit(follow.before); setFollow(null); }} className="btn btn-quiet btn-sm">Undo them</button>
                <button onClick={() => setFollow(null)} className="btn btn-primary btn-sm">Keep</button>
              </div>
            </div>
          )}

          {/* the toolbar for the selected piece; on a phone it steps aside while Change is open */}
          {sel && selShape && (
            <div key={sel.key} className={`absolute inset-x-0 bottom-3 flex-col items-center gap-2 px-3 pointer-events-none animate-[rise_0.22s_ease-out] ${swapOpen ? "hidden lg:flex" : "flex"}`}>
              <div className="pointer-events-auto max-w-[min(100%,440px)] flex items-center gap-1 rounded-2xl bg-surface/95 backdrop-blur pl-3 pr-1 py-1 shadow-sm">
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="text-sm truncate">
                    <span className="font-medium">{selShape.name}</span>
                    <span className="text-ink-soft"> · {selShape.product ? priceLabel(selShape.product) : sel.source === "brought" ? "Bringing" : "Yours"}</span>
                  </p>
                  {sel.why && sel.source === "catalog" && <p className="text-[11px] text-ink-soft leading-snug line-clamp-2">{sel.why}</p>}
                  {selShape.product?.real && (
                    <p className="text-[10px] text-ink-faint truncate">
                      {selShape.product.real.brand} · {REAL_CREDIT} ·{" "}
                      <a href={selShape.product.real.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">View listing</a>
                    </p>
                  )}
                </div>
                {sel.source !== "brought" && (
                  <>
                    <button onClick={() => reactTo(sel.key, 1)} aria-label="I like this" aria-pressed={!!selShape.product && prefs.liked.includes(selShape.product.id)} title="Like"
                      className={`h-10 w-10 shrink-0 grid place-items-center rounded-full ${selShape.product && prefs.liked.includes(selShape.product.id) ? "bg-sage-tint text-sage" : "text-ink-soft hover:text-sage hover:bg-surface-2"}`}>
                      <Icon name="like" size={19} />
                    </button>
                    <button onClick={() => reactTo(sel.key, -1)} aria-label="Not for me" aria-pressed={!!selShape.product && prefs.disliked.includes(selShape.product.id)} title="Not for me"
                      className={`h-10 w-10 shrink-0 grid place-items-center rounded-full ${selShape.product && prefs.disliked.includes(selShape.product.id) ? "bg-rust-tint text-rust" : "text-ink-soft hover:text-rust hover:bg-surface-2"}`}>
                      <Icon name="dislike" size={19} />
                    </button>
                  </>
                )}
              </div>
              <div className="pointer-events-auto flex items-stretch gap-0.5 rounded-2xl bg-surface/95 backdrop-blur p-1 shadow-[var(--shadow-2)] border max-w-full overflow-x-auto">
                {selShape.mount === "floor" ? (
                  <>
                    <ToolButton icon="turnLeft" label="90° left" onClick={() => rotate(90)} />
                    <ToolButton icon="turnRight" label="90° right" hint="R" onClick={() => rotate(-90)} />
                    <ToolButton icon="nudge" label="15°" hint="] or [" onClick={() => rotate(-15)} />
                  </>
                ) : (
                  <>
                    <ToolButton icon="raise" label="Higher" onClick={() => nudge("up", false)} />
                    <ToolButton icon="lower" label="Lower" onClick={() => nudge("down", false)} />
                  </>
                )}
                <ToolButton icon="change" label="Change" active={swapOpen} disabled={!selKind || selShape.fixed} onClick={() => openSwap()} />
                <ToolButton icon={sel.source === "catalog" ? "trash" : "tray"} label={sel.source === "catalog" ? "Remove" : "Put away"} onClick={() => putAway(sel.key)} />
                <ToolButton icon="close" label="Done" onClick={() => onSelect(null)} />
              </div>
            </div>
          )}
        </div>

        {/* the side panel on desktop, a bottom sheet on phones */}
        <aside
          className={`shrink-0 bg-surface border-t lg:border-t-0 lg:border-l flex flex-col min-h-0 lg:w-[380px] lg:h-auto transition-[height] duration-300 ease-out ${sheetOpen ? "h-[50dvh]" : "h-[calc(168px+env(safe-area-inset-bottom))]"}`}
        >
          <button className="lg:hidden h-6 shrink-0 grid place-items-center" onClick={() => setSheetOpen((o) => !o)} aria-label={sheetOpen ? "Lower the panel" : "Raise the panel"}>
            <span className="h-1 w-10 rounded-full bg-line-strong" />
          </button>
          {!sheetOpen && strip}
          <div className={`flex-1 min-h-0 flex-col ${sheetOpen ? "flex" : "hidden lg:flex"}`}>{panelBody}</div>
          <div className="hidden lg:flex shrink-0 border-t px-4 py-3 items-center justify-between gap-3 text-sm">
            <button className="text-ink-soft hover:text-ink text-left" onClick={() => setShowAdded((s) => !s)}>
              New pieces{cost.count ? ` (${cost.count})` : ""} · <span className="font-semibold text-ink tabular-nums">{cost.estimated || cost.unpriced ? "≈" : ""}{money(cost.total)}</span>
              {cost.estimated > 0 && <span className="block text-[11px] text-ink-faint">includes estimates</span>}
            </button>
            <Link href={`/checkout/${id}`} className="btn btn-primary btn-sm flex items-center gap-1.5">Next: review and buy <Icon name="arrow" size={15} /></Link>
          </div>
        </aside>
      </div>
      {deck && (
        <SwipeDeck
          seen={new Set(prefs.swiped)}
          onSwipe={(p, liked) => updatePrefs((x) => ({ ...react(x, p, liked ? 1 : -1), swiped: [...new Set([...x.swiped, p.id])] }))}
          onDone={() => { setDeck(false); refurnish(readPrefs()); }}
          onClose={() => setDeck(false)}
        />
      )}
      {walk && <Walkthrough onDone={() => { setWalk(false); updatePrefs((p) => ({ ...p, walkthroughSeen: true })); }} />}
    </div>
  );
}

function ToolButton({ icon, label, onClick, disabled, active, hint, compact }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; active?: boolean; hint?: string; compact?: boolean }) {
  if (compact) {
    return (
      <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="h-10 w-10 grid place-items-center rounded-full text-ink-soft hover:text-ink hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent">
        <Icon name={icon} />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint ? `${label} (${hint})` : label}
      className={`min-w-[54px] h-14 px-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors disabled:opacity-30 ${active ? "bg-clay text-on-clay" : "text-ink hover:bg-surface-2 active:bg-clay-tint"}`}
    >
      <Icon name={icon} size={20} />
      {label}
    </button>
  );
}

const TONE = { amber: "bg-amber-tint text-amber", clay: "bg-clay-tint text-clay", quiet: "bg-surface-2 text-ink-soft" } as const;
type Badge = { text: string; tone: keyof typeof TONE } | null | undefined | false;

function Badges({ list }: { list: Badge[] }) {
  const shown = list.filter(Boolean) as { text: string; tone: keyof typeof TONE }[];
  if (!shown.length) return null;
  return (
    <span className="flex flex-wrap gap-1 mt-1">
      {shown.map((b) => <span key={b.text} className={`rounded-full text-[11px] font-medium px-2 py-0.5 ${TONE[b.tone]}`}>{b.text}</span>)}
    </span>
  );
}

function Card({ onPointerDown, onPlace, thumb, title, sub, price, badges = [], action }: {
  onPointerDown: (e: React.PointerEvent) => void; onPlace: () => void; thumb: React.ReactNode; title: string; sub: string; price?: string; badges?: Badge[]; action: string;
}) {
  return (
    <div onPointerDown={onPointerDown} className="group flex items-center gap-3 rounded-2xl bg-surface-2 p-2 pr-2 hover:bg-line lg:cursor-grab active:lg:cursor-grabbing select-none">
      {thumb}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug line-clamp-2">{title}</p>
        <p className="text-xs text-ink-faint mt-0.5 truncate">{sub}</p>
        <Badges list={badges} />
      </div>
      {price && <p className="text-sm font-medium tabular-nums">{price}</p>}
      <button onClick={onPlace} className="h-9 min-w-[64px] px-4 rounded-full bg-ink text-bg text-sm font-medium hover:opacity-85 transition-opacity">
        {action}
      </button>
    </div>
  );
}

function Thumb({ color, kind, size = "md" }: { color: string; kind: string; size?: keyof typeof THUMB }) {
  return (
    <span className={`${THUMB[size]} shrink-0 rounded-lg bg-surface-2 grid place-items-center`}>
      <svg width="36" height="36" viewBox="0 0 34 34" aria-hidden>
        <ThumbShape kind={kind} color={color} />
      </svg>
    </span>
  );
}

// small category drawings, filled with the piece's own color (their own pieces, and before renders are ready)
function ThumbShape({ kind, color }: { kind: string; color: string }) {
  const s = { fill: color, stroke: "rgba(0,0,0,0.28)", strokeWidth: 1 };
  switch (kind) {
    case "sofa":
      return <g {...s}><rect x="3" y="12" width="28" height="11" rx="3" /><rect x="2" y="16" width="5" height="10" rx="2" /><rect x="27" y="16" width="5" height="10" rx="2" /><rect x="7" y="19" width="20" height="6" rx="1.5" /></g>;
    case "chair":
      return <g {...s}><rect x="9" y="8" width="16" height="14" rx="4" /><rect x="6" y="16" width="5" height="11" rx="2" /><rect x="23" y="16" width="5" height="11" rx="2" /><rect x="10" y="21" width="14" height="6" rx="1.5" /></g>;
    case "rug":
      return <g {...s}><rect x="3" y="9" width="28" height="16" rx="1.5" /><rect x="7" y="13" width="20" height="8" rx="1" fill="none" /></g>;
    case "lamp":
      return <g {...s}><path d="M11 5h12l3 8H8z" /><rect x="16" y="13" width="2" height="15" /><rect x="11" y="27" width="12" height="3" rx="1.5" /></g>;
    case "table":
      return <g {...s}><rect x="3" y="12" width="28" height="4" rx="1.5" /><rect x="6" y="16" width="3" height="11" /><rect x="25" y="16" width="3" height="11" /></g>;
    case "shelf":
      return <g {...s}><rect x="8" y="3" width="18" height="28" rx="1" /><path d="M8 10h18M8 17h18M8 24h18" fill="none" /></g>;
    case "art":
      return <g {...s}><rect x="6" y="6" width="22" height="22" rx="1" /><circle cx="15" cy="15" r="5" fill="rgba(255,255,255,0.5)" /></g>;
    default:
      return <g {...s}><rect x="6" y="9" width="22" height="18" rx="2.5" /><path d="M6 14h22" fill="none" /></g>;
  }
}

function PanelHead({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return (
    <div className="px-3 lg:px-4 pt-1 lg:pt-3 pb-2 flex items-center gap-2 shrink-0">
      <button onClick={onClose} aria-label="Back" className="h-9 w-9 -ml-1 grid place-items-center rounded-full text-ink-soft hover:text-ink">
        <Icon name="back" size={18} />
      </button>
      <div className="min-w-0">
        <p className="eyebrow text-ink-faint">{eyebrow}</p>
        <p className="font-display text-[1.25rem] leading-tight truncate">{title}</p>
      </div>
    </div>
  );
}

function AddedPanel({ roomId, pieces, shapes, total, estimated, onClose, onPick, onRemove }: {
  roomId: string; pieces: Piece[]; shapes: Record<string, Shape>; total: number; estimated: boolean; onClose: () => void; onPick: (key: string) => void; onRemove: (key: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PanelHead eyebrow="What you've added" title={`${estimated ? "≈" : ""}${money(total)} in new pieces`} onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 lg:px-4 pb-3 flex flex-col gap-2">
        {pieces.length === 0 && (
          <p className="text-sm text-ink-soft leading-relaxed">Nothing new yet. Add a piece from the catalog, or Swap one of yours, and it shows up here with its price.</p>
        )}
        {pieces.map((p) => {
          const product = shapes[p.key]?.product;
          if (!product) return null;
          return (
            <div key={p.key} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2">
              <button onClick={() => onPick(p.key)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <ProductThumb product={product} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug">{nb(product.name)}</span>
                  <span className="block text-xs text-ink-faint">{p.source === "room" ? "In place of one of yours" : !p.placed ? "Waiting for a spot" : KIND_ONE[product.category]}</span>
                </span>
                <span className="text-sm font-medium tabular-nums">{priceLabel(product, true)}</span>
              </button>
              <button onClick={() => onRemove(p.key)} aria-label={p.source === "room" ? `Back to your own piece instead of ${product.name}` : `Remove ${product.name}`} className="h-10 w-10 grid place-items-center rounded-full text-ink-soft hover:text-rust">
                <Icon name={p.source === "room" ? "undo" : "trash"} size={18} />
              </button>
            </div>
          );
        })}
        <p className="text-[11px] text-ink-faint mt-1">Your own pieces stay free. Real pieces show estimates ({REAL_CREDIT}); sample pieces have made-up prices.</p>
        <Link href={`/checkout/${roomId}`} className="btn btn-primary w-full mt-1 flex items-center justify-center gap-1.5">Next: review and buy <Icon name="arrow" size={16} /></Link>
      </div>
    </div>
  );
}

/** The proposal at a glance, with the two ways to steer it: swipe, or talk to the designer. */
function ProposalCard({ added, chosen, skipped, confirmed, onTeach, onAsk, checkout }: {
  added: number; chosen: number; skipped: ProposalResult["skipped"]; confirmed: boolean; onTeach: () => void; onAsk: () => void; checkout: string;
}) {
  return (
    <div className="rounded-2xl border p-3 mb-4">
      <p className="eyebrow text-ink-faint">{confirmed ? "From your brief" : "A first proposal"}</p>
      <p className="mt-1 text-sm leading-snug">
        {added ? `${added} new piece${added === 1 ? "" : "s"} around what you're keeping${chosen ? `, ${chosen} of them yours now` : ""}. Tap any piece for why it's there.` : "Nothing new proposed: the room already has what it needs."}
        {!confirmed && " Finish your brief for a proposal that knows you."}
      </p>
      {skipped.length > 0 && <p className="mt-1 text-[11px] text-ink-faint">Left out: {skipped.map((x) => `${x.role.replace(/_/g, " ")} (${x.why})`).join("; ")}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={onTeach} className="btn btn-line btn-sm flex items-center justify-center gap-1.5"><Icon name="cards" size={15} /> Teach me your taste</button>
        <button onClick={onAsk} className="btn btn-line btn-sm flex items-center justify-center gap-1.5"><Icon name="chat" size={15} /> Ask your designer</button>
      </div>
      <Link href={checkout} className="mt-2 lg:hidden btn btn-primary btn-sm w-full flex items-center justify-center gap-1.5">Next: review and buy <Icon name="arrow" size={15} /></Link>
    </div>
  );
}
