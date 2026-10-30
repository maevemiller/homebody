import type { PreparedPhoto } from "./images";
import type { RoomSpec } from "./spec";

// Are the photos enough to build the room? The asks follow the capture checklist in
// docs/reference/capture/README.md: each corner, each wall, the floor, a wide shot, and a walkthrough video.

export const ASK = {
  corners: "Add a photo from each corner, facing into the room",
  walls: "Add a photo of each wall, straight on",
  floor: "Add one photo looking down at the floor",
  wide: "Add a wide shot from the doorway that shows two walls and the floor",
  video: "A short video walking slowly around the room helps most",
};

// Below this the read is mostly guesswork (one- and two-photo reads came back at 0.35–0.4)
export const MIN_CONFIDENCE = 0.5;

/** What the uploads hold: separate photos, panoramas and walkthrough videos. */
export function uploads(photos: PreparedPhoto[]) {
  const count = (kind: string) => new Set(photos.filter((p) => (p.kind ?? "photo") === kind).map((p) => p.source ?? p.file)).size;
  return { photos: count("photo"), panoramas: count("panorama"), videos: count("video") };
}

/** Before paying for a read: too few views to see the room at all. A panorama counts as three views, a video as many. */
export function beforeRead(photos: PreparedPhoto[]): string[] {
  const u = uploads(photos);
  const views = u.photos + u.panoramas * 3 + u.videos * 8;
  if (views >= 4) return [];
  return [ASK.corners, ASK.floor, ASK.video];
}

/**
 * After the read: stop when the read is unsure overall, can't see the floor, or sees fewer than two corners or walls.
 * The asks then cover every gap, in the checklist's words plus the read's own specific asks.
 */
export function afterRead(spec: RoomSpec, photos: PreparedPhoto[]): string[] {
  const cov = spec.coverage;
  const blocked = spec.confidence < MIN_CONFIDENCE || (cov && (!cov.floor_visible || cov.corners_seen < 2 || cov.walls_seen < 2));
  if (!blocked) return [];
  const asks: string[] = [];
  const add = (a: string) => !asks.includes(a) && asks.push(a);
  const most = Math.min(4, spec.footprint.length);
  if (!cov || cov.corners_seen < most) add(ASK.corners);
  if (cov && cov.walls_seen < most) add(ASK.walls);
  if (!cov || !cov.floor_visible) add(ASK.floor);
  if (cov && !cov.wide_shot) add(ASK.wide);
  for (const m of cov?.missing ?? []) if (asks.length < 5 && m.trim()) add(m.trim());
  if (!uploads(photos).videos) add(ASK.video);
  return asks;
}
