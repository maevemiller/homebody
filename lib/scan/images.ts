import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
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
    const { w, h } = await size(src);
    if (w / h < PANORAMA_RATIO) {
      const file = `photo-${n}.jpg`;
      await toJpeg(src, path.join(roomPhotosDir, file));
      out.push({ file, label: `Photo ${i + 1}` });
      continue;
    }
    const tiles = Math.min(4, Math.ceil(w / h / 1.4));
    const tileW = Math.round(Math.min(w, h * 1.6));
    const step = (w - tileW) / (tiles - 1);
    for (let t = 0; t < tiles; t++) {
      const file = `photo-${n}${"abcd"[t]}.jpg`;
      await toJpeg(src, path.join(roomPhotosDir, file), { x: Math.round(step * t), y: 0, w: tileW, h });
      out.push({ file, label: `Photo ${i + 1} (panorama, part ${t + 1} of ${tiles}, left to right)` });
    }
  }
  return out;
}
