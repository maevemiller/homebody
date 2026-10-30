"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProgressRail from "@/components/ProgressRail";
import Chip from "@/components/Chip";
import { useHomebody } from "@/lib/state";
import { CATALOG_ROOMS } from "@/lib/catalog";
import { AestheticTag, Palette } from "@/lib/types";

const AESTHETICS: { key: AestheticTag; label: string }[] = [
  { key: "warm-minimal", label: "Warm minimal" },
  { key: "scandinavian", label: "Scandinavian" },
  { key: "indian-eclectic", label: "Indian eclectic" },
  { key: "mediterranean", label: "Mediterranean" },
  { key: "japandi", label: "Japandi" },
  { key: "midcentury", label: "Mid-century" },
  { key: "coastal", label: "Coastal" },
  { key: "industrial", label: "Industrial" },
  { key: "maximalist-boho", label: "Maximalist & boho" },
];

const PALETTES: { key: Palette; label: string }[] = [
  { key: "warm-neutral", label: "Warm neutrals" },
  { key: "jewel-tone", label: "Jewel tones" },
  { key: "monochrome", label: "Monochrome" },
  { key: "earthy-terracotta", label: "Earthy & terracotta" },
  { key: "cool-neutral", label: "Cool neutrals" },
];

export default function StyleInfoPage() {
  const router = useRouter();
  const { state, setStyle, hydrated } = useHomebody();
  const { intake, functional, style } = state;

  const coveredRooms = intake.rooms.filter((r) => CATALOG_ROOMS.includes(r));
  const functionalDone = coveredRooms.every((r) => functional[r]);

  useEffect(() => {
    if (!hydrated) return;
    if (intake.rooms.length === 0 || !intake.mode) return router.replace("/start");
    if (!functionalDone) return router.replace("/plan/functional");
  }, [hydrated, intake, functionalDone, router]);

  if (!hydrated || !functionalDone) return null;

  function toggleAesthetic(tag: AestheticTag) {
    setStyle({
      aesthetics: style.aesthetics.includes(tag)
        ? style.aesthetics.filter((t) => t !== tag)
        : [...style.aesthetics, tag],
    });
  }

  const canContinue = style.aesthetics.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <ProgressRail current={4} />
      <span className="eyebrow text-clay">Style info</span>
      <h1 className="mt-3 text-4xl font-semibold">What you actually gravitate toward</h1>
      <p className="mt-3 text-ink-soft max-w-xl">
        This is what makes the plan yours instead of generic — pick every
        direction that feels true, not just one.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Aesthetic directions</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Pick as many as apply — most people are a blend of two or three.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {AESTHETICS.map((a) => (
            <Chip key={a.key} active={style.aesthetics.includes(a.key)} onClick={() => toggleAesthetic(a.key)}>
              {a.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Color palette</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {PALETTES.map((p) => (
            <Chip key={p.key} active={style.palette === p.key} onClick={() => setStyle({ palette: p.key })} accent="sage">
              {p.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Your story <span className="text-ink-faint font-normal text-sm">(optional)</span></h2>
        <p className="mt-1 text-sm text-ink-soft">
          Where you&apos;re from, where you&apos;ve lived, what you keep coming back to.
        </p>
        <textarea
          value={style.story}
          onChange={(e) => setStyle({ story: e.target.value })}
          placeholder="e.g. Grew up in a Gujarati household with a lot of colour and brass — but three years in Copenhagen made me love restraint and natural light. I want both in this room, not a compromise between them."
          rows={4}
          className="mt-3 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-clay resize-none"
        />
      </section>

      <div className="mt-10">
        <button
          disabled={!canContinue}
          onClick={() => router.push("/plan/results")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-clay text-[#F7F4EB] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Build my plan
        </button>
        {!canContinue && <p className="mt-2 text-xs text-ink-faint">Pick at least one aesthetic direction.</p>}
      </div>
    </div>
  );
}
