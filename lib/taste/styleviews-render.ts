import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { StylePreset } from "./styleviews";

// Her captured room, restyled per preset and rendered offscreen (client only; imported dynamically so
// three.js stays out of the interview's first load). One renderer, one load of the room's glb, then a
// frame per preset: the walls, floor, rug, curtains and the loose pieces' fabric, wood, leather, metal and
// paint take the preset's colors; the architecture, built-ins and layout stay as the scan made them.
//
// The camera stands where a photographer would, as Blender's eye-level views do (blender/build_room.py):
// in a corner or at a wall's middle, 1.5 m up, stepped clear of tall pieces, aimed at the furniture, with
// a phone's 22–24 mm lens. The spot that sees the most pieces wins.

const W = 640;
const H = 480;

type Role = keyof StylePreset["colors"];

// The Blender build names every material "<part>:<kind>:<hex>" (blender/build_room.py)
function roleOf(name: string): Role | null {
  const n = name.toLowerCase();
  if (n.startsWith("wall:")) return "wall";
  if (n.startsWith("floor:")) return "floor";
  if (n.startsWith("rug:")) return "rug";
  if (n.startsWith("drape:")) return "curtain";
  if (/^(item:)?metal/.test(n)) return "metal";
  if (/^(item:)?leather/.test(n)) return "leather";
  if (/^(item:)?(wood|oak|walnut|teak|pine|ash|maple|cherry)/.test(n)) return "wood";
  if (/^(item:)?(boucle|fabric|linen|velvet|wool|cotton|corduroy|upholster|chenille|tweed)/.test(n)) return "fabric";
  if (/^(item:)?painted/.test(n)) return "painted";
  return null;
}

// The average color of a texture, in linear space, so a tint lands on the preset's color, grain kept
const avgCache = new WeakMap<object, THREE.Color>();
function averageOf(tex: THREE.Texture): THREE.Color | null {
  const img = tex.image as CanvasImageSource | undefined;
  if (!img) return null;
  const hit = avgCache.get(img as object);
  if (hit) return hit;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 8;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data;
    let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      gg += d[i + 1];
      b += d[i + 2];
    }
    const n = d.length / 4;
    const col = new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
    avgCache.set(img as object, col);
    return col;
  } catch {
    return null;
  }
}

interface Surface {
  mat: THREE.MeshStandardMaterial;
  role: Role;
  map: THREE.Texture | null;
  avg: THREE.Color | null;
}

function paint(s: Surface, hex: string) {
  const target = new THREE.Color(hex);
  const { mat, map, avg } = s;
  if (map && avg) {
    const ratio = [target.r / Math.max(avg.r, 1e-3), target.g / Math.max(avg.g, 1e-3), target.b / Math.max(avg.b, 1e-3)];
    // too far from the texture's own color (dark walnut to pale oak) and the grain turns garish: paint it flat
    if (Math.max(...ratio) <= 3.5 && Math.min(...ratio) >= 0.2) {
      mat.map = map;
      mat.color.setRGB(ratio[0], ratio[1], ratio[2], THREE.LinearSRGBColorSpace);
    } else {
      mat.map = null;
      mat.color.copy(target);
    }
  } else mat.color.copy(target);
  mat.needsUpdate = true;
}

const isFixed = (o: THREE.Object3D | null): boolean => {
  for (; o; o = o.parent) if (o.userData?.homebody_fixed) return true;
  return false;
};

// Where to stand: the eye-level spot that sees the most of the room's pieces
function viewpoint(root: THREE.Object3D): { eye: THREE.Vector3; aim: THREE.Vector3; lens: number } {
  let floor: THREE.Object3D | null = null;
  const items: { box: THREE.Box3; fixed: boolean; curtains: boolean }[] = [];
  root.traverse((o) => {
    if (o.userData?.homebody_floor) floor = o;
    if (typeof o.userData?.homebody_item === "string") {
      const box = new THREE.Box3().setFromObject(o);
      if (!box.isEmpty()) items.push({ box, fixed: !!o.userData.homebody_fixed, curtains: /curtain|drape/i.test(String(o.userData.homebody_item)) });
    }
  });
  const whole = new THREE.Box3().setFromObject(floor ?? root);
  const y0 = floor ? whole.max.y : whole.min.y;
  // the floor's own corners (the footprint), else its bounding box
  let pts: THREE.Vector2[] = [];
  const f = floor as THREE.Object3D | null;
  if (f) {
    const seen = new Set<string>();
    f.updateWorldMatrix(true, true);
    f.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const pos = o.geometry.getAttribute("position");
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const key = `${v.x.toFixed(2)},${v.z.toFixed(2)}`;
        if (!seen.has(key)) {
          seen.add(key);
          pts.push(new THREE.Vector2(v.x, v.z));
        }
      }
    });
  }
  if (pts.length < 3 || pts.length > 40) pts = [new THREE.Vector2(whole.min.x, whole.min.z), new THREE.Vector2(whole.max.x, whole.min.z), new THREE.Vector2(whole.max.x, whole.max.z), new THREE.Vector2(whole.min.x, whole.max.z)];
  const centroid = pts.reduce((a, p) => a.add(p), new THREE.Vector2()).divideScalar(pts.length);
  pts.sort((a, b) => Math.atan2(a.y - centroid.y, a.x - centroid.x) - Math.atan2(b.y - centroid.y, b.x - centroid.x));
  const size = Math.max(whole.max.x - whole.min.x, whole.max.z - whole.min.z);
  const lens = size < 4.5 ? 22 : 24;

  const furn = items.filter((i) => !i.fixed && !i.curtains);
  const center = (b: THREE.Box3) => b.getCenter(new THREE.Vector3());
  const aim2 = furn.length ? furn.reduce((a, i) => a.add(new THREE.Vector2(center(i.box).x, center(i.box).z)), new THREE.Vector2()).divideScalar(furn.length) : centroid.clone();
  const blocked = (p: THREE.Vector2) =>
    items.some(({ box }) => {
      const lo = box.min.y - y0;
      const hi = box.max.y - y0;
      if (lo > 1.6 || hi < 1.1) return false;
      return p.x > box.min.x - 0.35 && p.x < box.max.x + 0.35 && p.y > box.min.z - 0.35 && p.y < box.max.z + 0.35;
    });
  const half = Math.atan(18 / lens) * 0.92;
  const score = (p: THREE.Vector2) => {
    const fwd = aim2.clone().sub(p).normalize();
    let seen = 0;
    for (const i of items) {
      const c = center(i.box);
      const q = new THREE.Vector2(c.x - p.x, c.z - p.y);
      if (q.length() < 0.6) continue;
      if (Math.acos(THREE.MathUtils.clamp(q.normalize().dot(fwd), -1, 1)) < half) seen += i.fixed || i.curtains ? 0.5 : 1;
    }
    return seen;
  };
  const spots = [...pts, ...pts.map((p, i) => p.clone().add(pts[(i + 1) % pts.length]).multiplyScalar(0.5))];
  let best: { s: number; p: THREE.Vector2 } | null = null;
  for (const corner of spots) {
    let t = 0.08;
    const at = (t: number) => corner.clone().lerp(centroid, t);
    let p = at(t);
    while ((blocked(p) || p.distanceTo(corner) < 0.4) && t < 0.55) p = at((t += 0.04));
    if (blocked(p)) continue;
    const s = score(p);
    if (!best || s > best.s) best = { s, p };
  }
  const p = best?.p ?? centroid.clone().lerp(pts[0], 0.6);
  return { eye: new THREE.Vector3(p.x, y0 + 1.5, p.y), aim: new THREE.Vector3(aim2.x, y0 + 1.0, aim2.y), lens };
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

// Renders each preset and hands back a JPEG data URL as it lands. Throws when WebGL or the room fails.
export async function renderStyleViews(url: string, presets: StylePreset[], onShot: (id: string, dataUrl: string) => void, alive: () => boolean = () => true): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    // what shows through the windows: a pale, overcast sky
    scene.background = new THREE.Color("#e8ecee");
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.8;
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8a7f70, 0.55));

    const gltf = await new GLTFLoader().loadAsync(url);
    if (!alive()) return;
    const root = gltf.scene;
    scene.add(root);

    // every recolorable surface, each loose piece with its own copy so built-ins sharing a material keep theirs
    const surfaces: Surface[] = [];
    const copies = new Map<string, THREE.MeshStandardMaterial>();
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const fixed = isFixed(o);
      const swap = (m: THREE.Material) => {
        const role = roleOf(m.name);
        // built-ins (a fireplace surround, an accent panel) are architecture: only walls and floor change there
        if (!role || !(m instanceof THREE.MeshStandardMaterial) || (fixed && role !== "wall" && role !== "floor")) return m;
        const key = `${m.uuid}:${fixed}`;
        let own = copies.get(key);
        if (!own) {
          own = m.clone();
          copies.set(key, own);
          surfaces.push({ mat: own, role, map: m.map, avg: m.map ? averageOf(m.map) : null });
        }
        return own;
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });

    const { eye, aim, lens } = viewpoint(root);
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.05, 200);
    camera.filmGauge = 36;
    camera.setFocalLength(lens);
    camera.position.copy(eye);
    camera.lookAt(aim);

    // soft daylight from above and behind the camera, so the pieces sit on the floor
    const box = new THREE.Box3().setFromObject(root);
    const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.1);
    sun.position.set(eye.x + (eye.x - aim.x) * 0.5, box.max.y + span, eye.z + (eye.z - aim.z) * 0.5);
    sun.target.position.copy(box.getCenter(new THREE.Vector3()));
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 4;
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = sc.bottom = -span;
    sc.right = sc.top = span;
    sc.far = span * 6;
    sc.updateProjectionMatrix();
    scene.add(sun, sun.target);

    for (const p of presets) {
      if (!alive()) return;
      for (const s of surfaces) paint(s, p.colors[s.role]);
      renderer.render(scene, camera);
      onShot(p.id, canvas.toDataURL("image/jpeg", 0.84));
      // one preset a frame, so the conversation never stutters
      await frame();
    }
    pmrem.dispose();
    for (const m of copies.values()) m.dispose();
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
