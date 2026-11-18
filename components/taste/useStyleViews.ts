"use client";

import { useEffect, useSyncExternalStore } from "react";
import { setStyleShot, setStyleStatus, STYLE_PRESETS, STYLE_SHOTS, styleVersion, subscribeStyles } from "@/lib/taste/styleviews";

// Her room, restyled for "which of these could you live in" (lib/taste/styleviews.ts). Starts once
// per page: finds the room Space Capture left in this browser, reuses views already rendered for that
// build, or renders them offscreen in the background while the conversation runs. With no room, no
// WebGL or any failure the status stays "none" and the set shows the stock photos.
// Returns a version that changes as views land, so the page redraws the pictures.

const CACHE = "homebody-styleviews";
let started = false;

function hasWebGL(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

async function start() {
  let roomId: string | undefined;
  try {
    roomId = JSON.parse(localStorage.getItem("homebody-capture") ?? "{}").roomId;
  } catch {}
  if (!roomId || !hasWebGL()) return;
  const room = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const build = room?.build as { seconds?: number } | null;
  if (!build) return;
  const key = `${roomId}:${build.seconds ?? 0}:${room.status?.refinedAt ?? ""}`;
  // the same build already rendered in this browser
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE) ?? "null") as { key: string; shots: Record<string, string> } | null;
    if (saved?.key === key && STYLE_PRESETS.every((p) => saved.shots[p.id])) {
      for (const p of STYLE_PRESETS) STYLE_SHOTS.set(p.id, saved.shots[p.id]);
      setStyleStatus("ready");
      return;
    }
  } catch {}
  setStyleStatus("loading");
  try {
    const { renderStyleViews } = await import("@/lib/taste/styleviews-render");
    const url = `/api/rooms/${roomId}/files/build/room.glb?v=${build.seconds ?? 0}-${room.status?.refinedAt ?? ""}`;
    await renderStyleViews(url, STYLE_PRESETS, setStyleShot);
    if (STYLE_PRESETS.some((p) => !STYLE_SHOTS.get(p.id))) throw new Error("missing views");
    setStyleStatus("ready");
    try {
      localStorage.setItem(CACHE, JSON.stringify({ key, shots: Object.fromEntries(STYLE_PRESETS.map((p) => [p.id, STYLE_SHOTS.get(p.id)])) }));
    } catch {}
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("Style views fell back to photos:", e);
    setStyleStatus("none");
  }
}

export function useStyleViews(): number {
  useEffect(() => {
    if (started) return;
    // after the page has settled, so the room's download never competes with the first line
    const t = setTimeout(() => {
      if (started) return;
      started = true;
      void start();
    }, 800);
    return () => clearTimeout(t);
  }, []);
  return useSyncExternalStore(subscribeStyles, styleVersion, () => 0);
}

// Just the version, for pieces of the page that show the pictures
export const useStyleVersion = () => useSyncExternalStore(subscribeStyles, styleVersion, () => 0);
