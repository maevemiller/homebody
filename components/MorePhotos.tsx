"use client";

import { useState } from "react";

// When the photos can't build the room yet: exactly what to add (from the capture checklist),
// a place to add it, and a quiet way to build with what's there.
export default function MorePhotos({ roomId, asks, onRestart }: { roomId: string; asks: string[]; onRestart: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(body: FormData | string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/rooms/${roomId}`, {
      method: "POST",
      body,
      headers: typeof body === "string" ? { "Content-Type": "application/json" } : undefined,
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "That didn't work. Try again.");
    setFiles([]);
    onRestart();
  }

  const add = () => {
    const form = new FormData();
    files.forEach((f) => form.append("photos", f));
    void send(form);
  };

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3 text-sm">
        {asks.map((t, i) => (
          <li key={t} className="grid grid-cols-[1.75rem_1fr] gap-3 items-baseline border-t pt-3 first:border-t-0 first:pt-0">
            <span className="text-xs num font-semibold text-clay">0{i + 1}</span>
            <span className="text-base">{t}</span>
          </li>
        ))}
      </ol>
      <label className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line-strong bg-surface p-6 text-center cursor-pointer transition-colors hover:bg-surface-2 hover:border-ink-faint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-clay has-[:focus-visible]:outline-offset-2">
        <span className="font-medium">{files.length ? `${files.length} added` : "Add photos or a video"}</span>
        <span className="text-xs text-ink-soft">Your first photos are kept</span>
        <input type="file" accept="image/*,video/*,.heic,.heif,.mov,.mp4" multiple className="sr-only" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
      </label>
      {error && <p className="text-sm text-rust" role="alert">{error}</p>}
      <button className="btn btn-primary w-full" disabled={!files.length || busy} onClick={add}>{busy ? "Sending…" : "Add and rebuild"}</button>
      <button className="link link-quiet self-center min-h-11 text-sm" disabled={busy} onClick={() => void send(JSON.stringify({ action: "build-anyway" }))}>
        Build with what I have
      </button>
    </div>
  );
}
