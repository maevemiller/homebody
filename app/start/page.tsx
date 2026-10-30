"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ProgressRail from "@/components/ProgressRail";
import Chip from "@/components/Chip";
import { useHomebody } from "@/lib/state";
import { CATALOG_ROOMS, ROOM_LABELS } from "@/lib/catalog";
import { Mode, Priority, RoomId, Timeline } from "@/lib/types";

const ALL_ROOMS: RoomId[] = [...CATALOG_ROOMS, "bathroom", "other"];

const PRIORITIES: { key: Priority; label: string; hint: string }[] = [
  { key: "speed", label: "Speed", hint: "Get it done fast" },
  { key: "style", label: "Style", hint: "It has to look right" },
  { key: "budget", label: "Budget", hint: "Keep it affordable" },
  { key: "customization", label: "Customization", hint: "Every piece considered" },
];

const TIMELINES: { key: Timeline; label: string }[] = [
  { key: "asap", label: "ASAP — 1 to 2 weeks" },
  { key: "month", label: "Within a month" },
  { key: "few-months", label: "Next few months" },
  { key: "indefinite", label: "No rush" },
];

export default function StartPage() {
  const router = useRouter();
  const { state, setIntake, hydrated } = useHomebody();
  const { rooms, mode, priorities, timeline, photos } = state.intake;
  const [error, setError] = useState<string | null>(null);

  const wholeHomeSelected = useMemo(
    () => CATALOG_ROOMS.every((r) => rooms.includes(r)),
    [rooms]
  );

  function toggleRoom(room: RoomId) {
    setIntake({
      rooms: rooms.includes(room)
        ? rooms.filter((r) => r !== room)
        : [...rooms, room],
    });
  }

  function toggleWholeHome() {
    setIntake({ rooms: wholeHomeSelected ? [] : [...CATALOG_ROOMS] });
  }

  function setMode(m: Mode) {
    setIntake({ mode: m });
  }

  function togglePriority(p: Priority) {
    if (priorities.includes(p)) {
      setIntake({ priorities: priorities.filter((x) => x !== p) });
    } else if (priorities.length < 2) {
      setIntake({ priorities: [...priorities, p] });
    }
  }

  function setTimelineValue(t: Timeline) {
    setIntake({ timeline: t });
  }

  function onPhoto(room: RoomId, file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const next = photos.filter((p) => p.room !== room);
      setIntake({ photos: [...next, { room, dataUrl, name: file.name }] });
    };
    reader.readAsDataURL(file);
  }

  function submit() {
    if (rooms.length === 0) return setError("Pick at least one space.");
    if (!mode) return setError("Let us know if this is a fresh start or a refresh.");
    if (priorities.length === 0) return setError("Pick one or two things you value most.");
    if (!timeline) return setError("Pick a rough timeline.");
    setError(null);
    router.push("/preview");
  }

  if (!hydrated) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <ProgressRail current={1} />
      <span className="eyebrow text-clay">Client intake form</span>
      <h1 className="mt-3 text-4xl font-semibold">Tell us what you&apos;re working with</h1>
      <p className="mt-3 text-ink-soft max-w-xl">
        Five questions. This places you in one of Homebody&apos;s four planning
        modes and gives you an estimated cost before you commit to anything.
      </p>

      {/* Q1 */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">1. Which space(s) are you looking to design?</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip active={wholeHomeSelected} onClick={toggleWholeHome} accent="sage">
            Whole home
          </Chip>
          {ALL_ROOMS.map((r) => (
            <Chip key={r} active={rooms.includes(r)} onClick={() => toggleRoom(r)}>
              {ROOM_LABELS[r]}
            </Chip>
          ))}
        </div>
        {rooms.some((r) => r === "bathroom" || r === "other") && (
          <p className="mt-3 text-xs text-ink-faint mono">
            Bathroom and other spaces: curation is still in progress for v0 — they&apos;ll show up as a note, not picks, later on.
          </p>
        )}
      </section>

      {/* Q2 */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">2. Are you starting fresh, or refreshing an existing space?</h2>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("fresh")}
            className={`text-left rounded-md border p-5 transition-colors ${
              mode === "fresh" ? "border-clay bg-clay-tint" : "border-line bg-surface hover:border-line-strong"
            }`}
          >
            <span className="font-display font-semibold text-lg">Fresh start</span>
            <p className="mt-1.5 text-sm text-ink-soft">Furnishing this space from scratch.</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("refresh")}
            className={`text-left rounded-md border p-5 transition-colors ${
              mode === "refresh" ? "border-sage bg-sage-tint" : "border-line bg-surface hover:border-line-strong"
            }`}
          >
            <span className="font-display font-semibold text-lg">Refresh</span>
            <p className="mt-1.5 text-sm text-ink-soft">Adding to and enhancing a space you already have.</p>
          </button>
        </div>
      </section>

      {/* Q3 */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">3. What do you value most? <span className="text-ink-faint font-normal text-sm">(pick 1–2)</span></h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <Chip key={p.key} active={priorities.includes(p.key)} onClick={() => togglePriority(p.key)}>
              {p.label} <span className="text-ink-faint">— {p.hint}</span>
            </Chip>
          ))}
        </div>
      </section>

      {/* Q4 */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">4. Which best describes your timeline?</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {TIMELINES.map((t) => (
            <Chip key={t.key} active={timeline === t.key} onClick={() => setTimelineValue(t.key)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </section>

      {/* Q5 */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">
          5. Optional — upload a photo of each space <span className="text-ink-faint font-normal text-sm">(helps us understand what you&apos;re working with)</span>
        </h2>
        {rooms.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">Pick your spaces above first.</p>
        ) : (
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            {rooms.map((r) => {
              const existing = photos.find((p) => p.room === r);
              return (
                <div key={r} className="rounded-md border border-line bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{ROOM_LABELS[r]}</span>
                    {existing && <span className="mono text-[10px] text-sage">uploaded</span>}
                  </div>
                  {existing && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={existing.dataUrl}
                      alt={`Uploaded photo of the ${ROOM_LABELS[r].toLowerCase()}`}
                      className="mt-2 h-24 w-full object-cover rounded"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onPhoto(r, e.target.files?.[0] ?? null)}
                    className="mt-2 w-full text-xs text-ink-soft file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-surface-2 file:text-ink file:text-xs"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="mt-8 text-sm text-clay">{error}</p>
      )}

      <div className="mt-10 flex items-center gap-4">
        <button
          onClick={submit}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-clay text-[#F7F4EB] font-medium hover:opacity-90 transition-opacity"
        >
          See my preview
        </button>
        <span className="text-sm text-ink-faint">Takes you to a free moodboard preview next.</span>
      </div>
    </div>
  );
}
