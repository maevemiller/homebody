import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { FAMILY_IDS } from "@/lib/taste/visual";

// "Change this", in her own words: one small Claude Sonnet call that reads a line of feedback about one piece
// ("feels too heavy for the corner", "something my grandmother would have had") into the same chips the sheet
// offers. Only called when the free reader (lib/play/change.ts readWords) couldn't place her words. Its own
// daily cap and usage log (data/usage/play.jsonl), separate from the interview's.

const MODEL = "claude-sonnet-5-5";
const KEY_ENV = "ANTHROPIC_API_KEY";
const USAGE = path.join(process.cwd(), "data", "usage", "play.jsonl");
// About 60 short calls a day is well under a dollar at Sonnet prices.
const DAILY_CALLS = Number(process.env.PLAY_DAILY_CALLS) || 60;

async function callsToday() {
  const today = new Date().toISOString().slice(0, 10);
  const log = await readFile(USAGE, "utf8").catch(() => "");
  return log.split("\n").filter((l) => l.startsWith(`{"at":"${today}`)).length;
}

// small and flat, plain strings checked below: structured output compiles this into a grammar
const AskSchema = z.object({
  budget: z.string(),
  color: z.string(),
  color_hex: z.string(),
  color_word: z.string(),
  style: z.string(),
  material: z.string(),
  size: z.string(),
  shape: z.string(),
  heard: z.string(),
});

const SYSTEM = `You are an interior designer's assistant. A client gave feedback on one piece of furniture in their room. Translate it into search parameters for alternatives. Use "" for anything they didn't express; never guess beyond their words.
- budget: "less", "more" or ""
- color: "lighter", "darker", "warmer", "cooler", "bolder", "quieter" or ""
- color_hex: a hex color only if they named or clearly implied a specific color, else ""; color_word: that color in one or two plain words
- style: one of ${FAMILY_IDS.join(", ")}, or ""
- material: one of white_oak, walnut, linen, boucle, leather, wool, jute, brass, black_steel, limestone, reclaimed, or ""
- size: "smaller", "larger" or ""
- shape: "rounder", "straighter" or ""
- heard: their point in under 12 plain words, as a designer would note it (no filler).
"Too heavy" or "too much" usually means smaller or lighter; "cold" means warmer; "busy" means quieter.`;

let client: Anthropic | null = null;
const unavailable = (reason: string) => Response.json({ t: "unavailable", reason });
const pick = <T extends string>(xs: readonly T[], v: string) => ((xs as readonly string[]).includes(v) ? (v as T) : undefined);

export async function POST(req: Request) {
  const key = process.env[KEY_ENV];
  if (!key) return unavailable("no key");
  const body = (await req.json().catch(() => null)) as { text?: string; piece?: { name?: string; kind?: string; color?: string; material?: string } } | null;
  const text = body?.text?.trim().slice(0, 400);
  if (!text) return Response.json({ error: "Bad request" }, { status: 400 });
  if ((await callsToday()) >= DAILY_CALLS) return unavailable("daily cap");

  client ??= new Anthropic({ apiKey: key });
  const piece = body?.piece ?? {};
  const started = Date.now();
  try {
    const msg = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 600,
        thinking: { type: "between_tools" },
        output_config: { effort: "low", format: betaZodOutputFormat(AskSchema) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: `The piece: ${piece.name ?? "a piece"} (${piece.kind ?? "furniture"}, ${piece.material ?? "unknown material"}, color ${piece.color ?? "unknown"}).\nTheir feedback: "${text}"` }],
      })
      .finalMessage();
    await logUsage(msg, Date.now() - started);
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") return unavailable(msg.stop_reason);
    const raw = AskSchema.parse(JSON.parse(msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("")));
    const hex = /^#[0-9a-f]{6}$/i.test(raw.color_hex) ? raw.color_hex : undefined;
    return Response.json({
      t: "ok",
      ask: {
        budget: pick(["less", "more"] as const, raw.budget),
        color: pick(["lighter", "darker", "warmer", "cooler", "bolder", "quieter"] as const, raw.color),
        hex, colorWord: hex ? raw.color_word || undefined : undefined,
        style: pick(FAMILY_IDS, raw.style),
        material: pick(["white_oak", "walnut", "linen", "boucle", "leather", "wool", "jute", "brass", "black_steel", "limestone", "reclaimed"] as const, raw.material),
        size: pick(["smaller", "larger"] as const, raw.size),
        shape: pick(["rounder", "straighter"] as const, raw.shape),
      },
      heard: raw.heard,
    });
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    if (process.env.NODE_ENV !== "production") console.error("[play/interpret]", status ?? "", e instanceof Error ? e.message : e);
    return unavailable(status ? `api ${status}` : "failed");
  }
}

async function logUsage(msg: Anthropic.Beta.BetaMessage, ms: number) {
  const u = msg.usage;
  const row = {
    at: new Date().toISOString(), route: "play/interpret", model: msg.model, ms,
    input: u.input_tokens, output: u.output_tokens, cache_read: u.cache_read_input_tokens ?? 0, cache_write: u.cache_creation_input_tokens ?? 0, stop: msg.stop_reason,
  };
  try {
    await mkdir(path.dirname(USAGE), { recursive: true });
    await appendFile(USAGE, `${JSON.stringify(row)}\n`);
  } catch {}
}
