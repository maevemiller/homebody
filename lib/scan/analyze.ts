import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { RoomSpec, RoomSpecSchema } from "./spec";

const MODEL = "claude-opus-5-5";

// Every photo read is logged with its cost, and reads stop once the capture budget is spent.
const USAGE = path.join(process.cwd(), "data", "usage", "capture.jsonl");
const BUDGET_USD = Number(process.env.CAPTURE_BUDGET_USD ?? 10);
// $ per million tokens: input, output, cache read, cache write
const PRICES: Record<string, [number, number, number, number]> = {
  "claude-opus-5-5": [4, 20, 0.2, 5],
  "claude-opus-5": [5, 25, 0.5, 6.25],
  "claude-opus-4-8": [5, 25, 0.5, 6.25],
};

export async function captureSpend(): Promise<number> {
  try {
    const rows = (await readFile(USAGE, "utf8")).split("\n").filter(Boolean);
    return rows.reduce((t, r) => t + (Number((JSON.parse(r) as { usd?: number }).usd) || 0), 0);
  } catch {
    return 0;
  }
}

async function logUsage(kind: string, msg: Anthropic.Beta.BetaMessage, ms: number, images: number) {
  const u = msg.usage;
  const [pin, pout, pread, pwrite] = PRICES[msg.model] ?? PRICES[MODEL];
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const usd = (u.input_tokens * pin + u.output_tokens * pout + cacheRead * pread + cacheWrite * pwrite) / 1e6;
  const row = {
    at: new Date().toISOString(), kind, model: msg.model, ms, images,
    input: u.input_tokens, output: u.output_tokens, cache_read: cacheRead, cache_write: cacheWrite,
    usd: Math.round(usd * 10000) / 10000, stop: msg.stop_reason,
  };
  try {
    await mkdir(path.dirname(USAGE), { recursive: true });
    await appendFile(USAGE, `${JSON.stringify(row)}\n`);
  } catch {}
}

const SYSTEM = `You turn a homeowner's phone photos of one space into a precise, to-scale room spec. A builder reconstructs the spec in Blender, and the owner then sorts their furniture (keep in place, keep but move, remove) and tries new pieces in that model, so sizes and positions must be physically consistent with the photos.

How to work:
- Work out the room's shape first. Put footprint[0] at a corner and list corners counterclockwise as seen from above. Model only the main floor level; if there is a mezzanine or another level, say so in the summary.
- Set the scale from the owner's measurement when given. Otherwise use standard sizes: interior doors are about 2.03 m tall and 0.76–0.91 m wide, kitchen counters 0.91 m high, dining tables 0.75 m, sofa seats about 0.45 m, outlets about 0.3 m up. Say what you used in scale_basis.
- Panoramas arrive split into overlapping tiles; read the tiles of one panorama as a single continuous view.
- An object seen in several photos is one item. List furniture, rugs, lamps, plants, art, mirrors, curtains, TVs, bikes and other large objects. Skip small clutter such as boxes, cables, and things sitting on shelves or tabletops.
- Every item sits inside the footprint, clear of the walls, without overlapping other floor items (rugs can sit under things). Items against a wall face away from it. Wall-mounted or hanging things get an elevation.
- Report colors as the object's real color in neutral light, not its shadowed or blown-out look.
- Use confidence honestly: low for anything mostly hidden or guessed.
- In profile_signals, write what a designer would infer about the owner's taste, price level and lifestyle from what is in the room.
- Describe sloped or beamed ceilings in ceiling, mark built-in pieces (cladding, slats, fireplaces, floating shelves, accent panels) with fixed: true, and say in outdoor_view what the windows look onto.
- In photo_marks, give each photo 6–10 points you can see clearly and whose room coordinates follow from the spec (room corners at floor and ceiling, door and window corners), spread over at least two walls or the floor and a wall.
- In photo_regions, mark where the true colors can be measured: for each photo, a few small boxes on clean, evenly lit, unshadowed patches of the wall paint, the floor, the ceiling, and the main surface of each large item (a sofa's seat, a table's top, a rug's open field). Avoid highlights, windows, shadows, patterns and edges. Boxes are fractions of the photo's width and height, x0 < x1 and y0 < y1, measured from the top left.
- In coverage, say honestly how much of the room the photos show: corners and walls you can actually see, whether open floor is visible, and whether any photo is a wide shot. If something is missing, write up to 3 short, specific asks the owner can act on (which wall, from where). Set the overall confidence low when the photos don't show enough to build the room.`;

let client: Anthropic | null = null;
const claude = () => (client ??= new Anthropic());

export interface PhotoRef {
  path: string;
  label: string;
}

async function imageBlocks(photos: PhotoRef[]): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const p of photos) {
    const data = (await readFile(p.path)).toString("base64");
    const media_type = p.path.endsWith(".png") ? "image/png" : "image/jpeg";
    blocks.push({ type: "text", text: p.label });
    blocks.push({ type: "image", source: { type: "base64", media_type, data } });
  }
  return blocks;
}

async function requestSpec(content: Anthropic.Beta.BetaContentBlockParam[], kind: string): Promise<RoomSpec> {
  const spent = await captureSpend();
  if (spent >= BUDGET_USD) {
    throw new Error(`The photo-reading budget ($${BUDGET_USD}) is used up ($${spent.toFixed(2)} spent). Raise CAPTURE_BUDGET_USD to read more rooms.`);
  }
  const started = Date.now();
  const stream = claude().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(RoomSpecSchema) },
    // If a safety classifier declines, the API retries on a fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  const message = await stream.finalMessage();
  await logUsage(kind, message, Date.now() - started, content.filter((b) => b.type === "image").length);
  if (message.stop_reason === "refusal") {
    throw new Error(`Claude declined to read these photos${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : "."}`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("The room description was cut off before it finished. Try fewer photos.");
  }
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return RoomSpecSchema.parse(JSON.parse(text));
}

/** Reads the owner's photos and returns a to-scale room spec. */
export async function readRoom(photos: PhotoRef[], measurement: string, notes: string): Promise<RoomSpec> {
  const content = await imageBlocks(photos);
  content.push({
    type: "text",
    text: [
      photos.length
        ? `These are ${photos.length} images of one space.`
        : "There are no photos of this space yet. Build a plausible empty room from the measurements and notes below, and list no items.",
      measurement ? `The owner measured: ${measurement}` : "The owner did not give a measurement, so set the scale from standard sizes.",
      notes ? `Owner's notes: ${notes}` : "",
      "Write the room spec.",
    ].filter(Boolean).join("\n"),
  });
  return requestSpec(content, "read");
}

/** Compares renders of the current model to the photos and returns a corrected spec. */
export async function refineRoom(photos: PhotoRef[], renders: PhotoRef[], spec: RoomSpec, measurement: string): Promise<RoomSpec> {
  const content = await imageBlocks(photos);
  content.push({ type: "text", text: "Renders of the 3D model built from the current spec:" });
  content.push(...(await imageBlocks(renders)));
  content.push({
    type: "text",
    text: [
      "Current spec:",
      JSON.stringify(spec),
      measurement ? `The owner measured: ${measurement}` : "",
      "Compare the model with the photos and return the full corrected spec. Fix sizes, positions and rotations that don't match, missing or extra items, wrong openings, and wrong colors or materials. Keep the ids of items that are still there.",
    ].filter(Boolean).join("\n"),
  });
  return requestSpec(content, "refine");
}

export const rendersFor = (buildDir: string, files: string[]): PhotoRef[] =>
  files.map((f) => ({ path: path.join(buildDir, f), label: `Render: ${f.replace(/^render_|\.png$/g, "").replace("_", " ")}` }));
