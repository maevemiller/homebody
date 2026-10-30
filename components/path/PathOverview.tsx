"use client";

import { useCallback, useState } from "react";
import s from "./path.module.css";

// The path through Homebody, shown rather than told: each step is a small plan
// drawing of what happens in it. At rest a drawing is still, finished; hovering,
// focusing or tapping it plays it once (Maeve, 2026-10-30). Nothing plays on its own.
// Used by the capture welcome (one stage plus the step list) and by /demo (all four).

export const STEPS = [
  { id: "capture", title: "Capture the room", line: "A few photos or a floor plan become a 3D room, to scale." },
  { id: "sort", title: "Sort what's there", line: "Tap each piece: keep it, move it, or let it go." },
  { id: "taste", title: "Tell us your taste", line: "Talk it through. We write it down as design decisions." },
  { id: "play", title: "Play, then buy", line: "Arrange it in 3D, swap pieces, watch the cost. Buy one piece or the room." },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

// a delay that starts this element's own animation at `phase` (0–1) of the drawing's timeline
const at = (phase: number) => ({ animationDelay: `calc(var(--loop) * ${phase})` });
const A = (...cls: string[]) => [s.anim, ...cls].join(" ");

/* ---- the room every drawing shares (viewBox 320 × 200) ---- */
const WALLS = "M140 30 H44 V170 H276 V150 M276 116 V30 H184";

function Shell({ walls = true }: { walls?: boolean }) {
  return (
    <>
      {walls && <path d={WALLS} className={s.wall} />}
      {/* window: a glazing line in the wall gap */}
      <rect x="140" y="28.4" width="44" height="3.2" className={s.thin} />
      {/* door, swung open */}
      <path d="M276 116 H242" className={s.thin} />
      <path d="M242 116 A34 34 0 0 0 276 150" className={s.faint} strokeDasharray="2 2" />
    </>
  );
}

function Rug() {
  return (
    <>
      <rect x="92" y="78" width="100" height="58" rx="1.5" className={s.pieceSoft} />
      <rect x="116" y="96" width="52" height="22" rx="2" className={s.piece} />
    </>
  );
}

function Lamp() {
  return (
    <g>
      <circle cx="256" cy="154" r="6.5" className={s.piece} />
      <circle cx="256" cy="154" r="2" className={s.thin} />
    </g>
  );
}

function Armchair() {
  return (
    <g>
      <rect x="214" y="70" width="36" height="34" rx="5" className={s.piece} />
      <path d="M219 76 H245 V104 M219 76 V104" className={s.thin} fill="none" />
    </g>
  );
}

function Sofa({ className, part }: { className?: string; part?: string }) {
  return (
    <g className={className}>
      <rect x="96" y="138" width="92" height="27" rx="4" className={part ?? s.piece} />
      <path d="M101 159.5 H183 M126.5 138.5 V159.5 M157.5 138.5 V159.5" className={s.thin} />
    </g>
  );
}

/* ---- 1 · Capture ---- */
function Capture() {
  const cams: [number, number, number][] = [
    [54, 40, 0.36],
    [266, 40, 0.44],
    [266, 160, 0.52],
    [54, 160, 0.6],
  ];
  const cone = (x: number, y: number) => {
    // a 46° view toward the middle of the room
    const a = Math.atan2(100 - y, 160 - x);
    const r = 74;
    const p = (d: number) => `${(x + r * Math.cos(a + d)).toFixed(1)} ${(y + r * Math.sin(a + d)).toFixed(1)}`;
    return `M${x} ${y} L${p(-0.4)} L${p(0.4)} Z`;
  };
  return (
    <svg viewBox="0 0 320 200" aria-hidden>
      <path d={WALLS} pathLength={1} className={A(s.wall, s.drawWalls)} />
      <g className={A(s.after)}>
        <Shell walls={false} />
        {/* dimensions, architect style: extension ticks and a figure on the line */}
        <path d="M44 16 H276 M40 20 L48 12 M272 20 L280 12" className={s.dim} />
        <rect x="139" y="10" width="42" height="12" className={s.labelBg} />
        <text x="160" y="19" textAnchor="middle" className={s.label}>19′ 4″</text>
        <path d="M24 30 V170 M20 34 L28 26 M20 174 L28 166" className={s.dim} />
        <rect x="18" y="80" width="12" height="40" className={s.labelBg} />
        <text x="27" y="100" textAnchor="middle" transform="rotate(-90 27 100)" className={s.label}>11′ 8″</text>
        {cams.map(([x, y, t]) => (
          <g key={`${x}-${y}`}>
            <path d={cone(x, y)} className={A(s.cone)} style={at(t)} />
            <circle cx={x} cy={y} r="2.6" className={A(s.cam)} style={at(t)} />
            <circle cx={x} cy={y} r="4" className={A(s.flash)} style={at(t)} />
          </g>
        ))}
      </g>
      <g className={A(s.scaleTag)}>
        <rect x="196" y="176" width="80" height="17" rx="8.5" fill="var(--clay)" />
        <text x="236" y="187.5" textAnchor="middle" className={s.label} style={{ fill: "var(--on-clay)", fontWeight: 540 }}>3D, to scale</text>
      </g>
    </svg>
  );
}

/* ---- 2 · Sort ---- */
function Sort() {
  return (
    <>
      <svg viewBox="0 0 320 200" aria-hidden>
        <g transform="translate(0 -8)">
          <Shell />
          <Rug />
          <Lamp />
          <circle cx="60" cy="156" r="7" className={s.pieceSoft} />
          {/* the bookcase is going */}
          <g>
            <rect x="52" y="33" width="70" height="11" rx="1" className={A(s.remove)} strokeWidth="1" />
            <path d="M75 33.5 V43.5 M99 33.5 V43.5" className={s.faint} />
          </g>
          {/* the armchair is moving */}
          <rect x="214" y="70" width="36" height="34" rx="5" className={A(s.move)} strokeWidth="1" />
          <path d="M219 76 H245 V104 M219 76 V104" className={A(s.moveLines)} strokeWidth="0.9" />
          {/* the sofa stays */}
          <Sofa part={A(s.keep)} />
          <circle cx="142" cy="151" r="9" className={A(s.tap)} style={at(0.15)} />
          <circle cx="232" cy="87" r="9" className={A(s.tap)} style={at(0.37)} />
          <circle cx="87" cy="38.5" r="9" className={A(s.tap)} style={at(0.59)} />
        </g>
      </svg>
      <div className={s.tags} aria-hidden>
        <span className={A(s.tag, s.tagKeep)}>Keep here</span>
        <span className={A(s.tag, s.tagMove)}>Move it</span>
        <span className={A(s.tag, s.tagRemove)}>Remove</span>
      </div>
    </>
  );
}

/* ---- 3 · Taste ---- */
const SWATCHES = [
  ["#e6dccb", "oat"],
  ["#6c7650", "olive"],
  ["#5b3f2c", "walnut"],
  ["#b08d4a", "brass"],
];
function Taste() {
  return (
    <div className={s.taste} aria-hidden>
      <p className={A(s.said)}>&ldquo;Friends over most weekends, usually six of us.&rdquo;</p>
      <div className={s.notes}>
        <span className={A(s.note, s.n1)}>Seat six: 3-seat sofa, 2 chairs, a pouf</span>
        <span className={A(s.note, s.n2)}>Performance fabric; it will meet red wine</span>
        <span className={A(s.note, s.n3)}>maybe: an extending table?</span>
      </div>
      <div className={s.swatches}>
        {SWATCHES.map(([c, n]) => (
          <span key={n} className={A(s.swatch)}>
            <span style={{ background: c }} />
            <span>{n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---- 4 · Play ---- */
function Play() {
  return (
    <>
      <svg viewBox="0 0 320 200" aria-hidden>
        {/* lowered a little, so the cost pill sits clear of the top wall */}
        <g transform="translate(0 10)">
        <Shell />
        <Rug />
        <Lamp />
        <Armchair />
        <path d="M60 166.5 H260" className={A(s.snap)} />
        <g className={A(s.drag)} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <Sofa part={s.sofa} />
        </g>
        <g className={A(s.cursor)}>
          <path transform="translate(146 148)" d="M0 0 L0 12 L3.2 8.8 L5.8 14 L7.8 13.1 L5.2 8 L9.6 8 Z" />
        </g>
        </g>
      </svg>
      <div className={s.pill} aria-hidden>
        New pieces
        <b>
          <span className={A(s.before)}>$860</span>
          <span className={A(s.later)}>$2,145</span>
        </b>
      </div>
    </>
  );
}

const DRAWINGS: Record<StepId, () => React.ReactElement> = { capture: Capture, sort: Sort, taste: Taste, play: Play };

/** One step's drawing: still and finished, or playing once (`run` > 0 restarts it). */
export function Vignette({ id, run = 0, className = "" }: { id: StepId; run?: number; className?: string }) {
  const Drawing = DRAWINGS[id];
  return (
    // keyed on the run, so each play starts from the first frame
    <div key={run} className={`${s.vignette} ${run ? "" : s.still} ${className}`}>
      <Drawing />
    </div>
  );
}

/** Play on hover (mouse), focus (keyboard) or tap (touch); back to rest when the pointer or focus leaves. */
function usePlay() {
  const [run, setRun] = useState(0);
  const play = useCallback(() => setRun((r) => r + 1), []);
  const rest = useCallback(() => setRun(0), []);
  return { run, play, rest };
}

/**
 * The welcome's path: one stage showing a step's drawing, and the four steps beneath it.
 * Pointing at a step (or focusing or tapping it) shows its drawing and plays it once.
 */
export function PathStage() {
  const [cur, setCur] = useState(0);
  const { run, play, rest } = usePlay();
  const step = STEPS[cur];
  const show = (i: number) => {
    setCur(i);
    play();
  };
  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-[1.75rem] bg-surface shadow-[var(--shadow-1)] overflow-hidden"
        onPointerEnter={(e) => e.pointerType === "mouse" && play()}
        onPointerLeave={(e) => e.pointerType === "mouse" && rest()}
        onClick={play}
        aria-hidden
      >
        <Vignette key={step.id} id={step.id} run={run} />
      </div>
      <ol className="flex flex-col" aria-label="How it works" onPointerLeave={(e) => e.pointerType === "mouse" && rest()}>
        {STEPS.map((st, i) => {
          const on = i === cur;
          return (
            <li key={st.id} className="border-t first:border-t-0">
              <button
                type="button"
                onPointerEnter={(e) => e.pointerType === "mouse" && i !== cur && show(i)}
                onFocus={() => show(i)}
                onBlur={rest}
                onClick={() => show(i)}
                aria-current={on ? "step" : undefined}
                className="group w-full text-left py-3 grid grid-cols-[1.75rem_1fr] gap-x-2 items-baseline rounded-md"
              >
                <span className={`text-xs num transition-colors ${on ? "text-ink font-medium" : "text-ink-faint"}`}>0{i + 1}</span>
                <span className={`transition-colors ${on ? "text-ink" : "text-ink-soft group-hover:text-ink"}`}>{st.title}</span>
                {on && (
                  <>
                    <span />
                    <span className="text-sm text-ink-soft animate-rise">{st.line}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function GridItem({ i, st }: { i: number; st: (typeof STEPS)[number] }) {
  const { run, play, rest } = usePlay();
  return (
    <li>
      <button
        type="button"
        className="group flex w-full flex-col gap-3 text-left rounded-[1.75rem]"
        onPointerEnter={(e) => e.pointerType === "mouse" && play()}
        onPointerLeave={(e) => e.pointerType === "mouse" && rest()}
        onFocus={play}
        onBlur={rest}
        onClick={play}
        aria-label={`${st.title}. ${st.line}`}
      >
        <div className="w-full rounded-[1.75rem] bg-surface shadow-[var(--shadow-1)] overflow-hidden transition-shadow group-hover:shadow-[var(--shadow-2)]">
          <Vignette id={st.id} run={run} />
        </div>
        <div className="grid grid-cols-[1.75rem_1fr] gap-x-2 items-baseline px-1">
          <span className="text-xs num text-ink-faint">0{i + 1}</span>
          <span>{st.title}</span>
          <span />
          <span className="text-sm text-ink-soft">{st.line}</span>
        </div>
      </button>
    </li>
  );
}

/** All four steps at once; each plays when pointed at, focused or tapped. */
export function PathGrid() {
  return (
    <ol className="grid sm:grid-cols-2 gap-x-5 gap-y-8" aria-label="The whole path">
      {STEPS.map((st, i) => <GridItem key={st.id} i={i} st={st} />)}
    </ol>
  );
}
