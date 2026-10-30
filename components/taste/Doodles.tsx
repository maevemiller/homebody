import type { Icon } from "@/lib/taste/session";

// Small ink doodles the dossier sketches beside a line, each a few strokes on a 24-unit
// grid. Every stroke has pathLength 1 and draws itself (.draw in globals.css), one after
// another, like a pen on paper. A shared turbulence filter (#hb-wobble, in Dossier) makes
// the lines a little uneven, as a hand would.

const P: Record<Exclude<Icon, "none">, string[]> = {
  coffee: ["M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z", "M16 11h2a2 2 0 0 1 0 4h-2", "M9 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4"],
  sofa: ["M4 12v-3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3", "M2.5 12.5a1.8 1.8 0 0 1 3.5 0V15h12v-2.5a1.8 1.8 0 0 1 3.5 0V17h-19z", "M5 17v2M19 17v2"],
  desk: ["M3 11h18", "M5 11v8M19 11v8", "M9 11V6h6v5", "M8.5 6h7"],
  book: ["M12 6c-2-1.5-5-1.8-8-1v13c3-.8 6-.5 8 1", "M12 6c2-1.5 5-1.8 8-1v13c-3-.8-6-.5-8 1", "M12 6v13"],
  tv: ["M3.5 6h17v10h-17z", "M9 19h6", "M12 16v3"],
  table: ["M3 10h18", "M5 10l-1 9M19 10l1 9", "M8 7c1-1 2.5-1 3.5 0M14 7.5h3"],
  plant: ["M8 15h8l-1 5H9z", "M12 15c0-4 0-7 0-9", "M12 10c-3 0-5-2-5-5 3 0 5 2 5 5", "M12 8c2-2.5 4-3 6-3-0.2 2.6-2.5 4.6-6 5"],
  cat: ["M6 20c-1-4 1-8 5-8s7 3 6 8z", "M8 12l-1-4 3 2.5M14 10.5l3-2.5-1 4", "M17 20c2 0 3-1 3-3", "M10 15.5h.01M14 15.5h.01"],
  dog: ["M7 9c0-2.5 2-4 5-4s5 1.5 5 4v4c0 3-2 5-5 5s-5-2-5-5z", "M7 9L4.5 13M17 9l2.5 4", "M10.5 11.5h.01M13.5 11.5h.01", "M11 15c.6.5 1.4.5 2 0"],
  child: ["M12 5.5a2.2 2.2 0 1 0 0 .01", "M12 9v6", "M8 11l4-1 4 1", "M12 15l-3 5M12 15l3 5"],
  people: ["M8 6a2 2 0 1 0 0 .01M16 6a2 2 0 1 0 0 .01", "M4.5 19c0-4 1.5-7 3.5-7s3.5 3 3.5 7", "M12.5 19c0-4 1.5-7 3.5-7s3.5 3 3.5 7"],
  lamp: ["M8 4h8l3 7H5z", "M12 11v8", "M8 20h8"],
  sun: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8", "M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5", "M5.2 5.2l1.8 1.8M17 17l1.8 1.8M5.2 18.8L7 17M17 7l1.8-1.8"],
  moon: ["M17 15.5A7 7 0 0 1 9 5a7 7 0 1 0 8 10.5z"],
  candle: ["M9 10h6v10H9z", "M12 10V8", "M12 3.5c1.5 1.6 1.5 3 0 4-1.5-1-1.5-2.4 0-4"],
  music: ["M9 18V6l10-2v12", "M9 18a2.5 2 0 1 1-5 0 2.5 2 0 0 1 5 0M19 16a2.5 2 0 1 1-5 0 2.5 2 0 0 1 5 0"],
  wine: ["M8 3h8c0 5-1.5 8-4 8s-4-3-4-8z", "M12 11v8", "M8.5 20h7"],
  bed: ["M3 18V8", "M3 13h18v5", "M6 13v-2.5h5V13", "M21 18v-3"],
  window: ["M5 3h14v18H5z", "M12 3v18M5 12h14"],
  heart: ["M12 19s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.5C19 14.6 12 19 12 19z"],
  home: ["M4 11l8-7 8 7", "M6 9.5V20h12V9.5", "M10 20v-5h4v5"],
  pin: ["M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z", "M12 8a2 2 0 1 0 0 .01"],
  plane: ["M3 13l18-7-5 14-3-6z", "M13 14l8-8"],
  star: ["M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"],
  leaf: ["M5 19C5 10 10 5 19 5c0 9-5 14-14 14z", "M5 19l9-9"],
  butterfly: ["M12 8v10", "M12 10C9 4 4 5 4 8.5S8 13 12 12", "M12 10c3-6 8-5 8-1.5S16 13 12 12", "M12 13c-3 0-6 1.5-5 4s4 1 5-2M12 13c3 0 6 1.5 5 4s-4 1-5-2"],
  brush: ["M14 4l6 6-7 7-6-6z", "M7 11l-3 3c-1 1-1 4 0 6 2 1 5 1 6 0l3-3"],
};

export default function Doodle({ icon, size = 22, delay = 0, className = "" }: { icon?: Icon; size?: number; delay?: number; className?: string }) {
  if (!icon || icon === "none") return null;
  const paths = P[icon];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={`shrink-0 overflow-visible ${className}`} style={{ filter: "url(#hb-wobble)" }} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d, i) => (
        <path key={i} d={d} pathLength={1} className="draw" style={{ ["--delay" as string]: `${delay + i * 0.18}s`, ["--dur" as string]: "0.45s" }} />
      ))}
    </svg>
  );
}
