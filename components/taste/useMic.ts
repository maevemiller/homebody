"use client";

import { useEffect, useRef, useState } from "react";

// The browser's own speech recognition (Web Speech API: Chrome and Safari, free, no package),
// as in TasteConversation's call. listen() opens the mic once and hands the final words to
// onFinal; if the browser has none, or the mic is denied, `broken` turns true and the page
// falls back to typing.

interface Recognizer {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type Ctor = new () => Recognizer;
const speechIn = (): Ctor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export function useMic() {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [hint, setHint] = useState("");
  const [broken, setBroken] = useState(() => !speechIn());
  const rec = useRef<Recognizer | null>(null);
  const quiet = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stop = () => {
    clearTimeout(quiet.current);
    const r = rec.current;
    rec.current = null;
    r?.abort();
    setListening(false);
    setHeard("");
  };

  // they tap while it listens: they're done, so whatever was heard is final
  const finish = () => rec.current?.stop();

  const listen = (onFinal: (text: string) => void) => {
    const C = speechIn();
    if (!C) return setBroken(true);
    stop();
    const r = new C();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    let final = "";
    const wait = (ms: number, then: () => void) => {
      clearTimeout(quiet.current);
      quiet.current = setTimeout(then, ms);
    };
    wait(10000, () => {
      setHint("I didn't hear anything. Tap the mic to try again.");
      r.abort();
    });
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setHeard(final + interim);
      wait(8000, () => r.stop());
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      if (e.error === "no-speech") return setHint("I didn't hear anything. Tap the mic to try again.");
      setBroken(true);
      setHint("The microphone isn't available here, so type instead.");
    };
    r.onend = () => {
      clearTimeout(quiet.current);
      if (rec.current !== r) return;
      rec.current = null;
      setListening(false);
      setHeard("");
      if (final.trim()) onFinal(final.trim());
    };
    rec.current = r;
    setHint("");
    setListening(true);
    try {
      r.start();
    } catch {
      rec.current = null;
      setListening(false);
      setBroken(true);
    }
  };

  useEffect(() => () => stop(), []);
  return { listening, heard, hint, broken, listen, stop, finish };
}
