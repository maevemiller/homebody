import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readRoom, refineRoom, rendersFor } from "./analyze";
import { preparePhotos } from "./images";
import { fitToSides, scaleSpec } from "./scale";
import { Quality, getBuild, getSpec, getStatus, roomDir, saveSpec, updateStatus } from "./store";

const BLENDER = process.env.BLENDER_PATH ?? "/Applications/Blender.app/Contents/MacOS/Blender";
const SCRIPT = path.join(process.cwd(), "blender", "build_room.py");
const ASSETS = path.join(process.cwd(), "blender", "assets");
const LOOK_SCRIPT = path.join(process.cwd(), "blender", "photo_look.py");
const POSES_SCRIPT = path.join(process.cwd(), "scripts", "photo_poses.swift");
// Object Capture needs an overlapping sequence; fewer photos than this can't be posed, so don't try
const MIN_POSE_PHOTOS = 8;

const exists = (p: string) => access(p).then(() => true, () => false);

// One job per room at a time; a second click while it's busy is ignored.
const busy = new Set<string>();

// One Blender at a time across all rooms: this Mac has 8 GB shared with the GPU, and two or three Cycles
// renders at once run it out of memory. Later jobs wait their turn.
let blenderQueue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  const run = blenderQueue.then(job, job);
  blenderQueue = run.catch(() => {});
  return run;
}

const STAGE_MESSAGES: Record<string, string> = {
  shell: "Building walls, floor, doors and windows",
  items: "Modeling your furniture",
  export: "Saving the 3D model",
  render: "Rendering realistic views",
};

function runBlender(id: string, quality: Quality) {
  const dir = roomDir(id);
  const out = path.join(dir, "build");
  const args = ["-b", "--factory-startup", "-P", SCRIPT, "--", path.join(dir, "spec.json"), out, ASSETS];
  if (quality === "quick") args.push("--quick");
  return exists(path.join(dir, "look.json")).then((look) => {
    if (look) args.push("--look", path.join(dir, "look.json"));
    return oneAtATime(() => spawnBlender(id, args, out));
  });
}

function spawnBlender(id: string, args: string[], out: string) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(BLENDER, args);
    let log = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      log += text;
      for (const line of text.split("\n")) {
        const m = /^HB:(\w+) ?(.*)$/.exec(line.trim());
        if (!m || !STAGE_MESSAGES[m[1]]) continue;
        const detail = m[1] === "render" ? ` (${m[2].replace("render_", "").replace("_", " ")})` : "";
        void updateStatus(id, { stage: m[1] === "render" ? "rendering" : "building", message: STAGE_MESSAGES[m[1]] + detail });
      }
    });
    proc.stderr.on("data", (chunk: Buffer) => (log += chunk.toString()));
    proc.on("error", (err) => reject(new Error(`Couldn't start Blender at ${BLENDER}: ${err.message}`)));
    proc.on("close", async (code) => {
      await mkdir(out, { recursive: true });
      await writeFile(path.join(out, "blender.log"), log);
      if (code === 0) resolve();
      else reject(new Error(`Blender stopped with code ${code}. Last lines:\n${log.trim().split("\n").slice(-8).join("\n")}`));
    });
  });
}

async function guarded(id: string, job: () => Promise<void>) {
  if (busy.has(id)) return;
  busy.add(id);
  try {
    await job();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scan ${id}]`, message);
    await updateStatus(id, { stage: "error", message: "Something went wrong", error: message });
  } finally {
    busy.delete(id);
  }
}

/** Runs a helper to completion and returns its output; never throws (the photo steps are extras, not the build). */
function runTool(cmd: string, args: string[], timeoutMs: number) {
  return new Promise<{ ok: boolean; log: string }>((resolve) => {
    let log = "";
    let proc;
    try {
      proc = spawn(cmd, args);
    } catch (err) {
      resolve({ ok: false, log: String(err) });
      return;
    }
    const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
    proc.stdout.on("data", (c: Buffer) => (log += c.toString()));
    proc.stderr.on("data", (c: Buffer) => (log += c.toString()));
    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, log: log + String(err) });
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, log });
    });
  });
}

/**
 * The free, on-device photo steps, after the spec exists: camera poses from Object Capture when there are enough
 * overlapping photos, then measured colors and matched light (look.json, which the Blender build picks up).
 */
async function measurePhotos(id: string, photos: { file: string }[]) {
  const dir = roomDir(id);
  const stills = photos.map((p) => p.file).filter((f) => /^photo-\d+\.jpg$/.test(f));
  if (!stills.length) return;
  await updateStatus(id, { stage: "building", message: "Measuring colors and light in your photos" });
  if (stills.length >= MIN_POSE_PHOTOS && process.platform === "darwin") {
    const r = await runTool("swift", [POSES_SCRIPT, path.join(dir, "poses.json"), ...stills.map((f) => path.join(dir, "photos", f))], 10 * 60_000);
    if (!r.ok) console.warn(`[scan ${id}] poses:`, r.log.trim().split("\n").slice(-3).join(" "));
  }
  const r = await runTool(BLENDER, ["-b", "--factory-startup", "-P", LOOK_SCRIPT, "--", path.join(dir, "spec.json"), path.join(dir, "photos"), path.join(dir, "look.json")], 3 * 60_000);
  if (!r.ok) console.warn(`[scan ${id}] look:`, r.log.trim().split("\n").slice(-3).join(" "));
}

const photoRefs = (id: string, photos: { file: string; label: string }[]) =>
  photos.map((p) => ({ path: path.join(roomDir(id), "photos", p.file), label: p.label }));

/** Photos → Claude room spec → Blender model and renders. */
export function processRoom(id: string) {
  return guarded(id, async () => {
    const status = await getStatus(id);
    if (!status) throw new Error("Room not found");
    await updateStatus(id, { stage: "reading", message: "Preparing your photos", error: undefined });
    const photos = await preparePhotos(path.join(roomDir(id), "photos"));
    await updateStatus(id, { photos, message: `Claude is reading ${photos.length} images of your room` });
    // Claude's read sets the layout; the owner's typed sides set the size
    const spec = fitToSides(await readRoom(photoRefs(id, photos), status.measurement, status.notes), status.sides);
    await saveSpec(id, spec);
    await measurePhotos(id, photos);
    await updateStatus(id, { stage: "building", message: STAGE_MESSAGES.shell });
    await runBlender(id, status.quality);
    await updateStatus(id, { stage: "done", message: "Your room is ready" });
  });
}

/** Claude compares the renders with the photos, corrects the spec, and Blender rebuilds. */
export function refineRoomModel(id: string) {
  return guarded(id, async () => {
    const [status, spec, build] = await Promise.all([getStatus(id), getSpec(id), getBuild(id)]);
    if (!status || !spec || !build) throw new Error("Build the room before fixing it");
    await updateStatus(id, { stage: "reading", message: "Claude is comparing the model with your photos", error: undefined });
    const versions = (await readdir(roomDir(id))).filter((f) => /^spec\.v\d+\.json$/.test(f)).length;
    await copyFile(path.join(roomDir(id), "spec.json"), path.join(roomDir(id), `spec.v${versions + 1}.json`));
    const renders = rendersFor(path.join(roomDir(id), "build"), build.renders);
    const fixed = fitToSides(await refineRoom(photoRefs(id, status.photos), renders, spec, status.measurement), status.sides);
    await saveSpec(id, fixed);
    await measurePhotos(id, status.photos);
    await updateStatus(id, { stage: "building", message: STAGE_MESSAGES.shell });
    await runBlender(id, status.quality);
    await updateStatus(id, { stage: "done", message: "Updated with Claude's fixes", refinedAt: new Date().toISOString() });
  });
}

/** The owner corrected the door height: scale the whole room to match and rebuild. */
export function rescaleRoom(id: string, factor: number, reason: string) {
  return guarded(id, async () => {
    const [status, spec] = await Promise.all([getStatus(id), getSpec(id)]);
    if (!status || !spec) throw new Error("Build the room before rescaling it");
    await updateStatus(id, { stage: "building", message: "Rescaling your room", error: undefined });
    const versions = (await readdir(roomDir(id))).filter((f) => /^spec\.v\d+\.json$/.test(f)).length;
    const backup = path.join(roomDir(id), `spec.v${versions + 1}.json`);
    await copyFile(path.join(roomDir(id), "spec.json"), backup);
    await saveSpec(id, scaleSpec(spec, factor, reason));
    try {
      await runBlender(id, status.quality);
    } catch (err) {
      // Put the unscaled spec back so trying again doesn't scale the room twice
      await copyFile(backup, path.join(roomDir(id), "spec.json"));
      throw err;
    }
    await updateStatus(id, { stage: "done", message: "Rescaled to your door", scaleChecked: true });
  });
}

/** Rebuilds from the current spec, e.g. at full render quality. */
export function rebuildRoom(id: string, quality: Quality) {
  return guarded(id, async () => {
    await updateStatus(id, { stage: "building", message: STAGE_MESSAGES.shell, quality, error: undefined });
    const status = await getStatus(id);
    if (status?.photos.length) await measurePhotos(id, status.photos);
    await runBlender(id, quality);
    await updateStatus(id, { stage: "done", message: quality === "full" ? "High-quality renders ready" : "Your room is ready" });
  });
}
