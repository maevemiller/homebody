"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface RoomRow {
  id: string;
  stage: string;
  createdAt: string;
  name: string | null;
  photos: number;
}

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/rooms").then((r) => r.json()).then((d) => setRooms(d.rooms ?? [])).catch(() => setRooms([]));
  }, []);

  async function sample() {
    setBusy(true);
    const form = new FormData();
    form.set("sample", "1");
    const res = await fetch("/api/rooms", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    if (res.ok) router.push(`/rooms/${body.id}`);
    else setBusy(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
        <h1 className="text-display">Your rooms</h1>
        <Link href="/" className="btn btn-primary btn-sm">Capture a room</Link>
      </div>
      {rooms === null ? (
        <p className="mt-8 text-ink-soft">Loading your rooms…</p>
      ) : rooms.length === 0 ? (
        <p className="mt-8 text-ink-soft">No rooms yet.</p>
      ) : (
        <ul className="mt-10 divide-y border-y">
          {rooms.map((r) => (
            <li key={r.id}>
              <Link href={`/rooms/${r.id}`} className="group flex items-center justify-between gap-4 min-h-16 py-4 transition-colors hover:bg-surface -mx-3 px-3 rounded-xl">
                <span className="font-display text-[1.375rem] leading-tight">{r.name ?? "Untitled room"}</span>
                <span className="flex items-center gap-3 text-xs text-ink-soft num whitespace-nowrap">{r.stage === "done" ? new Date(r.createdAt).toLocaleDateString() : r.stage === "error" ? "Couldn't build" : "Building…"}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink"><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/taste" className="link link-quiet mt-8 inline-block text-sm">Tell us more about you</Link>
      {/* a free test room, for development only */}
      {process.env.NODE_ENV !== "production" && (
      <button onClick={sample} disabled={busy} className="link mt-8 block text-xs text-ink-faint">
        {busy ? "Building the sample…" : "Build the sample room (no photos needed)"}
      </button>
      )}
    </div>
  );
}
