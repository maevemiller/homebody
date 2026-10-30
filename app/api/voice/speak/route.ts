import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// The agent's voice: one line of text in, ElevenLabs audio out. The key stays
// here on the server. Lines repeat across conversations ("Got it."), so each
// is cached on disk and only paid for once. With no key set, 503 tells the
// page to fall back to the browser's own voice.
const API = "https://api.elevenlabs.io/v1";
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const CACHE = path.join(process.cwd(), "data", "voice-cache");
const MAX_CHARS = 600;

// Calm and unhurried: steady delivery, no added style, slightly slower than default
const SETTINGS = { stability: 0.6, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 0.95 };

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: "No voice key yet" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_CHARS) return Response.json({ error: "Bad text" }, { status: 400 });
  // the page may ask for a specific voice while Maeve compares the shortlist
  const voice = typeof body.voice === "string" && /^\w{10,40}$/.test(body.voice) ? body.voice : (process.env.ELEVENLABS_VOICE_ID || (await defaultVoice(key)));
  if (!voice) return Response.json({ error: "No voice available" }, { status: 503 });

  const file = path.join(CACHE, `${createHash("sha256").update(`${voice}|${MODEL}|${JSON.stringify(SETTINGS)}|${text}`).digest("hex")}.mp3`);
  try {
    return audio(await readFile(file));
  } catch {}

  const say = (v: string) =>
    fetch(`${API}/text-to-speech/${v}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
    });
  let res = await say(voice);
  // library voices need a paid plan (402); a premade voice beats the browser's,
  // but isn't cached as this voice, so upgrading later takes effect at once
  let standIn = false;
  if (res.status === 402) {
    const premade = await defaultVoice(key);
    if (premade && premade !== voice) [res, standIn] = [await say(premade), true];
  }
  if (!res.ok) return Response.json({ error: `Voice service said ${res.status}` }, { status: 502 });
  const mp3 = Buffer.from(await res.arrayBuffer());
  if (!standIn) {
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, mp3).catch(() => {});
  }
  return audio(mp3);
}

const audio = (mp3: Buffer) => new Response(new Uint8Array(mp3), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });

// Until a voice is chosen, the account's first premade voice
let fallback: string | undefined;
async function defaultVoice(key: string) {
  if (fallback) return fallback;
  const res = await fetch(`${API}/voices`, { headers: { "xi-api-key": key } }).catch(() => null);
  const voices: { voice_id: string; category?: string }[] = res?.ok ? ((await res.json()).voices ?? []) : [];
  fallback = (voices.find((v) => v.category === "premade") ?? voices[0])?.voice_id;
  return fallback;
}
