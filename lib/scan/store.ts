import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { RoomSpec } from "./spec";

// Rooms live on disk under data/rooms/<id>/ (gitignored). Local-only for now:
// a hosted version would swap this for object storage and a job queue.
export const ROOMS_DIR = path.join(process.cwd(), "data", "rooms");

// "needs-photos": the photos can't build the room yet; status.asks says what to add
export type Stage = "uploaded" | "reading" | "building" | "rendering" | "done" | "error" | "needs-photos";
export type Quality = "quick" | "full";

export interface RoomStatus {
  id: string;
  stage: Stage;
  message: string;
  createdAt: string;
  updatedAt: string;
  photos: { file: string; label: string }[];
  measurement: string;
  notes: string;
  quality: Quality;
  // the owner's answers from the capture flow (scope, access, what they have...);
  // kept for the AI profile, never shown back to them
  intake?: Record<string, unknown>;
  // built from typed measurements only: shape, doors and windows are guesses
  approximate?: boolean;
  // what to add when the photos aren't enough (stage "needs-photos"), from docs/reference/capture/README.md
  asks?: string[];
  // the owner chose to build with the photos they have
  anyway?: boolean;
  // the room's sides as the owner typed them, in meters; every build is fitted to them
  sides?: { length?: number | null; width?: number | null };
  // the owner confirmed or corrected the door height, so the scale is settled
  scaleChecked?: boolean;
  // set when Claude has corrected the spec against the renders
  refinedAt?: string;
  error?: string;
}

export interface BuildInfo {
  glb: string;
  renders: string[];
  seconds: number;
  quick: boolean;
  blender: string;
}

export const roomDir = (id: string) => path.join(ROOMS_DIR, id);

export function newRoomId() {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return `${stamp}-${Math.random().toString(36).slice(2, 6)}`;
}

export function isRoomId(id: string) {
  return /^[0-9]{12}-[a-z0-9]{4}$/.test(id);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

// Write to a temp file and rename, so a reader never sees a half-written file
async function writeJson(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, file);
}

// Blender's progress lines can fire status updates back to back; run them one at a
// time per room so a later update never interleaves with an earlier one
const queues = new Map<string, Promise<unknown>>();
function serial<T>(id: string, job: () => Promise<T>): Promise<T> {
  const run = (queues.get(id) ?? Promise.resolve()).then(job, job);
  queues.set(id, run.catch(() => {}));
  return run;
}

export async function createRoom(status: Omit<RoomStatus, "createdAt" | "updatedAt">) {
  await mkdir(path.join(roomDir(status.id), "photos"), { recursive: true });
  const now = new Date().toISOString();
  await writeJson(path.join(roomDir(status.id), "status.json"), { ...status, createdAt: now, updatedAt: now });
}

export const getStatus = (id: string) => readJson<RoomStatus>(path.join(roomDir(id), "status.json"));
export const getSpec = (id: string) => readJson<RoomSpec>(path.join(roomDir(id), "spec.json"));
export const getBuild = (id: string) => readJson<BuildInfo>(path.join(roomDir(id), "build", "build.json"));

export function updateStatus(id: string, patch: Partial<RoomStatus>) {
  return serial(id, async () => {
    const current = await getStatus(id);
    if (!current) throw new Error(`No room ${id}`);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await writeJson(path.join(roomDir(id), "status.json"), next);
    return next;
  });
}

export async function saveSpec(id: string, spec: RoomSpec) {
  await writeJson(path.join(roomDir(id), "spec.json"), spec);
}

export async function listRooms() {
  let ids: string[] = [];
  try {
    ids = (await readdir(ROOMS_DIR)).filter(isRoomId);
  } catch {
    return [];
  }
  const rooms = await Promise.all(ids.map(async (id) => {
    const [status, spec] = await Promise.all([getStatus(id), getSpec(id)]);
    return status ? { id, stage: status.stage, createdAt: status.createdAt, name: spec?.name ?? null, photos: status.photos.length } : null;
  }));
  return rooms.filter((r) => r !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
