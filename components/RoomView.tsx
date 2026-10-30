"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MorePhotos from "@/components/MorePhotos";
import RoomSort from "@/components/RoomSort";
import { waitLine } from "@/lib/scan/waitLine";
import type { RoomSpec } from "@/lib/scan/spec";
import type { BuildInfo, RoomStatus } from "@/lib/scan/store";

interface RoomData {
  status: RoomStatus;
  spec: RoomSpec | null;
  build: BuildInfo | null;
}

const TABS = ["3D model", "Renders", "Your photos", "Details"] as const;
const BUSY = new Set(["uploaded", "reading", "building", "rendering"]);

const cm = (m: number) => `${Math.round(m * 100)}`;

// People see their room and the sorting tools; the build tools, renders and
// details (confidence, scale basis, raw errors) are for development only.
export default function RoomView({ id, dev = false }: { id: string; dev?: boolean }) {
  const [data, setData] = useState<RoomData | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]>("3D model");
  const [actionError, setActionError] = useState("");
  const [nonce, setNonce] = useState(0);

  // Load once, then poll every 2s while the room is still being built
  const busy = data ? BUSY.has(data.status.stage) : true;
  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetch(`/api/rooms/${id}`, { cache: "no-store" })
        .then((res) => (res.status === 404 ? null : res.json()))
        .then((body) => {
          if (!alive) return;
          if (body) setData(body);
          else setMissing(true);
        })
        .catch(() => {});
    tick();
    const t = busy ? setInterval(tick, 2000) : undefined;
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, busy, nonce]);

  async function act(body: object) {
    setActionError("");
    const res = await fetch(`/api/rooms/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      setActionError((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
      return setNonce((n) => n + 1);
    }
    // The job starts just after the response; show it as busy so polling begins now
    setData((d) => d && { ...d, status: { ...d.status, stage: "reading", message: "Starting…" } });
  }

  const fileUrl = (p: string) => `/api/rooms/${id}/files/${p}?v=${data?.build?.seconds ?? 0}-${data?.status.updatedAt ?? ""}`;
  const glbUrl = useMemo(
    () => (data?.build ? `/api/rooms/${id}/files/build/room.glb?v=${data.build.seconds}-${data.status.refinedAt ?? ""}` : null),
    [id, data?.build, data?.status.refinedAt],
  );

  if (missing) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-2xl">We couldn&apos;t find that room</h1>
        <Link href="/rooms" className="link mt-4 inline-block">See your rooms</Link>
      </div>
    );
  }
  if (!data) return <div className="max-w-5xl mx-auto px-6 py-16 text-ink-soft">Loading your room…</div>;

  const { status, spec, build } = data;
  const items = spec?.items ?? [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {/* while it builds it's "your room"; a measurements-only room is just "Room" */}
          <h1 className="text-display">{busy ? "Building your room" : !spec || /^room$/i.test(spec.name) ? "Your room" : spec.name}</h1>
          {spec && <p className="mt-4 text-lg text-ink-soft max-w-2xl">{spec.summary}</p>}
        </div>
        {dev && build && !busy && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => act({ action: "refine" })} className="btn btn-quiet">
              Fix it with Claude
            </button>
            {status.quality !== "full" && (
              <button onClick={() => act({ action: "rebuild", quality: "full" })} className="btn btn-primary">
                Render in high quality
              </button>
            )}
          </div>
        )}
      </div>
      {actionError && <p className="mt-3 text-sm text-rust">{actionError}</p>}

      {status.stage === "needs-photos" && (
        <div className="mt-8 rounded-2xl border bg-surface p-5 max-w-xl flex flex-col gap-4">
          <div>
            <p className="font-medium">A few more photos</p>
            <p className="mt-1 text-sm text-ink-soft">We can&apos;t see enough of the room to build it well yet. Add these and we&apos;ll read everything again.</p>
          </div>
          <MorePhotos roomId={id} asks={status.asks ?? []} onRestart={() => setData((d) => d && { ...d, status: { ...d.status, stage: "reading", message: "Reading your photos" } })} />
        </div>
      )}

      {(busy || status.stage === "error") && (
        <div className="mt-8 rounded-2xl border bg-surface p-5">
          {status.stage === "error" ? (
            <>
              <p className="font-medium text-rust">We couldn&apos;t build this room</p>
              {dev && <pre className="mt-2 text-xs whitespace-pre-wrap text-ink-soft mono">{status.error}</pre>}
              <p className="mt-1 text-sm text-ink-soft">{spec ? "We'll build it again from what we already read." : "We'll read your photos again from the start."}</p>
              <button onClick={() => act(spec ? { action: "rebuild", quality: status.quality } : { action: "retry" })} className="mt-4 btn btn-primary">
                Try again
              </button>
            </>
          ) : (
            <>
              {/* the same quiet checklist as the capture flow's build screen */}
              <ul className="flex flex-col gap-3">
                {([["reading", "Reading your photos"], ["building", "Building the room in 3D"], ["done", "Ready"]] as const).map(([stage, label]) => {
                  const order = ["uploaded", "reading", "building", "rendering", "done"];
                  // "Finishing up" (rendering) is still the 3D step, so it isn't ticked yet
                  const at = order.indexOf(status.stage === "rendering" ? "building" : status.stage);
                  const mine = order.indexOf(stage);
                  return (
                    <li key={stage} className={`flex items-center gap-3 ${mine <= at ? "text-ink" : "text-ink-soft"}`}>
                      <span className={`h-5 w-5 rounded-full grid place-items-center text-[10px] ${mine < at ? "bg-clay text-on-clay" : mine === at ? "border-2 border-clay-soft border-t-clay animate-[spin_1.1s_linear_infinite] motion-reduce:animate-none motion-reduce:border-clay" : "border border-line-strong"}`}>{mine < at ? "✓" : ""}</span>
                      {label}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-sm text-ink-soft">{waitLine(status.stage, status.message)}</p>
            </>
          )}
        </div>
      )}

      {build && spec && !dev && glbUrl && (
        <div className="mt-8">
          <RoomSort roomId={id} items={items} glbUrl={glbUrl} stacked />
          <Link href={`/play/${id}`} className="mt-6 btn btn-primary w-full sm:w-auto sm:px-8">Play with this room</Link>
        </div>
      )}

      {build && spec && dev && (
        <>
          <div className="mt-12 flex gap-7 shadow-[inset_0_-1px_0_var(--line)] overflow-x-auto">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`eyebrow pb-3 border-b ${tab === t ? "border-ink text-ink" : "border-transparent text-ink-faint hover:text-ink-soft"}`}>
                {t}
              </button>
            ))}
          </div>

          {tab === "3D model" && glbUrl && (
            <div className="mt-6">
              <RoomSort roomId={id} items={items} glbUrl={glbUrl} />
            </div>
          )}

          {tab === "Renders" && (
            <div className="mt-6 grid gap-4">
              {build.renders.map((r) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={r} src={fileUrl(`build/${r}`)} alt={r.replace(/^render_|\.png$/g, "").replace("_", " ")} className="w-full rounded-md border" />
              ))}
              <p className="text-xs text-ink-faint">Rendered in Blender {build.blender} in {build.seconds}s{build.quick ? " at preview quality" : ""}.</p>
            </div>
          )}

          {tab === "Your photos" && (
            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {status.photos.length === 0 && <p className="text-sm text-ink-faint">No photos for this room.</p>}
              {status.photos.map((p) => (
                <figure key={p.file}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(`photos/${p.file}`)} alt={p.label} className="w-full rounded-md border" />
                  <figcaption className="text-xs text-ink-faint mt-1">{p.label}</figcaption>
                </figure>
              ))}
            </div>
          )}

          {tab === "Details" && (
            <div className="mt-6 grid lg:grid-cols-[1fr_1fr] gap-8">
              <section className="flex flex-col gap-3 text-sm">
                <p><span className="text-ink-faint">Scale from:</span> {spec.scale_basis}</p>
                <p><span className="text-ink-faint">Light:</span> {spec.lighting}</p>
                <p><span className="text-ink-faint">Ceiling:</span> {spec.ceiling_height.toFixed(2)} m · <span className="text-ink-faint">Floor:</span> {spec.floor.material.replace("_", " ")} · <span className="text-ink-faint">Walls:</span> {spec.walls.material.replace("_", " ")}</p>
                <p><span className="text-ink-faint">Overall confidence:</span> {Math.round(spec.confidence * 100)}%</p>
              </section>
              <table className="text-sm w-full">
                <thead>
                  <tr className="text-left text-ink-faint text-xs"><th className="pb-2 font-normal">Item</th><th className="pb-2 font-normal">Size (cm)</th><th className="pb-2 font-normal">Sure</th><th className="pb-2 font-normal">Photos</th></tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t align-top">
                      <td className="py-2 pr-3">{it.name}<span className="block text-xs text-ink-faint">{it.notes}</span></td>
                      <td className="py-2 pr-3 mono text-xs whitespace-nowrap">{cm(it.width)}×{cm(it.depth)}×{cm(it.height)}</td>
                      <td className="py-2 pr-3 mono text-xs">{Math.round(it.confidence * 100)}%</td>
                      <td className="py-2 mono text-xs">{it.seen_in.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
