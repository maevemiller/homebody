import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { VIDEO_EXT } from "./images";
import { roomDir } from "./store";

// Photos and walkthrough videos from the capture flow, checked and saved under the room's photos/raw/.
export const MAX_PHOTOS = 24;
export const MAX_VIDEOS = 2;
const IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp)$/i;

export const uploadFiles = (form: FormData) => form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

const isVideo = (f: File) => VIDEO_EXT.test(f.name) || f.type.startsWith("video/");

/** A plain error message when the uploads can't be used, or null. `already` counts what the room has. */
export function checkUploads(files: File[], already = { photos: 0, videos: 0 }): string | null {
  const bad = files.find((f) => !IMAGE_EXT.test(f.name) && !f.type.startsWith("image/") && !isVideo(f));
  if (bad) return `"${bad.name}" isn't a photo or video. Use JPEG, PNG, HEIC, MOV or MP4.`;
  const videos = files.filter(isVideo).length;
  if (already.photos + files.length - videos > MAX_PHOTOS) return `Use ${MAX_PHOTOS} photos or fewer.`;
  if (already.videos + videos > MAX_VIDEOS) return `Use ${MAX_VIDEOS} videos or fewer.`;
  return null;
}

/** What's already uploaded for a room. */
export async function savedUploads(id: string) {
  const raws = await readdir(path.join(roomDir(id), "photos", "raw")).catch(() => [] as string[]);
  const files = raws.filter((f) => !f.startsWith("."));
  const videos = files.filter((f) => VIDEO_EXT.test(f)).length;
  return { count: files.length, photos: files.length - videos, videos };
}

/** Saves uploads after whatever the room already has, numbered in order. */
export async function saveUploads(id: string, files: File[]) {
  const rawDir = path.join(roomDir(id), "photos", "raw");
  await mkdir(rawDir, { recursive: true });
  const start = (await savedUploads(id)).count;
  await Promise.all(files.map(async (f, i) => {
    const ext = (IMAGE_EXT.exec(f.name)?.[1] ?? VIDEO_EXT.exec(f.name)?.[1] ?? f.type.split("/")[1] ?? "jpg").toLowerCase().replace("quicktime", "mov");
    await writeFile(path.join(rawDir, `${String(start + i + 1).padStart(2, "0")}.${ext}`), Buffer.from(await f.arrayBuffer()));
  }));
}
