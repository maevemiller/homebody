import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRoomId, roomDir } from "@/lib/scan/store";

type Ctx = { params: Promise<{ id: string }> };

const HEX = /^#[0-9a-f]{6}$/i;

// The room's measured colors (look.json, written by the photo-look step), so Plug & Play can tint the
// walls and backdrop to match. Only the color fields; empty for rooms built without photos.
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isRoomId(id)) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const look = JSON.parse(await readFile(path.join(roomDir(id), "look.json"), "utf8")) as Record<string, unknown>;
    const pick = (k: string) => (typeof look[k] === "string" && HEX.test(look[k] as string) ? (look[k] as string) : undefined);
    return Response.json({ walls: pick("walls"), floor: pick("floor"), ceiling: pick("ceiling") });
  } catch {
    // built without photos: nothing measured, the page falls back to the spec's colors
    return Response.json({});
  }
}
