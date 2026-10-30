import { readFile } from "node:fs/promises";
import path from "node:path";
import { after } from "next/server";
import { boxRoomSpec, parseMeasurements } from "@/lib/scan/boxRoom";
import { processRoom, rebuildRoom } from "@/lib/scan/pipeline";
import { fitToSides, sidesFromForm } from "@/lib/scan/scale";
import { createRoom, listRooms, newRoomId, saveSpec } from "@/lib/scan/store";
import { checkUploads, saveUploads, uploadFiles } from "@/lib/scan/uploads";

export async function GET() {
  return Response.json({ rooms: await listRooms() });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const files = uploadFiles(form);
  // The sample is only for an explicit ?sample=1 with nothing uploaded: real photos always build the real room
  if (form.get("sample") === "1" && files.length === 0) return sampleRoom(form);
  if (form.get("mode") === "measurements") return measuredRoom(form);
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Add ANTHROPIC_API_KEY to .env.local and restart the dev server." }, { status: 500 });
  }
  const measurement = String(form.get("measurement") ?? "").slice(0, 500);
  if (files.length === 0 && !measurement.trim()) {
    return Response.json({ error: "Add at least one photo, or the room's measurements." }, { status: 400 });
  }
  let intake: Record<string, unknown> | undefined;
  try {
    intake = JSON.parse(String(form.get("intake") ?? "null")) ?? undefined;
  } catch {}
  const problem = checkUploads(files);
  if (problem) return Response.json({ error: problem }, { status: 400 });

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
  await saveUploads(id, files);

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
