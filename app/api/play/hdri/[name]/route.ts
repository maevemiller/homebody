import { readFile } from "node:fs/promises";
import path from "node:path";

type Ctx = { params: Promise<{ name: string }> };

const DIR = path.join(process.cwd(), "blender", "assets", "hdri");

// The CC0 Poly Haven HDRIs the Blender build lights rooms with, so Plug & Play can light the room the
// same way. Read-only, plain names only (no paths), cached hard: the files never change under a name.
export async function GET(_req: Request, { params }: Ctx) {
  const { name } = await params;
  if (!/^[a-z0-9_]+\.hdr$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(path.join(DIR, name));
    return new Response(body, { headers: { "Content-Type": "image/vnd.radiance", "Cache-Control": "public, max-age=604800, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
