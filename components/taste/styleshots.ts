import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { STYLE_PRESETS, STYLE_SHOTS, type StylePreset } from "@/lib/taste/styleviews";

// Her captured room restyled in each preset, rendered once per page in one offscreen renderer that's
// let go as soon as they're done. The room model's material names say what each surface is
// (blender/build_room.py: "wall:paint:#efece6", "item:boucle:#e6dfd2", "drape:item:linen:#ebe5d9"), so
// each surface takes its preset color; everything else (books, plants, glass, frames) stays as built.

const W = 640;
const H = 480;

type Surface = keyof StylePreset["colors"];
const FABRICS = /^(fabric|boucle|linen|velvet|wool|chenille|cotton|leather_soft|knit)$/;
const WOODS = /^(wood_\w+|oak|walnut|teak|ash|pine|maple|cherry|reclaimed|rattan|cane)$/;

function surfaceOf(name: string): Surface | null {
  if (name.startsWith("wall:")) return "wall";
  if (name.startsWith("floor:")) return "floor";
  if (name.startsWith("rug:")) return "rug";
  if (name.startsWith("drape:")) return "curtain";
  const kind = /^item:([a-z_]+):/.exec(name)?.[1];
  if (!kind) return null;
  if (kind === "leather") return "leather";
  if (FABRICS.test(kind)) return "fabric";
  if (WOODS.test(kind)) return "wood";
  if (kind === "painted") return "painted";
  if (kind.startsWith("metal")) return "metal";
  return null;
}

interface Swatch {
  mat: THREE.MeshStandardMaterial;
  surface: Surface;
  // the color Blender baked into the texture, in linear, so a new color can scale it rather than stack on it
  baked: THREE.Color;
  map: THREE.Texture | null;
}

let running: Promise<boolean> | null = null;

/** Whether her room's restyled views are ready, or will be once the running render finishes. */
export const styleShotsReady = (): Promise<boolean> =>
  STYLE_SHOTS.size === STYLE_PRESETS.length ? Promise.resolve(true) : running ?? Promise.resolve(false);

export const styleShotsPending = () => running !== null;

/** Render her captured room in every preset. Never throws: no room, no build or no WebGL just means stock photos. */
export function renderStyleShots(): Promise<boolean> {
  if (STYLE_SHOTS.size === STYLE_PRESETS.length) return Promise.resolve(true);
  running ??= render().catch(() => false).finally(() => {
    running = null;
  });
  return running;
}

async function render(): Promise<boolean> {
  const cap = readJson<{ roomId?: string; absent?: string[] }>("homebody-capture", {});
  if (!cap.roomId || !/^[\w-]+$/.test(cap.roomId)) return false;
  const room = await fetch(`/api/rooms/${cap.roomId}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!room?.build) return false;
  // pieces she's getting rid of, or that the scan saw but aren't there, aren't in her restyled room
  const bins = readJson<Record<string, string>>(`homebody-bins-${cap.roomId}`, {});
  const gone = new Set([...(cap.absent ?? []), ...Object.entries(bins).filter(([, b]) => b === "remove").map(([id]) => id)]);
  const url = `/api/rooms/${cap.roomId}/files/build/room.glb?v=${room.build.seconds}-${room.status?.refinedAt ?? ""}`;
  const gltf = await new GLTFLoader().loadAsync(url);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return false;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  // JPEG has no transparency: the page's white, so the cutaway reads as a model on the page
  renderer.setClearColor(0xf7f7f5, 1);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xfff3e2, 0x8a7a66, 0.75));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  const root = gltf.scene;
  const walls: { obj: THREE.Object3D; outward: THREE.Vector3; i: number }[] = [];
  const items: THREE.Object3D[] = [];
  const swatches: Swatch[] = [];
  const seen = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const ud = o.userData as Record<string, unknown>;
    if (ud.homebody_ceiling) o.visible = false;
    if (typeof ud.homebody_item === "string" && gone.has(ud.homebody_item)) o.visible = false;
    if (typeof ud.homebody_wall === "number" && Array.isArray(ud.outward)) {
      const [ox, oy] = ud.outward as number[];
      walls.push({ obj: o, outward: new THREE.Vector3(ox, 0, -oy), i: ud.homebody_wall });
    }
    if (typeof ud.homebody_item === "string") items.push(o);
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m: THREE.Material) => {
      if (seen.has(m)) return seen.get(m)!;
      const surface = surfaceOf(m.name);
      const std = m as THREE.MeshStandardMaterial;
      seen.set(m, std);
      const hex = /#[0-9a-f]{6}$/i.exec(m.name)?.[0];
      if (surface && hex && std.color) swatches.push({ mat: std, surface, baked: new THREE.Color(hex), map: std.map });
      return std;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
  });
  scene.add(root);

  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z);
  // a three-quarter view from above one corner, the way a room photo is taken from the doorway
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 200);
  const target = new THREE.Vector3(center.x, size.y * 0.22, center.z);
  const reach = new THREE.Vector2(size.x, size.z).length() / 2;
  const dist = (reach / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.82;
  camera.position.copy(target).addScaledVector(new THREE.Vector3(0.62, 0.72, 0.82).normalize(), dist);
  camera.lookAt(target);
  sun.position.set(center.x - span, span * 2, center.z + span * 0.6);
  sun.target.position.copy(center);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -span;
  sc.right = sc.top = span;
  sc.updateProjectionMatrix();
  // walls facing the camera come away, as in Plug & Play, and so does what hangs on them or stands
  // tall against them, which would otherwise be all the picture shows
  const view = new THREE.Vector3().subVectors(camera.position, target).setY(0).normalize();
  const cut: THREE.Box3[] = [];
  for (const w of walls) {
    w.obj.visible = w.outward.dot(view) < 0.2;
    if (!w.obj.visible) cut.push(new THREE.Box3().setFromObject(w.obj).expandByScalar(0.45));
  }
  const hiddenWalls = new Set(walls.filter((w) => !w.obj.visible).map((w) => w.i));
  for (const item of items) {
    const ud = item.userData as Record<string, unknown>;
    const ib = new THREE.Box3().setFromObject(item);
    const near = ib.getCenter(new THREE.Vector3()).sub(center).setY(0).dot(view) > 0;
    const tall = near && ib.max.y - ib.min.y > 1.2 && cut.some((b) => b.intersectsBox(ib));
    if ((typeof ud.homebody_on_wall === "number" && hiddenWalls.has(ud.homebody_on_wall)) || tall) item.visible = false;
  }

  const paint = new THREE.Color();
  for (const p of STYLE_PRESETS) {
    if (STYLE_SHOTS.has(p.id)) continue;
    for (const s of swatches) {
      paint.set(p.colors[s.surface]);
      if (!s.map) {
        s.mat.color.copy(paint);
        continue;
      }
      // the texture already carries Blender's color: scale it to the new one, keeping the grain.
      // Near-black bakes can't be lifted that far, so those lose the grain instead.
      const k = Math.max(paint.r / Math.max(s.baked.r, 1e-4), paint.g / Math.max(s.baked.g, 1e-4), paint.b / Math.max(s.baked.b, 1e-4));
      const flat = k > 5;
      if (flat !== !s.mat.map) {
        s.mat.map = flat ? null : s.map;
        s.mat.needsUpdate = true;
      }
      if (flat) s.mat.color.copy(paint);
      else s.mat.color.setRGB(paint.r / Math.max(s.baked.r, 1e-4), paint.g / Math.max(s.baked.g, 1e-4), paint.b / Math.max(s.baked.b, 1e-4));
    }
    renderer.render(scene, camera);
    STYLE_SHOTS.set(p.id, renderer.domElement.toDataURL("image/jpeg", 0.88));
    await new Promise((r) => ("requestIdleCallback" in window ? window.requestIdleCallback(() => r(null), { timeout: 500 }) : setTimeout(r, 16)));
  }

  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      (m as THREE.MeshStandardMaterial).map?.dispose();
      m.dispose();
    }
  });
  for (const s of swatches) s.map?.dispose();
  scene.environment?.dispose();
  pmrem.dispose();
  renderer.dispose();
  return STYLE_SHOTS.size === STYLE_PRESETS.length;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") ?? fallback;
  } catch {
    return fallback;
  }
}
