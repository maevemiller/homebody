import { execFile } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// macOS `sips` reads HEIC/JPEG/PNG and resizes without extra dependencies.
// Claude reads photos best around 1600px on the long side.
const LONG_EDGE = 1600;
const PANORAMA_RATIO = 2.2;

export interface PreparedPhoto {
  file: string; // file name inside the room's photos/ folder
  label: string; // how the photo is introduced to Claude
  kind?: "photo" | "panorama" | "video"; // what it came from, for the coverage check
  source?: number; // which upload (1-based)
}

export const VIDEO_EXT = /\.(mov|mp4|m4v)$/i;
// Frames taken from each walkthrough video, spread evenly across it
const FRAMES_PER_VIDEO = 10;

async function ffmpegPath() {
  for (const p of [process.env.FFMPEG_PATH, path.join(os.homedir(), ".local", "bin", "ffmpeg"), "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (p && (await access(p).then(() => true, () => false))) return p;
  }
  return null;
}

/** Pulls evenly spaced frames from a walkthrough video, sized like the photos. */
async function videoFrames(src: string, dir: string, n: string): Promise<string[]> {
  const ffmpeg = await ffmpegPath();
  if (!ffmpeg) throw new Error("Videos need ffmpeg on this computer. Add photos instead, or install ffmpeg.");
  // ffmpeg prints the duration while probing; there's no ffprobe here
  const probe = await run(ffmpeg, ["-hide_banner", "-i", src]).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
  const d = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(String(probe.stderr));
  const seconds = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0;
  const fps = seconds > 0 ? FRAMES_PER_VIDEO / seconds : 1;
  const pattern = path.join(dir, `video-${n}-%02d.jpg`);
  await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-vf", `fps=${fps.toFixed(5)},scale='min(${LONG_EDGE},iw)':-2`,
    "-frames:v", String(FRAMES_PER_VIDEO), "-q:v", "3", pattern]);
  return (await readdir(dir)).filter((f) => f.startsWith(`video-${n}-`)).sort();
}

async function size(file: string) {
  const { stdout } = await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]);
  const w = Number(/pixelWidth: (\d+)/.exec(stdout)?.[1]);
  const h = Number(/pixelHeight: (\d+)/.exec(stdout)?.[1]);
  return { w, h };
}

async function toJpeg(src: string, dest: string, crop?: { x: number; y: number; w: number; h: number }) {
  const args = ["-s", "format", "jpeg", "-s", "formatOptions", "82"];
  if (crop) args.push("-c", String(crop.h), String(crop.w), "--cropOffset", String(crop.y), String(crop.x));
  await run("sips", [...args, src, "--out", dest]);
  await run("sips", ["-Z", String(LONG_EDGE), dest]);
}

/** Converts raw uploads into Claude-ready JPEGs. Panoramas become 3–4 overlapping tiles. */
export async function preparePhotos(roomPhotosDir: string): Promise<PreparedPhoto[]> {
  const rawDir = path.join(roomPhotosDir, "raw");
  const raws = (await readdir(rawDir)).filter((f) => !f.startsWith(".")).sort();
  const out: PreparedPhoto[] = [];
  for (const [i, name] of raws.entries()) {
    const n = String(i + 1).padStart(2, "0");
    const src = path.join(rawDir, name);
    if (VIDEO_EXT.test(name)) {
      const frames = await videoFrames(src, roomPhotosDir, n);
      frames.forEach((file, k) => out.push({ file, label: `Photo ${i + 1} (walkthrough video, frame ${k + 1} of ${frames.length})`, kind: "video", source: i + 1 }));
      continue;
    }
    const { w, h } = await size(src);
    if (w / h < PANORAMA_RATIO) {
      const file = `photo-${n}.jpg`;
      await toJpeg(src, path.join(roomPhotosDir, file));
      out.push({ file, label: `Photo ${i + 1}`, kind: "photo", source: i + 1 });
      continue;
    }
    const tiles = Math.min(4, Math.ceil(w / h / 1.4));
    const tileW = Math.round(Math.min(w, h * 1.6));
    const step = (w - tileW) / (tiles - 1);
    for (let t = 0; t < tiles; t++) {
      const file = `photo-${n}${"abcd"[t]}.jpg`;
      await toJpeg(src, path.join(roomPhotosDir, file), { x: Math.round(step * t), y: 0, w: tileW, h });
      out.push({ file, label: `Photo ${i + 1} (panorama, part ${t + 1} of ${tiles}, left to right)`, kind: "panorama", source: i + 1 });
    }
  }
  return out;
}
