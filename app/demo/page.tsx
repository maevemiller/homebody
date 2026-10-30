"use client";

import Link from "next/link";
import { PathGrid } from "@/components/path/PathOverview";

// A guide for Maeve to try the whole thing as it stands: where to start, what's
// real and what's still a stand-in. Not part of the product.
const SAMPLE_ROOM = "202610271128-dzjy";

// Everything the app keeps in this browser starts with "homebody-"
function clearAll() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("homebody-")).forEach((k) => localStorage.removeItem(k));
  } catch {}
}

function startFresh() {
  clearAll();
  window.location.href = "/?sample=1";
}

// Straight to the conversation, as if the sample living room had just been captured
function skipToTaste() {
  clearAll();
  try {
    localStorage.setItem(
      "homebody-capture",
      JSON.stringify({
        cur: "handoff",
        history: [],
        answers: { scope: "room", room: "Living room", access: "yes", have: [], measurement: "", brought: [], wishUrl: "" },
        roomId: SAMPLE_ROOM,
      }),
    );
  } catch {}
  window.location.href = "/taste";
}

export default function DemoPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 sm:py-16 flex flex-col gap-14">
      <header className="flex flex-col gap-3">
        <p className="eyebrow text-ink-soft">For Maeve · demo, round three</p>
        <h1 className="text-display">Try Homebody</h1>
        <p className="text-ink-soft leading-relaxed">
          About ten minutes. Use Chrome, turn your sound on, and allow the microphone when asked. Then tell Claude in chat what
          felt right and what didn&apos;t.
        </p>
      </header>

      <section className="flex flex-col gap-6">
        <h2 className="text-[1.75rem]">The whole path</h2>
        <PathGrid />
        <p className="text-sm text-ink-soft leading-relaxed">
          In this demo no photos are needed: step 1 builds a sample living room in 3D on this computer (about a minute).
          Step 3 is a conversation with Lily, the voice; tap Talk, or choose to type. It already knows what you kept.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <button className="btn btn-primary w-full" onClick={startFresh}>Start from the beginning</button>
          <button className="btn btn-quiet w-full" onClick={skipToTaste}>Skip to the conversation</button>
        </div>
        <p className="text-xs text-ink-faint">Both buttons clear anything saved in this browser from earlier runs.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[1.75rem]">New since your notes</h2>
        <ul className="flex flex-col gap-2 text-ink-soft leading-relaxed list-disc pl-5">
          <li>The interview now runs in three parts: who you are, space and style, extras. Pick about 2, 5 or 15 minutes, say &ldquo;I&apos;m finished with this section&rdquo; anytime, and come back later to add more.</li>
          <li>The notes are a designer&apos;s working sheet, and the result is a real brief: program, constraints, direction, key decisions with the why, nevers, open questions. It uses your room&apos;s measurements and light. Corrections change only the line you mean.</li>
          <li>New typefaces (Gambetta, Switzer, Kalam) and a design system across the app. Compare type options at /demo/type.</li>
          <li>Real capture: three real rooms rebuilt from photos, with sloped ceilings, slats, fireplaces and measured colors. Open the cabin from Behind the scenes.</li>
          <li>Space Capture builds the room at the size you type, draws the floor while it builds, and reads it back.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[1.75rem]">New: Plug &amp; Play, first cut</h2>
        <p className="text-ink-soft leading-relaxed">
          The sample room as a little game board. Drag pieces around (they stay inside the walls and snap to them), turn
          them, place what&apos;s waiting in &ldquo;To find a spot for&rdquo;, and try sample pieces from the catalog or
          Swap one for a cheaper lookalike. The total of new pieces updates as you go, and your layout is saved in this browser.
        </p>
        <Link href={`/play/${SAMPLE_ROOM}`} className="btn btn-primary w-full sm:w-auto sm:self-start sm:px-8">Open Plug &amp; Play</Link>
        <p className="text-xs text-ink-faint">The catalog is made-up sample products and prices. Buying comes later.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[1.75rem]">Behind the scenes</h2>
        <p className="text-ink-soft leading-relaxed">Views people won&apos;t see, for checking the thinking.</p>
        <ul className="flex flex-col divide-y border-y">
          {[
            ["/taste?dev=1", "The conversation with “What Homebody assumes about me”"],
            [`/rooms/${SAMPLE_ROOM}?dev=1`, "The sample room: 3D model, renders and details"],
            ["/taste?mode=screens", "The older one-question-per-screen version, for comparison"],
            ["/rooms", "Your rooms"],
            ["/demo/type", "Typefaces: the pairings, in real screens"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="group flex items-center justify-between gap-4 min-h-12 py-3 -mx-3 px-3 rounded-xl transition-colors hover:bg-surface">
                <span>{label}</span>
                <span aria-hidden className="text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[1.75rem]">What&apos;s real, what isn&apos;t yet</h2>
        <ul className="flex flex-col gap-2 text-ink-soft leading-relaxed list-disc pl-5">
          <li><span className="text-ink">Real:</span> the 3D room built in Blender at the size you type, sorting, Lily&apos;s voice, and the hidden profile.</li>
          <li><span className="text-ink">The conversation</span> is live: Claude plays the designer, following the intake research, and draws your page as you talk. Each conversation costs a few cents. If it&apos;s slow or unavailable, a simpler scripted version takes over so you&apos;re never stuck.</li>
          <li><span className="text-ink">Listening</span> uses Chrome&apos;s built-in speech recognition, so it can be a little slow to pick up.</li>
          <li><span className="text-ink">Real photos:</span> reading your own room&apos;s photos with Claude works but costs a little per room, so this demo uses the sample.</li>
          <li><span className="text-ink">Plug &amp; Play</span> is a first cut: sample products drawn as simple shapes, sample prices. <span className="text-ink">Not built yet:</span> Transaction (buying).</li>
        </ul>
      </section>
    </div>
  );
}
