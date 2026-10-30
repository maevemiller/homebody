import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRoomId, roomDir } from "@/lib/scan/store";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
  ".json": "application/json",
};

type Ctx = { params: Promise<{ id: string; path: string[] }> };

// Serves a room's photos/ and build/ files. Only those two folders, and
// nothing that resolves outside the room's directory.
export async function GET(_req: Request, { params }: Ctx) {
  const { id, path: parts } = await params;
  if (!isRoomId(id) || !["photos", "build"].includes(parts[0]) || parts[1] === "raw") {
    return new Response("Not found", { status: 404 });
  }
  const base = roomDir(id);
  const file = path.resolve(base, ...parts);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!file.startsWith(base + path.sep) || !type) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
