import { after } from "next/server";
import { processRoom, rebuildRoom, refineRoomModel, rescaleRoom } from "@/lib/scan/pipeline";
import { parseLength } from "@/lib/scan/scale";
import { getBuild, getSpec, getStatus, isRoomId, updateStatus } from "@/lib/scan/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isRoomId(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const [status, spec, build] = await Promise.all([getStatus(id), getSpec(id), getBuild(id)]);
  if (!status) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ status, spec, build });
}

// { action: "refine" } asks Claude to fix the model against the photos;
// { action: "rebuild", quality } re-runs Blender on the current spec.
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const status = isRoomId(id) ? await getStatus(id) : null;
  if (!status) return Response.json({ error: "Not found" }, { status: 404 });
  if (status.stage !== "done" && status.stage !== "error") {
    return Response.json({ error: "This room is still being built." }, { status: 409 });
  }
  const body = (await request.json().catch(() => ({}))) as { action?: string; quality?: string; doorHeight?: string };
  if (body.action === "confirm-scale") {
    await updateStatus(id, { scaleChecked: true });
    return Response.json({ ok: true });
  }
  if (body.action === "rescale") {
    // Scale so the modeled door matches the height the owner gave
    const said = parseLength(body.doorHeight ?? "");
    const door = (await getSpec(id))?.openings.find((o) => o.type === "door");
    const factor = said && door ? said / door.height : NaN;
    if (!(factor > 0.6 && factor < 1.6)) {
      return Response.json({ error: "We couldn't read that height. Try something like 6 ft 8 in or 203 cm." }, { status: 400 });
    }
    after(() => rescaleRoom(id, factor, `the owner said the door is ${body.doorHeight}`));
    return Response.json({ ok: true, factor });
  }
  // A failed first build: read the kept photos again from the start
  if (body.action === "retry") {
    after(() => processRoom(id));
    return Response.json({ ok: true });
  }
  if (body.action === "refine") after(() => refineRoomModel(id));
  else if (body.action === "rebuild") after(() => rebuildRoom(id, body.quality === "full" ? "full" : "quick"));
  else return Response.json({ error: "Unknown action" }, { status: 400 });
  return Response.json({ ok: true });
}
