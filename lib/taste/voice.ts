// The agent's voice, behind one function: speak(text, onEnd, onStart), plus prefetch(text). It uses the
// neural voice (ElevenLabs, via /api/voice/speak) when a key is set, and the
// browser's own speech (free, built into Chrome and Safari) otherwise.

// macOS and Chrome ship novelty voices that sound like toys or robots: never these
const NOVELTY = /\b(albert|bad news|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy)\b/i;
const GOOD = /\b(ava|zoe|samantha|google us english)\b/i;

// Premium, then Enhanced, then Natural or Neural, then the known good ones; English only
function score(v: SpeechSynthesisVoice): number {
  if (!/^en([-_]|$)/i.test(v.lang) || NOVELTY.test(v.name)) return -1;
  const tier = /premium/i.test(v.name) ? 50 : /enhanced/i.test(v.name) ? 40 : /natural|neural/i.test(v.name) ? 30 : GOOD.test(v.name) ? 20 : 0;
  return tier + (/^en[-_]US/i.test(v.lang) ? 2 : 0) + (v.localService ? 1 : 0);
}

let chosen: SpeechSynthesisVoice | null = null;
// null until the first line asks; false once the server says there's no key
let neural: boolean | null = null;
const listeners = new Set<() => void>();
const label = () => (neural ? "ElevenLabs" : chosen ? `${chosen.name} (${chosen.lang})` : null);

function bestVoice(): SpeechSynthesisVoice | null {
  const ranked = window.speechSynthesis.getVoices().filter((v) => score(v) >= 0).sort((a, b) => score(b) - score(a));
  return ranked[0] ?? null;
}

// Calls back with the name of the voice in use, now and whenever it changes:
// browser voices arrive asynchronously, and the neural voice is known after the first line
export function watchVoice(cb: (name: string | null) => void): () => void {
  const update = () => {
    if ("speechSynthesis" in window) chosen = bestVoice();
    cb(label());
  };
  update();
  listeners.add(update);
  if (!("speechSynthesis" in window)) return () => listeners.delete(update);
  window.speechSynthesis.addEventListener("voiceschanged", update);
  return () => {
    listeners.delete(update);
    window.speechSynthesis.removeEventListener("voiceschanged", update);
  };
}

const setNeural = (on: boolean) => {
  if (neural === on) return;
  neural = on;
  listeners.forEach((l) => l());
};

// Neural clips by the text they say, so a line fetched ahead plays with no gap. Small and
// in memory: a conversation only ever needs the next line or two.
const clips = new Map<string, Promise<Blob | null>>();
let inFlight = 0;

function clip(text: string): Promise<Blob | null> {
  const said = forSpeech(text);
  const cached = clips.get(said);
  if (cached) return cached;
  // a voice the dev picker chose, while comparing the shortlist
  let voice: string | undefined;
  try {
    voice = localStorage.getItem("homebody-voice") ?? undefined;
  } catch {}
  inFlight++;
  const p = fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: said, voice }) })
    .then(async (res) => {
      if (res.status === 503) setNeural(false);
      if (!res.ok) return null;
      setNeural(true);
      return res.blob();
    })
    .catch(() => null)
    .finally(() => inFlight--);
  clips.set(said, p);
  // a failed fetch isn't kept, so the line can be tried again
  p.then((b) => !b && clips.get(said) === p && clips.delete(said));
  while (clips.size > 8) clips.delete(clips.keys().next().value!);
  return p;
}

// Fetches a line's clip ahead of time, so it's ready when it's said. Never more than two at
// once, and never once we know there's no neural voice.
export function prefetch(text: string) {
  if (neural === false || !forSpeech(text) || inFlight >= 2 || clips.has(forSpeech(text))) return;
  void clip(text);
}

// The neural voice says each part whole (it paces itself better than we can), one after another;
// every part is fetched at once, so the second is usually ready before the first ends.
// Falls back to the browser for what's left if anything goes wrong, and for good if there's no key.
function speakNeural(parts: string[], onEnd?: () => void, onStart?: () => void): () => void {
  let stopBrowser: (() => void) | undefined;
  let stopped = false;
  let started = false;
  const audio = new Audio();
  const pending = parts.map(clip);
  const play = async (i: number) => {
    if (stopped) return;
    if (i >= parts.length) return onEnd?.();
    const blob = await pending[i];
    if (stopped) return;
    const fallback = () => {
      if (!stopped) stopBrowser = speakBrowser(parts.slice(i), onEnd, started ? undefined : onStart);
    };
    if (!blob) return fallback();
    audio.src = URL.createObjectURL(blob);
    // "speaking" starts with the sound, not the request
    audio.onplay = () => {
      if (stopped || started) return;
      started = true;
      onStart?.();
    };
    audio.onended = () => void play(i + 1);
    audio.onerror = fallback;
    await audio.play().catch(fallback);
  };
  void play(0);
  return () => {
    stopped = true;
    audio.pause();
    stopBrowser?.();
  };
}

// Only what should be heard: no quotes, brackets, middle dots or ellipses
export const forSpeech = (text: string) =>
  text.replace(/["“”()[\]]/g, "").replace(/\s·\s/g, ", ").replace(/…|\.\.\./g, ".").replace(/\s+/g, " ").trim();

// Says a line, or a line in parts (the acknowledgement, then the question, so a question
// fetched ahead is ready). Calls onStart when the sound actually begins and onEnd once it's
// all said; returns a function that stops it.
export function speak(text: string | string[], onEnd?: () => void, onStart?: () => void): () => void {
  const parts = (Array.isArray(text) ? text : [text]).filter((t) => forSpeech(t));
  return neural === false ? speakBrowser(parts, onEnd, onStart) : speakNeural(parts, onEnd, onStart);
}

// Says the text sentence by sentence, with a short breath between, so it doesn't rush
function speakBrowser(text: string[], onEnd?: () => void, onStart?: () => void): () => void {
  const parts = forSpeech(text.join(" ")).match(/[^.!?]+[.!?]*/g)?.map((x) => x.trim()).filter(Boolean) ?? [];
  // once, from the first sentence that starts (or ends, where a browser never says it started)
  let began = false;
  const begin = () => {
    if (began) return;
    began = true;
    onStart?.();
  };
  if (!("speechSynthesis" in window) || !parts.length) {
    begin();
    onEnd?.();
    return () => {};
  }
  const out = window.speechSynthesis;
  out.cancel();
  let i = 0;
  let stopped = false;
  let gap: ReturnType<typeof setTimeout> | undefined;
  let guard: ReturnType<typeof setTimeout> | undefined;
  const next = () => {
    if (stopped) return;
    if (i >= parts.length) return onEnd?.();
    const u = new SpeechSynthesisUtterance(parts[i++]);
    const v = chosen ?? bestVoice();
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    u.rate = 0.95;
    u.pitch = 1;
    let done = false;
    u.onstart = () => !stopped && begin();
    const fin = () => {
      if (done) return;
      done = true;
      begin();
      clearTimeout(guard);
      gap = setTimeout(next, 250);
    };
    u.onend = fin;
    u.onerror = fin;
    // some browsers never fire end (no audio device), so move on after about as long as it would take
    guard = setTimeout(fin, 1500 + u.text.split(" ").length * 600);
    out.speak(u);
  };
  next();
  return () => {
    stopped = true;
    clearTimeout(gap);
    clearTimeout(guard);
    out.cancel();
  };
}
