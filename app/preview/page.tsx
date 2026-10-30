"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import ProgressRail from "@/components/ProgressRail";
import { useHomebody } from "@/lib/state";
import { personaFor } from "@/lib/personas";
import { ROOM_LABELS } from "@/lib/catalog";
import { quote, formatUSD } from "@/lib/pricing";
import { CATALOG } from "@/lib/catalog";
import { AestheticTag } from "@/lib/types";

const EXAMPLE_TAGS: Record<string, AestheticTag[]> = {
  showroom: ["scandinavian", "warm-minimal"],
  considered: ["japandi", "midcentury"],
  "quick-refresh": ["scandinavian", "coastal"],
  gatherer: ["indian-eclectic", "maximalist-boho"],
};

const PRIORITY_LABEL: Record<string, string> = {
  speed: "speed",
  style: "style",
  budget: "budget",
  customization: "customization",
};

const TIMELINE_LABEL: Record<string, string> = {
  asap: "the next 1–2 weeks",
  month: "within a month",
  "few-months": "the next few months",
  indefinite: "no fixed timeline",
};

export default function PreviewPage() {
  const router = useRouter();
  const { state, hydrated } = useHomebody();
  const { intake } = state;

  useEffect(() => {
    if (hydrated && (intake.rooms.length === 0 || !intake.mode)) {
      router.replace("/start");
    }
  }, [hydrated, intake, router]);

  const persona = personaFor(intake);
  const price = quote(intake);

  const exampleItems = useMemo(() => {
    if (!persona) return [];
    const tags = EXAMPLE_TAGS[persona.key] ?? [];
    return CATALOG.filter((item) => item.aesthetics.some((t) => tags.includes(t)))
      .slice(0, 6);
  }, [persona]);

  if (!hydrated || !persona || !price) return null;

  const roomNames = intake.rooms.map((r) => ROOM_LABELS[r]).join(", ");
  const priorityNames = intake.priorities.map((p) => PRIORITY_LABEL[p]).join(" and ");

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <ProgressRail current={2} />
      <span className="eyebrow text-clay">Your persona</span>
      <h1 className="mt-3 text-4xl font-semibold">{persona.name}</h1>
      <p className="mt-3 max-w-xl text-ink-soft">{persona.description}</p>
      <span className="mono text-[10px] uppercase tracking-wide text-ink-faint">
        {persona.source === "from notes" ? "core persona" : "derived from your answers"}
      </span>

      <section className="mt-10 rounded-md border border-line bg-surface p-6">
        <span className="eyebrow text-sage">Needs summary</span>
        <p className="mt-3 text-ink max-w-2xl">
          You&apos;re {intake.mode === "fresh" ? "starting fresh on" : "refreshing"}{" "}
          {roomNames}, prioritizing {priorityNames || "a balance of speed, style, and budget"},
          and hoping to have it done in {TIMELINE_LABEL[intake.timeline ?? "indefinite"]}.
        </p>
      </section>

      <section className="mt-10">
        <span className="eyebrow text-clay">Example direction</span>
        <h2 className="mt-2 text-xl font-semibold">
          What a {persona.name.toLowerCase()} moodboard leans toward
        </h2>
        <p className="mt-2 text-sm text-ink-soft max-w-xl">
          This is a representative taste of the direction, not your final picks —
          those come from the style interview in step 04.
        </p>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {exampleItems.map((item) => (
            <div key={item.id} className="rounded-md border border-line-strong overflow-hidden bg-surface">
              <div className="h-20" style={{ background: item.swatch }} />
              <div className="p-3">
                <div className="mono text-[10px] text-ink-faint uppercase">{item.categoryLabel}</div>
                <div className="text-sm mt-0.5">{item.name}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-md border border-clay bg-clay-tint p-6">
        <span className="eyebrow text-clay">Estimated cost</span>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="font-display text-4xl font-semibold mono">{formatUSD(price.total)}</span>
          <span className="text-sm text-ink-soft">
            {formatUSD(price.perRoom)} × {price.roomCount} room{price.roomCount === 1 ? "" : "s"}, {price.tier} tier
          </span>
        </div>
        <p className="mt-3 text-sm text-ink-soft max-w-xl">
          A reference point for the pricing model — not a checkout. This prototype
          skips payment entirely so we can focus on getting the plan itself right.
        </p>
        <button
          onClick={() => router.push("/plan/functional")}
          className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-clay text-[#F7F4EB] font-medium hover:opacity-90 transition-opacity"
        >
          Continue to your plan
        </button>
      </section>
    </div>
  );
}
