import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Product } from "@/lib/play/catalog";
import { buildProduct, contactShadow } from "./models";

// Catalog thumbnails rendered from the same parametric models the room uses, once per page,
// in one small offscreen renderer that's let go as soon as they're done. Cached by product id.

const cache = new Map<string, string>();
const SIZE = 192;

export const thumbOf = (id: string) => cache.get(id);

/** Render any missing thumbnails; resolves with how many are ready. Never throws: no WebGL just means no thumbnails. */
export async function renderThumbs(products: Product[]): Promise<number> {
  const todo = products.filter((p) => !cache.has(p.id));
  if (!todo.length) return cache.size;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return cache.size;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);

  for (const p of todo) {
    const scene = new THREE.Scene();
    scene.environment = env;
    scene.environmentIntensity = 0.8;
    const key = new THREE.DirectionalLight(0xfff1dc, 1.4);
    key.position.set(2, 4, -3);
    scene.add(key, new THREE.HemisphereLight(0xfff6ea, 0x8a7f70, 0.4));
    const model = buildProduct(p);
    scene.add(model);
    if (p.category !== "rug" && p.category !== "art") {
      const blob = contactShadow(p.w, p.d);
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.002;
      scene.add(blob);
    }
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    // three-quarter front view (the front faces -z); art straight on, rugs from higher up
    const dir = p.category === "art" ? new THREE.Vector3(0.25, 0.1, -1) : p.category === "rug" ? new THREE.Vector3(0.7, 1.5, -1) : new THREE.Vector3(0.9, 0.6, -1.3);
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.92;
    camera.position.copy(center).addScaledVector(dir.normalize(), dist);
    camera.lookAt(center);
    renderer.render(scene, camera);
    cache.set(p.id, renderer.domElement.toDataURL("image/png"));
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.MeshStandardMaterial).map?.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    // one per idle moment, so taps and drags in the room stay smooth while these draw
    await new Promise((r) => ("requestIdleCallback" in window ? window.requestIdleCallback(() => r(null), { timeout: 500 }) : setTimeout(r, 16)));
  }
  env.dispose();
  pmrem.dispose();
  renderer.dispose();
  return cache.size;
}
