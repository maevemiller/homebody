import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { after } from "next/server";
import { boxRoomSpec, parseMeasurements } from "@/lib/scan/boxRoom";
import { processRoom, rebuildRoom } from "@/lib/scan/pipeline";
import { fitToSides, sidesFromForm } from "@/lib/scan/scale";
import { createRoom, listRooms, newRoomId, roomDir, saveSpec } from "@/lib/scan/store";

const MAX_PHOTOS = 24;
const IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp)$/i;

export async function GET() {
  return Response.json({ rooms: await listRooms() });
}

export async function POST(request: Request) {
  const form = await request.formData();
  if (form.get("sample") === "1") return sampleRoom(form);
  if (form.get("mode") === "measurements") return measuredRoom(form);
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Add ANTHROPIC_API_KEY to .env.local and restart the dev server." }, { status: 500 });
  }
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const measurement = String(form.get("measurement") ?? "").slice(0, 500);
  if (files.length === 0 && !measurement.trim()) {
    return Response.json({ error: "Add at least one photo, or the room's measurements." }, { status: 400 });
  }
  let intake: Record<string, unknown> | undefined;
  try {
    intake = JSON.parse(String(form.get("intake") ?? "null")) ?? undefined;
  } catch {}
  if (files.length > MAX_PHOTOS) return Response.json({ error: `Use ${MAX_PHOTOS} photos or fewer.` }, { status: 400 });
  const bad = files.find((f) => !IMAGE_EXT.test(f.name) && !f.type.startsWith("image/"));
  if (bad) return Response.json({ error: `"${bad.name}" isn't a photo. Use JPEG, PNG or HEIC.` }, { status: 400 });

  const id = newRoomId();
  const quality = form.get("quality") === "full" ? "full" : "quick";
  await createRoom({
    id,
    stage: "uploaded",
    message: "Photos received",
    photos: [],
    measurement,
    notes: String(form.get("notes") ?? "").slice(0, 1000),
    quality,
    intake,
    sides: sidesFromForm(form),
  });
  const rawDir = path.join(roomDir(id), "photos", "raw");
  await mkdir(rawDir, { recursive: true });
  await Promise.all(files.map(async (f, i) => {
    const ext = (IMAGE_EXT.exec(f.name)?.[1] ?? f.type.split("/")[1] ?? "jpg").toLowerCase();
    await writeFile(path.join(rawDir, `${String(i + 1).padStart(2, "0")}.${ext}`), Buffer.from(await f.arrayBuffer()));
  }));

  after(() => processRoom(id));
  return Response.json({ id });
}

// "Just the measurements": a box room from the typed size, no photos and no Claude call
async function measuredRoom(form: FormData) {
  const measurement = String(form.get("measurement") ?? "").slice(0, 500);
  const size = parseMeasurements(measurement);
  if (!size) {
    return Response.json({ error: "We couldn't read that. Try something like 14 × 10 ft, 8 ft ceiling." }, { status: 400 });
  }
  let intake: Record<string, unknown> | undefined;
  try {
    intake = JSON.parse(String(form.get("intake") ?? "null")) ?? undefined;
  } catch {}
  const id = newRoomId();
  await createRoom({ id, stage: "uploaded", message: "Building from your measurements", photos: [], measurement, notes: "", quality: "quick", intake, approximate: true });
  await saveSpec(id, boxRoomSpec(size, typeof intake?.room === "string" ? intake.room : "room", measurement));
  after(() => rebuildRoom(id, "quick"));
  return Response.json({ id });
}

// Builds the bundled sample spec without calling Claude, to try the Blender
// side and the viewer before an API key is set up.
// The typed sides apply here too, so the sample is built at the size the owner gave.
async function sampleRoom(form: FormData) {
  const id = newRoomId();
  const measurement = String(form.get("measurement") ?? "").slice(0, 500);
  const sides = sidesFromForm(form);
  await createRoom({ id, stage: "uploaded", message: "Using the sample room", photos: [], measurement, notes: "", quality: "quick", sides });
  const spec = JSON.parse(await readFile(path.join(process.cwd(), "blender", "sample_spec.json"), "utf8"));
  await saveSpec(id, fitToSides(spec, sides));
  after(() => rebuildRoom(id, "quick"));
  return Response.json({ id });
}
