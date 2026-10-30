"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type Bin = "keep" | "move" | "remove";
export type ViewMode = "empty" | "all" | "kept";

export const BIN_COLORS: Record<Bin, string> = { keep: "#4f8a5b", move: "#c49a3e", remove: "#c05a4c" };

interface Props {
  url: string;
  bins: Record<string, Bin | undefined>;
  selected: Set<string>;
  mode: ViewMode;
  onPick: (id: string) => void;
  // items the owner said aren't actually in the room
  hidden?: Set<string>;
}

interface Tinted {
  mat: THREE.MeshStandardMaterial;
  emissive: THREE.Color;
  intensity: number;
}

// The room model from Blender. Walls facing the camera hide themselves so the
// room reads like a dollhouse from any angle; items are tagged by Blender with
// userData.homebody_item so they can be selected, tinted by bin, or hidden.
export default function GlbViewer({ url, bins, selected, mode, onPick, hidden }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<string, { root: THREE.Object3D; mats: Tinted[]; wall?: number }>());
  const hiddenWalls = useRef(new Set<number>());
  // which url finished loading, and whether it worked; anything else is still loading
  const [loaded, setLoaded] = useState<{ url: string; ok: boolean; noGl?: boolean } | null>(null);
  // Chrome turns WebGL off after too many crashed 3D pages (or on some GPUs); then show Blender's renders instead
  const [hasGl] = useState(() => {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch {
      return false;
    }
  });
  const latest = useRef({ bins, selected, mode, onPick, hidden });

  // Re-tint and show/hide items to match the current sorting and view mode
  function applyLook() {
    const { bins: b, selected: sel, mode: m, hidden: gone } = latest.current;
    for (const [id, { root, mats, wall }] of items.current) {
      const bin = b[id];
      // art and shelves hung on a cut-away wall go with it
      const onHiddenWall = wall !== undefined && hiddenWalls.current.has(wall);
      root.visible = !gone?.has(id) && !onHiddenWall && (m === "all" || (m === "kept" && bin !== "move" && bin !== "remove"));
      for (const t of mats) {
        if (sel.has(id)) {
          t.mat.emissive.set("#ffffff");
          t.mat.emissiveIntensity = 0.35;
        } else if (bin) {
          t.mat.emissive.set(BIN_COLORS[bin]);
          // yellow barely shows on light fabrics without a stronger push
          t.mat.emissiveIntensity = bin === "move" ? 0.85 : 0.5;
        } else {
          t.mat.emissive.copy(t.emissive);
          t.mat.emissiveIntensity = t.intensity;
        }
      }
    }
  }

  useEffect(() => {
    const el = host.current!;
    if (!hasGl) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      Promise.resolve().then(() => setLoaded({ url, ok: false, noGl: true }));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(getComputedStyle(el).getPropertyValue("--surface-2").trim() || "#e2dccc");
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8a7f70, 0.6));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.49;

    const walls: { obj: THREE.Object3D; outward: THREE.Vector3 }[] = [];
    let ceiling: THREE.Object3D | null = null;
    let disposed = false;

    new GLTFLoader().load(url, (gltf) => {
      if (disposed) return;
      const root = gltf.scene;
      root.traverse((o) => {
        const ud = o.userData as Record<string, unknown>;
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
        if (typeof ud.homebody_wall === "number" && Array.isArray(ud.outward)) {
          // Blender's (x, y) floor plane becomes three's (x, -z) after the glTF y-up export
          const [ox, oy] = ud.outward as number[];
          walls.push({ obj: o, outward: new THREE.Vector3(ox, 0, -oy) });
        }
        if (ud.homebody_ceiling) ceiling = o;
        if (typeof ud.homebody_item === "string") {
          const mats: Tinted[] = [];
          o.traverse((m) => {
            if (!(m instanceof THREE.Mesh)) return;
            const list = (Array.isArray(m.material) ? m.material : [m.material]).map((mat) => {
              const own = (mat as THREE.MeshStandardMaterial).clone();
              mats.push({ mat: own, emissive: own.emissive.clone(), intensity: own.emissiveIntensity });
              return own;
            });
            m.material = Array.isArray(m.material) ? list : list[0];
          });
          items.current.set(ud.homebody_item, { root: o, mats, wall: typeof ud.homebody_on_wall === "number" ? ud.homebody_on_wall : undefined });
        }
      });
      scene.add(root);

      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.z);
      controls.target.set(center.x, size.y * 0.25, center.z);
      camera.position.set(center.x + span * 0.85, span * 1.1, center.z + span * 1.05);
      sun.position.set(center.x - span, span * 2, center.z + span * 0.6);
      sun.target.position.copy(center);
      const cam = sun.shadow.camera as THREE.OrthographicCamera;
      cam.left = cam.bottom = -span;
      cam.right = cam.top = span;
      cam.updateProjectionMatrix();
      controls.update();
      applyLook();
      setLoaded({ url, ok: true });
    }, undefined, () => {
      if (!disposed) setLoaded({ url, ok: false });
    });

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // that was a drag
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      for (const hit of ray.intersectObjects(scene.children, true)) {
        if (!isShown(hit.object)) continue;
        let o: THREE.Object3D | null = hit.object;
        while (o && typeof o.userData.homebody_item !== "string") o = o.parent;
        if (o) latest.current.onPick(o.userData.homebody_item as string);
        return;
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const view = new THREE.Vector3();
    renderer.setAnimationLoop(() => {
      controls.update();
      view.subVectors(camera.position, controls.target).setY(0).normalize();
      let changed = false;
      for (const w of walls) {
        w.obj.visible = w.outward.dot(view) < 0.2;
        const i = w.obj.userData.homebody_wall as number;
        if (w.obj.visible === hiddenWalls.current.has(i)) {
          changed = true;
          if (w.obj.visible) hiddenWalls.current.delete(i);
          else hiddenWalls.current.add(i);
        }
      }
      if (changed) applyLook();
      if (ceiling) ceiling.visible = false;
      renderer.render(scene, camera);
    });

    const tracked = items.current;
    return () => {
      disposed = true;
      ro.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      tracked.clear();
    };
  }, [url, hasGl]);

  useEffect(() => {
    latest.current = { bins, selected, mode, onPick, hidden };
    applyLook();
  });

  const state = !hasGl || (loaded?.url === url && loaded.noGl) ? "nogl" : loaded?.url === url ? (loaded.ok ? "ready" : "error") : "loading";
  if (state === "nogl") {
    // the same build folder holds the Blender renders
    const still = url.replace(/room\.glb(\?.*)?$/, "render_dollhouse.png$1");
    return (
      <div className="relative w-full h-full min-h-[280px] rounded-md overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={still} alt="Your room, rendered" className="absolute inset-0 w-full h-full object-contain" />
        <p className="absolute inset-x-0 bottom-0 m-2 rounded bg-bg/90 px-3 py-2 text-xs text-ink-soft">
          3D is turned off in this browser, so here&apos;s your room as a still. Quit and reopen Chrome to turn 3D back on.
        </p>
      </div>
    );
  }
  return (
    <div className="relative w-full h-full min-h-[280px]">
      <div ref={host} className="absolute inset-0 rounded-md overflow-hidden" />
      {state !== "ready" && (
        <p className="absolute inset-0 grid place-items-center text-sm text-ink-soft pointer-events-none">
          {state === "loading" ? "Loading your room…" : "We couldn't show the 3D room. Refresh the page to try again."}
        </p>
      )}
    </div>
  );
}

function isShown(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}
