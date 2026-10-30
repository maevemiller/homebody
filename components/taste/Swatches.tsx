import { patternSrc, textureSrc, type Material, type Palette, type Pattern } from "@/lib/taste/visual";

// Palettes render 60-30-10, so a strip reads like a room rather than a paint chart
// (palettes-materials-patterns.md §1). Materials and patterns are photographed: Poly Haven
// CC0 textures or a cropped photo of the real fabric. Only metals are drawn, as a polished chip.

export function PaletteStrip({ p, className = "" }: { p: Palette; className?: string }) {
  return (
    <div className={`flex overflow-hidden ${className}`} aria-hidden>
      {p.hex.map((h, i) => <span key={h + i} style={{ background: h, flex: [30, 20, 14, 14, 11, 11][i] }} />)}
    </div>
  );
}

// A pattern at roughly pillow scale
export function PatternFace({ p, className = "" }: { p: Pattern; className?: string }) {
  const src = p.photo ? patternSrc(p.photo) : textureSrc(p.texture!);
  return <span aria-hidden className={`block dark:ring-1 dark:ring-inset dark:ring-white/25 ${className}`} style={{ backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }} />;
}

// A material's surface: its photographed texture (color-corrected where needed); the chip is only a fallback
export function MaterialFace({ m, className = "" }: { m: Material; className?: string }) {
  const style: React.CSSProperties = m.texture
    ? { backgroundImage: `url(${textureSrc(m.texture)})`, backgroundSize: m.zoom ?? "cover", backgroundPosition: "center", filter: m.filter }
    : { background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.6) 0, transparent 34%), radial-gradient(circle at 70% 78%, rgba(0,0,0,.28) 0, transparent 52%), linear-gradient(135deg, ${m.hex}, ${m.hex})` };
  // a hairline light ring keeps dark swatches (walnut, leather, black steel) visible in dark mode
  return <span aria-hidden className={`block dark:ring-1 dark:ring-inset dark:ring-white/25 ${className}`} style={style} />;
}
