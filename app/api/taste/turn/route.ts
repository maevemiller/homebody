import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DESIGNER_PROMPT } from "@/lib/taste/designer-prompt";
import { missing, newPace, OLD_SECTION, paceBrief, type Pace } from "@/lib/taste/pace";
import { BriefSchema, briefWithIds, EditSchema, MAX_TURNS, roomBrief, SECTIONS, treeBrief, TurnWireSchema, type Concept, type DossierItem, type Line, type WireTurn } from "@/lib/taste/session";
import type { SetId } from "@/lib/taste/visual";
import type { Answer, Known } from "@/lib/taste/questions";

// One turn of the Taste Builder conversation with the live designer (Claude Sonnet 5.5, for
// latency; thinking off). In: the conversation so far, what Space Capture knows, the
// answers, visual picks and the page. Out: a stream of NDJSON lines, the spoken line as it's
// written ({t:"say"}), then the whole validated turn ({t:"done"}). With no key, over the
// turn cap or on any error, the page falls back to the free interpreter (lib/taste/offline.ts).

const MODEL = "claude-sonnet-5-5";
// Which env var holds the key. Point it at a missing name to test the no-key fallback.
const KEY_ENV = "ANTHROPIC_API_KEY";
const USAGE = path.join(process.cwd(), "data", "usage", "taste.jsonl");

// turns per conversation, held here as well as counted by the page
const turnsBy = new Map<string, number>();

// A ceiling on all live turns in a day, whatever the page sends, so a stuck loop or
// many test runs can't run up a bill. About 150 turns is a few dollars at Sonnet prices.
const DAILY_CALLS = Number(process.env.TASTE_DAILY_CALLS) || 150;
async function callsToday() {
  const today = new Date().toISOString().slice(0, 10);
  const log = await readFile(USAGE, "utf8").catch(() => "");
  return log.split("\n").filter((l) => l.startsWith(`{"at":"${today}`)).length;
}

let client: Anthropic | null = null;

interface Body {
  convo: string;
  turns: number;
  section: string;
  known: Omit<Known, "answers">;
  answers: Record<string, Answer>;
  notes: string[];
  taste: string;
  // the visual sets they've already been shown
  shown?: string[];
  // pencil lines and guesses she never said or confirmed
  unconfirmed?: string[];
  page: (Pick<DossierItem, "id" | "zone" | "text" | "sure" | "crossed">)[];
  moods: string[];
  transcript: Line[];
  // the interview's length and progress (absent from older pages)
  pace?: Pace;
  // they just said they're finished with the previous section
  finished?: boolean;
  // the read-back brief already drawn: a correction edits it rather than writing a new one
  brief?: Concept;
}

// No key, or over a cap: an expected answer, not an error, so the page switches to the free
// interpreter quietly (a 4xx/5xx would put an error in the browser console every time)
const unavailable = (reason: string) =>
  new Response(`${JSON.stringify({ t: "unavailable", reason })}\n`, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const key = process.env[KEY_ENV];
  if (!key) return unavailable("no key");
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.convo !== "string" || !Array.isArray(body.transcript)) return Response.json({ error: "Bad request" }, { status: 400 });

  const used = Math.max(turnsBy.get(body.convo) ?? 0, body.turns ?? 0);
  if (used >= MAX_TURNS) return unavailable("turn cap");
  if ((await callsToday()) >= DAILY_CALLS) return unavailable("daily cap");
  turnsBy.set(body.convo, used + 1);

  client ??= new Anthropic({ apiKey: key });
  const k: Known = { ...body.known, answers: body.answers ?? {} };
  const convo = body.transcript.slice(-40).map((l) => `${l.who === "agent" ? "Designer" : "Client"}: ${l.event ? `[${l.text}]` : l.text}`).join("\n");
  const page = (body.page ?? []).map((e) => `- [${e.id}] ${e.zone}: ${e.crossed ? "(crossed out) " : ""}${e.text}${e.sure ? "" : " (pencil guess)"}`).join("\n");
  const section = OLD_SECTION[body.section] ?? body.section;
  const sectionLabel = SECTIONS.find((s) => s.id === section)?.label ?? section;
  const pace: Pace = { ...newPace(), ...(body.pace ?? {}) };
  const practical = (body.page ?? []).filter((e) => e.zone === "practical" && !e.crossed).map((e) => e.text);
  const prompt = [
    `# The room\n${roomBrief(body.known, body.transcript.filter((l) => l.who === "you" && !l.event).map((l) => l.text).join(" \n "))}`,
    `# The tree\n${treeBrief(k)}`,
    `# Personal details noted\n${(body.notes ?? []).join("\n") || "none yet"}`,
    `# Visual picks\n${body.taste || "none yet"}`,
    `# Unconfirmed: never put these in the concept statement or the read-back rows (she didn't say or confirm them)\n${(body.unconfirmed ?? []).map((x) => `- ${x}`).join("\n") || "none"}`,
    `# Their page so far\n${page || "empty"}${body.moods?.length ? `\nMood words: ${body.moods.join(", ")}` : ""}`,
    `# Where we are\nSection: ${section} (${sectionLabel}). Turn ${used + 1} of ${MAX_TURNS}.\nSets not shown yet: ${["rooms", "palettes", "materials", "patterns"].filter((x) => !(body.shown ?? []).includes(x)).join(", ") || "none"}\n${paceBrief(pace, section, { answers: k.answers, shown: (body.shown ?? []) as SetId[], practical }, !!body.finished)}`,
    `# The conversation\n${convo || "(nothing yet: open the conversation)"}`,
    "Write your next turn.",
  ].join("\n\n");

  const started = Date.now();
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
      const call = (format: ReturnType<typeof betaZodOutputFormat>, content: string) =>
        client!.beta.messages.stream({
          model: MODEL,
          max_tokens: 4000,
          // thinking off: latency matters more than deliberation for a spoken turn
          thinking: { type: "between_tools" },
          output_config: { effort: "low", format },
          // if a safety classifier declines, the API retries on a fallback model in the same call
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [{ type: "text", text: DESIGNER_PROMPT, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content }],
        });
      const textOf = (msg: Anthropic.Beta.BetaMessage) => {
        if (msg.stop_reason === "refusal") throw new Error("declined");
        if (msg.stop_reason === "max_tokens") throw new Error("cut off");
        return msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      };
      try {
        const s = call(betaZodOutputFormat(TurnWireSchema), prompt);
        let raw = "";
        let said = "";
        for await (const ev of s) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            raw += ev.delta.text;
            const say = sayOf(raw);
            if (say && say !== said) {
              said = say;
              send({ t: "say", text: say });
            }
          }
        }
        const msg = await s.finalMessage();
        await logUsage(body, msg, Date.now() - started);
        const turn: WireTurn = TurnWireSchema.parse(JSON.parse(textOf(msg)));
        const usage = { input: msg.usage.input_tokens, output: msg.usage.output_tokens, cached: msg.usage.cache_read_input_tokens ?? 0 };
        // at Quick, Extras is the minimum only: once it's covered, an anchor or story follow-up becomes the read-back
        const extrasDone = !missing(pace, "extras", { answers: k.answers, shown: (body.shown ?? []) as SetId[], practical }).length;
        if (pace.length === "quick" && turn.section === "extras" && extrasDone && /\b(one piece|work around|build around|everything else|anchor|your story|a little of your story)\b/i.test(turn.say) && turn.say.includes("?")) {
          turn.say = "That's all I need to go on. Here's what I heard. Tell me what I got wrong.";
          turn.section = "readback";
          turn.show = "none";
          turn.suggestions = [];
        }
        // at the read-back, the brief comes from a second, small call (one schema for both was too
        // large for structured output to compile)
        if (turn.section === "readback" && body.brief?.program !== undefined) {
          // a correction: edit operations against the brief's line ids, never a new brief
          const e = call(betaZodOutputFormat(EditSchema), `${prompt.replace(/Write your next turn\.$/, "")}# The brief as drawn (line ids)\n${briefWithIds(body.brief)}\n\nYour line just now: "${turn.say}"\n\nTheir correction is their last line above. Write the edits, following "Corrections as edits".`);
          const em = await e.finalMessage();
          await logUsage(body, em, Date.now() - started);
          turn.edits = EditSchema.parse(JSON.parse(textOf(em))).ops;
          usage.input += em.usage.input_tokens;
          usage.output += em.usage.output_tokens;
          usage.cached += em.usage.cache_read_input_tokens ?? 0;
        } else if (turn.section === "readback") {
          const b = call(betaZodOutputFormat(BriefSchema), `${prompt.replace(/Write your next turn\.$/, "")}Your line just now: "${turn.say}"\n\nWrite the read-back brief now, following "Readback (the brief)".`);
          const bm = await b.finalMessage();
          await logUsage(body, bm, Date.now() - started);
          turn.concept = BriefSchema.parse(JSON.parse(textOf(bm)));
          usage.input += bm.usage.input_tokens;
          usage.output += bm.usage.output_tokens;
          usage.cached += bm.usage.cache_read_input_tokens ?? 0;
        }
        send({ t: "done", turn, usage });
      } catch (e) {
        // the request itself was refused (a 4xx: a bad schema, a bad key, no credit): it won't get better
        // by retrying, so the page switches to the free interpreter for the rest of the conversation
        const status = e instanceof Anthropic.APIError ? e.status : undefined;
        if (process.env.NODE_ENV !== "production") console.error("[taste/turn]", status ?? "", e instanceof Error ? e.message : e);
        if (status && status >= 400 && status < 500 && status !== 429) send({ t: "unavailable", reason: `api ${status}` });
        else send({ t: "error", message: e instanceof Error ? e.message : "failed" });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

// The "say" field from partial JSON, as far as it's been written
function sayOf(raw: string): string | null {
  const m = raw.match(/"say"\s*:\s*"/);
  if (!m) return null;
  let out = "";
  for (let i = m.index! + m[0].length; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') return out;
    if (ch === "\\") {
      const nx = raw[i + 1];
      if (nx === undefined) break;
      if (nx === "u") {
        const hex = raw.slice(i + 2, i + 6);
        if (hex.length < 4) break;
        out += String.fromCharCode(parseInt(hex, 16));
        i += 5;
      } else {
        out += ({ n: "\n", t: "\t", r: "", b: "", f: "" } as Record<string, string>)[nx] ?? nx;
        i++;
      }
      continue;
    }
    out += ch;
  }
  return out;
}

async function logUsage(body: Body, msg: Anthropic.Beta.BetaMessage, ms: number) {
  const u = msg.usage;
  const row = {
    at: new Date().toISOString(), convo: body.convo, turn: (body.turns ?? 0) + 1, model: msg.model, ms,
    input: u.input_tokens, output: u.output_tokens, cache_read: u.cache_read_input_tokens ?? 0, cache_write: u.cache_creation_input_tokens ?? 0,
    stop: msg.stop_reason,
  };
  try {
    await mkdir(path.dirname(USAGE), { recursive: true });
    await appendFile(USAGE, `${JSON.stringify(row)}\n`);
  } catch {}
}
