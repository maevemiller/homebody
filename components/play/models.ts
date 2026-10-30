import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Product } from "@/lib/play/catalog";

// Simple parametric models for the sample catalog and for pieces people are
// bringing. Every model stands on y = 0, centered on its footprint, with the
// width along x and its front facing -z (plan +y, as in lib/scan/spec.ts).

interface Finish {
  roughness: number;
  metalness: number;
  sheen?: number;
}

const FINISH: Record<string, Finish> = {
  boucle: { roughness: 1, metalness: 0, sheen: 1 },
  linen: { roughness: 0.92, metalness: 0, sheen: 0.6 },
  wool: { roughness: 1, metalness: 0, sheen: 0.5 },
  jute: { roughness: 1, metalness: 0 },
  leather: { roughness: 0.5, metalness: 0 },
  white_oak: { roughness: 0.62, metalness: 0 },
  walnut: { roughness: 0.55, metalness: 0 },
  reclaimed: { roughness: 0.8, metalness: 0 },
  brass: { roughness: 0.32, metalness: 0.9 },
  black_steel: { roughness: 0.5, metalness: 0.65 },
  limestone: { roughness: 0.78, metalness: 0 },
  paper: { roughness: 0.95, metalness: 0 },
};

function mat(color: string, material: string, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  const f = FINISH[material] ?? { roughness: 0.7, metalness: 0 };
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: f.roughness, metalness: f.metalness, ...extra });
  if (f.sheen) {
    m.sheen = f.sheen;
    m.sheenRoughness = 0.8;
    m.sheenColor = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.4);
  }
  return m;
}

function box(g: THREE.Group, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, r = 0.02) {
  const rad = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, rad), m);
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}

function cyl(g: THREE.Group, m: THREE.Material, rTop: number, rBot: number, h: number, x: number, y: number, z: number, seg = 24, open = false) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open), m);
  mesh.position.set(x, y + h / 2, z);
  g.add(mesh);
  return mesh;
}

function legs(g: THREE.Group, m: THREE.Material, w: number, d: number, h: number, inset = 0.07, r = 0.018) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, m, r, r * 0.75, h, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), 12);
}

function seating(g: THREE.Group, p: Product, seats: number) {
  const { w, d, h } = p;
  const body = mat(p.color, p.material);
  const wood = mat(p.accent, p.accentMaterial);
  const leg = 0.1;
  const curved = p.look?.includes("boucle");
  const arm = curved ? 0.2 : 0.14;
  const seatH = 0.44;
  legs(g, wood, w, d, leg, 0.08);
  box(g, body, w, seatH - leg - 0.12, d, 0, leg, 0, 0.05);
  // back and arms
  box(g, body, w, h - leg, 0.2, 0, leg, d / 2 - 0.1, curved ? 0.09 : 0.04);
  for (const sx of [-1, 1]) box(g, body, arm, (curved ? 0.62 : 0.58) - leg, d, sx * (w / 2 - arm / 2), leg, 0, curved ? 0.09 : 0.04);
  // seat cushions
  const inner = w - arm * 2;
  const cw = inner / seats;
  for (let i = 0; i < seats; i++) {
    box(g, body, cw - 0.012, 0.13, d - 0.24, -inner / 2 + cw * (i + 0.5), seatH - 0.13, -0.05, 0.05);
    box(g, body, cw - 0.03, h - seatH - 0.08, 0.16, -inner / 2 + cw * (i + 0.5), seatH, d / 2 - 0.27, 0.06).rotation.x = -0.12;
  }
}

function rug(g: THREE.Group, p: Product) {
  box(g, mat(p.accent, p.material), p.w, p.h, p.d, 0, 0, 0, 0.004);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(p.w - 0.24, p.d - 0.24), mat(p.color, p.material));
  field.rotation.x = -Math.PI / 2;
  field.position.y = p.h + 0.001;
  g.add(field);
}

function lamp(g: THREE.Group, p: Product) {
  const metal = mat(p.color, p.material);
  const glow = new THREE.MeshStandardMaterial({ color: p.accent, emissive: "#ffe2b0", emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide });
  if (p.variant === "lantern") {
    const wood = mat(p.accent, p.accentMaterial);
    cyl(g, wood, 0.16, 0.18, 0.03, 0, 0, 0, 32);
    cyl(g, wood, 0.012, 0.012, p.h - 0.6, 0, 0.03, 0, 8);
    const shade = new THREE.Mesh(new THREE.SphereGeometry(p.w / 2, 32, 20), new THREE.MeshStandardMaterial({ color: p.color, emissive: "#fff1d6", emissiveIntensity: 0.7, roughness: 0.95 }));
    shade.scale.y = 1.25;
    shade.position.y = p.h - p.w / 2 * 1.25;
    g.add(shade);
    return;
  }
  // arc: a weighted base, a curved stem and a dome shade reaching forward
  cyl(g, mat("#e9e4da", "limestone"), 0.17, 0.17, 0.05, 0, 0, 0.1, 32);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.05, 0.1), new THREE.Vector3(0, p.h + 0.25, 0.1), new THREE.Vector3(0, p.h - 0.15, -0.75));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.012, 10), metal));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal);
  dome.position.set(0, p.h - 0.2, -0.75);
  g.add(dome);
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.19, 32), glow);
  bulb.rotation.x = Math.PI / 2;
  bulb.position.set(0, p.h - 0.2, -0.75);
  g.add(bulb);
}

function table(g: THREE.Group, p: Product) {
  const top = mat(p.color, p.material);
  const base = mat(p.accent, p.accentMaterial);
  const { w, d, h } = p;
  if (p.variant === "plinth") {
    box(g, top, w, 0.06, d, 0, h - 0.06, 0, 0.01);
    for (const sx of [-1, 1]) box(g, base, 0.24, h - 0.06, d - 0.12, sx * (w / 2 - 0.22), 0, 0, 0.01);
    return;
  }
  if (p.variant === "oval") {
    const t = cyl(g, top, 0.5, 0.5, 0.04, 0, h - 0.04, 0, 48);
    t.scale.set(w, 1, d);
    for (const [x, z] of [[-w * 0.3, -d * 0.25], [w * 0.3, -d * 0.25], [-w * 0.3, d * 0.25], [w * 0.3, d * 0.25]]) cyl(g, base, 0.025, 0.02, h - 0.04, x, 0, z, 12);
    return;
  }
  box(g, top, w, 0.06, d, 0, h - 0.06, 0, 0.012);
  // black steel hairpin-ish frame
  legs(g, base, w, d, h - 0.06, 0.08, 0.012);
}

function shelf(g: THREE.Group, p: Product) {
  const m = mat(p.color, p.material);
  const { w, d, h } = p;
  const t = p.material === "black_steel" ? 0.02 : 0.025;
  for (const sx of [-1, 1]) box(g, m, t, h, d, sx * (w / 2 - t / 2), 0, 0, 0.004);
  const shelves = 5;
  const deck = p.material === "black_steel" ? mat(p.accent, p.accentMaterial) : m;
  for (let i = 0; i < shelves; i++) box(g, deck, w - t * 2, t, d - 0.01, 0, 0.04 + (i * (h - 0.06)) / (shelves - 1), 0, 0.003);
  // a few books and a vase so it reads as lived-in
  const spines = ["#7a3b2e", "#d6c7a4", "#2f4f5f", "#9c8b6e", "#3d3a35", "#b8704e"];
  for (let row = 0; row < shelves - 1; row++) {
    const y = 0.04 + t + (row * (h - 0.06)) / (shelves - 1);
    let x = -w / 2 + t + 0.03;
    const end = row % 2 ? 0.1 : w / 2 - t - 0.05;
    let k = row * 3;
    while (x < end) {
      const bw = 0.025 + ((k * 7) % 4) * 0.008;
      const bh = 0.2 + ((k * 5) % 5) * 0.025;
      box(g, mat(spines[k % spines.length], "paper"), bw, bh, d * 0.7, x + bw / 2, y, 0.02, 0.002);
      x += bw + 0.003;
      k++;
    }
    if (row % 2) cyl(g, mat("#e9e4da", "limestone"), 0.05, 0.07, 0.18, w / 2 - 0.16, y, 0, 20);
  }
}

function artTexture(colors: string[], seed: number) {
  const c = document.createElement("canvas");
  c.width = 384;
  c.height = 384;
  const x = c.getContext("2d")!;
  x.fillStyle = colors[0];
  x.fillRect(0, 0, 384, 384);
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  // a quiet abstract: soft blocks and an arc, in the product's colors
  for (let i = 1; i < colors.length; i++) {
    x.globalAlpha = 0.9;
    x.fillStyle = colors[i];
    if (i % 2) {
      x.beginPath();
      x.arc(80 + rnd() * 220, 90 + rnd() * 200, 50 + rnd() * 70, 0, Math.PI * 2);
      x.fill();
    } else {
      x.fillRect(rnd() * 200, rnd() * 220, 90 + rnd() * 120, 40 + rnd() * 100);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function art(g: THREE.Group, p: Product) {
  const { w, d, h } = p;
  const frame = mat(p.accent, p.accentMaterial);
  // hangs with its center at the model's mid-height; elevation sets how high
  box(g, frame, w, h, d, 0, 0, 0, 0.004);
  const mount = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.05, h - 0.05), new THREE.MeshStandardMaterial({ color: "#f7f4ee", roughness: 0.9 }));
  mount.position.set(0, h / 2, -d / 2 - 0.001);
  mount.rotation.y = Math.PI;
  g.add(mount);
  const seed = [...p.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.16, h - 0.16), new THREE.MeshStandardMaterial({ map: artTexture(p.art ?? [p.color, p.accent], seed), roughness: 0.85 }));
  pic.position.set(0, h / 2, -d / 2 - 0.002);
  pic.rotation.y = Math.PI;
  g.add(pic);
}

export function buildProduct(p: Product): THREE.Group {
  const g = new THREE.Group();
  if (p.category === "sofa") seating(g, p, p.w > 2.15 ? 3 : 2);
  else if (p.category === "chair") seating(g, p, 1);
  else if (p.category === "rug") rug(g, p);
  else if (p.category === "lamp") lamp(g, p);
  else if (p.category === "table") table(g, p);
  else if (p.category === "shelf") shelf(g, p);
  else if (p.category === "art") art(g, p);
  shadows(g, p.category !== "rug");
  return g;
}

function shadows(g: THREE.Object3D, cast: boolean) {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = cast;
      o.receiveShadow = true;
    }
  });
}

export function nameTag(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  const x = c.getContext("2d")!;
  const font = "600 44px Figtree, system-ui, sans-serif";
  x.font = font;
  const tw = Math.ceil(x.measureText(text).width);
  c.width = tw + 64;
  c.height = 84;
  x.font = font;
  x.fillStyle = "rgba(255,255,255,0.94)";
  x.beginPath();
  x.roundRect(2, 2, c.width - 4, c.height - 4, 40);
  x.fill();
  x.fillStyle = "#1d1d1f";
  x.textBaseline = "middle";
  x.fillText(text, 32, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const hgt = 0.15;
  s.scale.set((hgt * c.width) / c.height, hgt, 1);
  s.renderOrder = 10;
  return s;
}

/** A sized stand-in for a piece they're bringing that has no model yet, labeled with its name. */
export function buildPlaceholder(name: string, w: number, d: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: "#e8e8ed", roughness: 0.85 });
  box(g, body, w, h, d, 0, 0, 0, 0.03);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: "#1d1d1f", transparent: true, opacity: 0.55 }));
  edges.position.y = h / 2;
  g.add(edges);
  shadows(g, true);
  const tag = nameTag(name);
  tag.position.y = h + 0.16;
  g.add(tag);
  return g;
}

/** A flat rounded-rectangle ring just outside a w × d footprint, for the selected piece. */
export function ringGeometry(w: number, d: number): THREE.ShapeGeometry {
  const shape = (w: number, d: number, r: number) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -d / 2);
    s.lineTo(w / 2 - r, -d / 2);
    s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    s.lineTo(w / 2, d / 2 - r);
    s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    s.lineTo(-w / 2 + r, d / 2);
    s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    s.lineTo(-w / 2, -d / 2 + r);
    s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    return s;
  };
  const outer = shape(w + 0.14, d + 0.14, 0.09);
  outer.holes.push(shape(w + 0.06, d + 0.06, 0.05));
  return new THREE.ShapeGeometry(outer, 8);
}

let blobTex: THREE.CanvasTexture | null = null;
/** A soft, blurred footprint to ground a piece on the floor: a cheap contact shadow. */
export function contactShadow(w: number, d: number): THREE.Mesh {
  if (!blobTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.filter = "blur(14px)";
    x.fillStyle = "rgba(20,18,15,1)";
    x.beginPath();
    x.roundRect(30, 30, 68, 68, 16);
    x.fill();
    blobTex = new THREE.CanvasTexture(c);
  }
  // the texture's shape covers the middle 53%; size the plane so that matches the footprint plus a little
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry((w + 0.08) / 0.53, (d + 0.08) / 0.53),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.42, depthWrite: false, color: "#ffffff" }),
  );
  m.renderOrder = 1;
  return m;
}
