"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { clashes, settle, wallsOf, type Piece, type Rect, type Settled, type Shape } from "@/lib/play/layout";
import { buildPlaceholder, buildProduct, contactShadow, ringGeometry } from "./models";

// The Plug & Play room: the Blender room.glb with the same dollhouse cutaway as
// GlbViewer, where pieces can be picked up, dragged across the floor (kept
// inside the walls, snapping flush to them), hung pieces slid along their wall,
// and new pieces dropped in. React owns the layout; this owns the motion.

export type View = "3d" | "top";

export interface SceneApi {
  /** Show a piece being dragged in from the panel under the pointer; returns where it would land, or null off the room. */
  ghostAt: (piece: Piece, shape: Shape, clientX: number, clientY: number) => (Settled & { elev: number; blocked: boolean }) | null;
  /** Drop the preview; `landed` when the layout is about to place that same piece. */
  clearGhost: (landed: boolean) => void;
  /** The room's axes closest to screen up and screen right, for arrow-key nudges. */
  screenAxes: () => { up: { x: number; y: number }; right: { x: number; y: number } };
  /** Walls that aren't cut away right now. */
  wallShown: (i: number) => boolean;
  /** Bring a piece to the middle of the view and close in on it (Swap on a phone); null goes back to the room view. */
  frame: (key: string | null) => void;
}

interface Props {
  url: string;
  footprint: { x: number; y: number }[];
  pieces: Piece[];
  shapes: Record<string, Shape>;
  selected: string | null;
  view: View;
  onSelect: (key: string | null) => void;
  onMove: (key: string, to: Settled) => void;
  // a drop refused because the spot is taken
  onRefuse: (why: string) => void;
  // floor that must stay clear (in front of doors)
  keepClear: Rect[];
  // the room's daylight, the same HDRI Blender lit it with
  hdri?: string;
  // the walls' real color (look.json from the photos, else the spec), for the walls and the backdrop
  wallTint?: string;
  // the items the room model marks as built in (glb extra homebody_fixed), with the wall each is on
  onFixed?: (fixed: Map<string, number | undefined>) => void;
  apiRef: RefObject<SceneApi | null>;
}

interface Obj {
  key: string;
  root: THREE.Object3D;
  sig: string;
  built: boolean;
  // where it's heading; the frame loop eases toward it
  x: number;
  y: number;
  elev: number;
  rot: number;
  wall?: number;
  lift: number;
  // a soft grounding shadow under floor pieces
  blob?: THREE.Mesh;
  // shaders still compiling: it appears when they're ready, so adding a piece never stalls the frame
  pending?: boolean;
}

const GHOST_LIFT = 0.12;
const DRAG_LIFT = 0.07;
const HOVER_LIFT = 0.025;
const sigOf = (p: Piece) => (p.product ? `p:${p.product}` : p.item ? `glb:${p.item}` : `b:${p.brought}`);

export default function PlayScene({ url, footprint, pieces, shapes, selected, view, onSelect, onMove, onRefuse, keepClear, hdri, wallTint, onFixed, apiRef }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const [loaded, setLoaded] = useState<{ url: string; ok: boolean } | null>(null);
  const latest = useRef({ footprint, pieces, shapes, selected, view, onSelect, onMove, onRefuse, keepClear, onFixed, wallTint });
  const syncRef = useRef<(() => void) | null>(null);
  const viewRef = useRef<((v: View, instant?: boolean) => void) | null>(null);
  const tintRef = useRef<((hex?: string) => void) | null>(null);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      // transparent, so the backdrop is the page's own gradient behind it (tone mapping would grey a 3D one)
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // no WebGL (or the browser blocked it): say so instead of crashing the page
      Promise.resolve().then(() => setLoaded({ url, ok: false }));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // the backdrop: the page's surface, warmed toward the room's own walls, lighter overhead
    const css = getComputedStyle(el);
    const surface = css.getPropertyValue("--surface-2").trim() || "#f1f1ec";
    const page = css.getPropertyValue("--bg").trim() || "#fafaf7";
    renderer.setClearColor(0x000000, 0);
    function paintBackdrop(tint?: string) {
      const mix = (a: string, b: string, t: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
      const top = tint ? mix(page, tint, 0.3) : page;
      const bottom = tint ? mix(surface, tint, 0.4) : surface;
      el.style.background = `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
    }
    paintBackdrop();
    const wallMats = new Set<THREE.MeshStandardMaterial>();
    function tint(hex?: string) {
      paintBackdrop(hex);
      if (!hex) return;
      // paint the walls their measured color (the texture keeps its grain; color multiplies it)
      for (const m of wallMats) m.color.set(hex);
    }
    tintRef.current = tint;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    // the room's own daylight once it arrives: warmer and more like the Blender renders than the studio fallback
    if (hdri) {
      new HDRLoader().load(hdri, (tex) => {
        if (disposed) return tex.dispose();
        tex.mapping = THREE.EquirectangularReflectionMapping;
        const env = pmrem.fromEquirectangular(tex).texture;
        tex.dispose();
        scene.environment?.dispose();
        scene.environment = env;
        // daylight from the room's own sky, but kept low: a blue sky fill turns white walls grey-blue
        scene.environmentIntensity = 0.38;
      }, undefined, () => {});
    }
    scene.add(new THREE.HemisphereLight(0xfff3e2, 0x8a7a66, 0.75));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.49;

    // a soft white outline on the selected piece, over the frame's own tone mapping
    const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
    outline.edgeStrength = 3;
    outline.edgeGlow = 0.5;
    outline.edgeThickness = 1.4;
    outline.visibleEdgeColor.set("#ffffff");
    outline.hiddenEdgeColor.set("#1d1d1f");
    composer.addPass(outline);
    composer.addPass(new OutputPass());

    const ringMat = new THREE.MeshBasicMaterial({ color: "#1d1d1f", transparent: true, opacity: 0.85, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.BufferGeometry(), ringMat);
    ring.rotation.order = "YXZ";
    ring.renderOrder = 2;
    ring.visible = false;
    scene.add(ring);
    let ringFor = "";

    const walls: { obj: THREE.Object3D; outward: THREE.Vector3; i: number }[] = [];
    const hiddenWalls = new Set<number>();
    const glbItems = new Map<string, THREE.Object3D>();
    const builtIn = new Map<string, number | undefined>();
    const objs = new Map<string, Obj>();
    let ghost: Piece | null = null;
    let ghostShape: Shape | undefined;
    let ghostHidden = false;
    let ready = false;
    let disposed = false;
    let firstSync = true;
    let hovered: string | null = null;
    let drag: null | { key: string; plane: THREE.Plane; off: THREE.Vector2; moved: boolean; last: Settled | null } = null;
    let overlapNow = false;
    const planWalls = () => wallsOf(latest.current.footprint);

    // camera presets, set once the room's size is known
    // a tall phone screen needs the camera further back to fit the room across
    const fitFor = (aspect: number) => Math.max(1, Math.pow(1.3 / aspect, 0.85));
    let fitNow = 1;
    const presets = { "3d": { pos: new THREE.Vector3(), tgt: new THREE.Vector3() }, top: { pos: new THREE.Vector3(), tgt: new THREE.Vector3() } };
    let tween: null | { from: THREE.Vector3; fromT: THREE.Vector3; to: THREE.Vector3; toT: THREE.Vector3; t0: number } = null;
    const roomSize = new THREE.Vector2(1, 1);
    const roomCenter = new THREE.Vector3();
    // From above fills the frame: the room's long side runs along the screen's long side, with a small margin
    function topView() {
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const portrait = camera.aspect < 1;
      const alongZ = roomSize.y >= roomSize.x;
      // screen-up along the room's z when that keeps long with long, else along x
      const upZ = alongZ === portrait;
      const vert = upZ ? roomSize.y : roomSize.x;
      const horiz = upZ ? roomSize.x : roomSize.y;
      const d = Math.max(vert / (2 * tan), horiz / (2 * tan * camera.aspect)) * 1.12;
      const tgt = new THREE.Vector3(roomCenter.x, 0, roomCenter.z);
      return { tgt, pos: tgt.clone().add(upZ ? new THREE.Vector3(0, d, 0.01) : new THREE.Vector3(0.01, d, 0)) };
    }
    function setView(v: View, instant = false) {
      const b = presets[v];
      const p = v === "top" ? topView() : { tgt: b.tgt, pos: b.pos.clone().sub(b.tgt).multiplyScalar(fitNow).add(b.tgt) };
      // before the room loads there's nowhere to aim yet; the load sets the view itself
      if (!ready && !instant) return;
      if (instant) {
        tween = null;
        camera.position.copy(p.pos);
        controls.target.copy(p.tgt);
        controls.update();
        return;
      }
      tween = { from: camera.position.clone(), fromT: controls.target.clone(), to: p.pos.clone(), toT: p.tgt.clone(), t0: performance.now() };
    }
    viewRef.current = setView;

    function disposeTree(o: THREE.Object3D) {
      o.traverse((m) => {
        if (m instanceof THREE.Mesh || m instanceof THREE.LineSegments || m instanceof THREE.Sprite) {
          m.geometry.dispose();
          for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
            (mat as THREE.MeshStandardMaterial).map?.dispose();
            mat.dispose();
          }
        }
      });
    }

    function makeRoot(p: Piece, shape: Shape): { root: THREE.Object3D; built: boolean } | null {
      if (shape.product) return { root: buildProduct(shape.product), built: true };
      if (p.item) {
        const node = glbItems.get(p.item);
        return node ? { root: node, built: false } : null;
      }
      return { root: buildPlaceholder(shape.name, shape.w, shape.d, shape.h), built: true };
    }

    // Bring the scene in line with the layout: build, swap or retire models, then aim each at its spot
    function sync() {
      if (!ready) return;
      const { pieces: ps, shapes: sh } = latest.current;
      const want = ps.filter((p) => p.placed);
      if (ghost && !want.some((p) => p.key === ghost!.key)) want.push(ghost);
      const keep = new Set<string>();
      for (const p of want) {
        const shape = sh[p.key] ?? (ghost?.key === p.key ? ghostShape : undefined);
        if (!shape) continue;
        const sig = sigOf(p);
        let o = objs.get(p.key);
        if (o && o.sig !== sig) {
          retire(o);
          o = undefined;
        }
        const isGhost = ghost?.key === p.key;
        if (!o) {
          const made = makeRoot(p, shape);
          if (!made) continue;
          // fixed architecture is part of the shell: it can't be picked
          if (shape.fixed) delete made.root.userData.playKey;
          else made.root.userData.playKey = p.key;
          let blob: THREE.Mesh | undefined;
          if (shape.mount === "floor" && !shape.flat && !shape.fixed) {
            blob = contactShadow(shape.w, shape.d);
            scene.add(blob);
          }
          let pending = false;
          if (made.built) {
            scene.add(made.root);
            if (!firstSync && renderer.compileAsync) {
              pending = true;
              renderer.compileAsync(made.root, camera, scene).catch(() => {}).finally(() => {
                const mine = objs.get(p.key);
                if (mine && mine.root === made.root) mine.pending = false;
              });
            }
          }
          made.root.visible = true;
          const lift = firstSync ? 0 : isGhost ? GHOST_LIFT : 0.45;
          o = { key: p.key, root: made.root, sig, built: made.built, x: p.x, y: p.y, elev: p.elev, rot: p.rot, wall: p.wall, lift, blob, pending };
          // a new piece starts above its spot and settles down into it
          made.root.position.set(p.x, p.elev + lift, -p.y);
          made.root.rotation.set(0, (p.rot * Math.PI) / 180, 0);
          objs.set(p.key, o);
        }
        keep.add(p.key);
        // a piece the room model marks as built in after load becomes part of the shell
        if (shape.fixed) {
          delete o.root.userData.playKey;
          if (o.blob) {
            scene.remove(o.blob);
            o.blob = undefined;
          }
        }
        if (drag?.key === p.key) continue;
        if (isGhost) continue; // ghostAt aims it
        Object.assign(o, { x: p.x, y: p.y, elev: p.elev, rot: p.rot, wall: p.wall });
      }
      for (const o of [...objs.values()]) if (!keep.has(o.key)) retire(o);
      // scanned pieces that are removed, waiting in the tray, or swapped out stay hidden
      const shown = new Set([...objs.values()].filter((o) => !o.built).map((o) => o.root));
      for (const node of glbItems.values()) if (!shown.has(node)) node.visible = false;
      firstSync = false;
      updateOverlap();
    }
    syncRef.current = sync;

    function retire(o: Obj) {
      objs.delete(o.key);
      if (o.blob) {
        scene.remove(o.blob);
        o.blob.geometry.dispose();
        (o.blob.material as THREE.Material).dispose();
      }
      if (o.built) {
        scene.remove(o.root);
        disposeTree(o.root);
      } else {
        o.root.visible = false;
      }
    }

    // Would this floor piece, standing where its object is heading, sit on something?
    function blockedAt(key: string, s: Shape | undefined) {
      const me = objs.get(key);
      if (!me || !s || s.flat || s.mount === "wall" || s.fixed) return false;
      const sh = latest.current.shapes;
      const others: Rect[] = [...latest.current.keepClear];
      for (const o of objs.values()) {
        const os = sh[o.key];
        if (o === me || !os || os.flat || o.key === ghost?.key) continue;
        if (os.fixed ? o.elev < 0.9 : os.mount === "floor") others.push({ x: o.x, y: o.y, rot: o.rot, w: os.w, d: Math.max(os.d, 0.05) });
      }
      return clashes({ x: me.x, y: me.y, rot: me.rot, w: s.w, d: s.d }, others);
    }
    // the piece the ring follows: the one in hand, else the one dropping in, else the selection
    const ringKey = () => drag?.key ?? (ghost && !ghostHidden ? ghost.key : null) ?? latest.current.selected;
    function updateOverlap() {
      const key = ringKey();
      overlapNow = key ? blockedAt(key, latest.current.shapes[key] ?? (key === ghost?.key ? ghostShape : undefined)) : false;
    }

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
          const [ox, oy] = ud.outward as number[];
          walls.push({ obj: o, outward: new THREE.Vector3(ox, 0, -oy), i: ud.homebody_wall });
          // the wall surface itself, not its baseboard or door and window frames
          o.traverse((m) => {
            if (!(m instanceof THREE.Mesh) || /baseboard|openings/i.test(m.name) || /baseboard|openings/i.test(m.parent?.name ?? "")) return;
            if (m.parent !== o && m !== o) return;
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            const own = mats.map((mat) => {
              const c = (mat as THREE.MeshStandardMaterial).clone();
              wallMats.add(c);
              return c;
            });
            m.material = Array.isArray(m.material) ? own : own[0];
          });
        }
        if (ud.homebody_ceiling) o.visible = false;
        if (typeof ud.homebody_item === "string") {
          glbItems.set(ud.homebody_item, o);
          if (ud.homebody_fixed) builtIn.set(ud.homebody_item, typeof ud.homebody_on_wall === "number" ? ud.homebody_on_wall : undefined);
        }
      });
      if (builtIn.size) latest.current.onFixed?.(builtIn);
      scene.add(root);

      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.z);
      presets["3d"].tgt.set(center.x, size.y * 0.2, center.z);
      presets["3d"].pos.set(center.x + span * 0.85, span * 1.1, center.z + span * 1.05);
      presets.top.tgt.set(center.x, 0, center.z);
      presets.top.pos.set(center.x, span * 2.3, center.z + 0.01);
      sun.position.set(center.x - span, span * 2, center.z + span * 0.6);
      sun.target.position.copy(center);
      const cam = sun.shadow.camera as THREE.OrthographicCamera;
      cam.left = cam.bottom = -span;
      cam.right = cam.top = span;
      cam.updateProjectionMatrix();
      roomSize.set(size.x, size.z);
      roomCenter.copy(center);
      tint(latest.current.wallTint);
      setView(latest.current.view, true);
      ready = true;
      sync();
      setLoaded({ url, ok: true });
    }, undefined, () => {
      if (!disposed) setLoaded({ url, ok: false });
    });

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      // keep the room framed as the panel opens and closes: a narrower view pulls the camera back
      const next = fitFor(camera.aspect);
      if (ready && !tween) {
        if (latest.current.view === "top") setView("top", true);
        else camera.position.sub(controls.target).multiplyScalar(next / fitNow).add(controls.target);
      }
      fitNow = next;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // ---- picking and dragging ----
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const aim = (cx: number, cy: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return r;
    };
    function pick(cx: number, cy: number): { key: string; point: THREE.Vector3 } | null {
      aim(cx, cy);
      for (const hit of ray.intersectObjects(scene.children, true)) {
        if (!isShown(hit.object) || hit.object === ring) continue;
        let o: THREE.Object3D | null = hit.object;
        while (o && typeof o.userData.playKey !== "string") o = o.parent;
        if (o && o.userData.playKey !== ghost?.key && !latest.current.shapes[o.userData.playKey as string]?.fixed) return { key: o.userData.playKey as string, point: hit.point };
        // the room shell (a wall or the floor) is in front: nothing picked
        if (!o) return null;
      }
      return null;
    }
    const onPlane = (plane: THREE.Plane, cx: number, cy: number) => {
      aim(cx, cy);
      return ray.ray.intersectPlane(plane, new THREE.Vector3());
    };
    const allowWall = (key: string) => (i: number) => !hiddenWalls.has(i) || objs.get(key)?.wall === i;

    function beginDrag(key: string, plane: THREE.Plane, grab: THREE.Vector3) {
      const o = objs.get(key)!;
      drag = { key, plane, off: new THREE.Vector2(o.root.position.x - grab.x, o.root.position.z - grab.z), moved: false, last: null };
      controls.enabled = false;
    }
    function dragTo(cx: number, cy: number) {
      if (!drag) return;
      const p = onPlane(drag.plane, cx, cy);
      const o = objs.get(drag.key);
      const shape = latest.current.shapes[drag.key];
      if (!p || !o || !shape) return;
      const s = settle(shape, p.x + drag.off.x, -(p.z + drag.off.y), o.rot, latest.current.footprint, planWalls(), allowWall(drag.key));
      drag.moved = true;
      drag.last = s;
      Object.assign(o, { x: s.x, y: s.y, rot: s.rot, wall: s.wall ?? o.wall });
      updateOverlap();
    }
    function endDrag() {
      if (!drag) return;
      const d = drag;
      drag = null;
      controls.enabled = true;
      el.style.cursor = "";
      if (d.moved && d.last) {
        if (blockedAt(d.key, latest.current.shapes[d.key])) {
          // it doesn't drop onto another piece: it glides back to where it was
          latest.current.onRefuse("That spot's taken");
          sync();
        } else {
          latest.current.onMove(d.key, d.last);
        }
      }
      updateOverlap();
    }

    let down: { x: number; y: number; id: number; key: string | null; armed: boolean; point?: THREE.Vector3 } | null = null;
    // capture phase on the host, so a grab on a piece never reaches OrbitControls
    const onDown = (e: PointerEvent) => {
      if (e.target !== renderer.domElement || e.button > 0) return;
      const hit = pick(e.clientX, e.clientY);
      const sel = latest.current.selected;
      // a mouse can grab anything; a finger grabs only what's already selected, so it can still turn the room
      const armed = !!hit && (hit.key === sel || e.pointerType === "mouse");
      down = { x: e.clientX, y: e.clientY, id: e.pointerId, key: hit?.key ?? null, armed, point: hit?.point };
      if (armed) {
        e.stopPropagation();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
      }
    };
    const onMovePtr = (e: PointerEvent) => {
      if (drag) {
        dragTo(e.clientX, e.clientY);
        return;
      }
      if (down?.armed && down.key && down.point && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) {
        if (latest.current.selected !== down.key) latest.current.onSelect(down.key);
        beginDrag(down.key, new THREE.Plane(new THREE.Vector3(0, 1, 0), -down.point.y), down.point);
        el.style.cursor = "grabbing";
        dragTo(e.clientX, e.clientY);
        return;
      }
      if (e.pointerType === "mouse" && !down && e.target === renderer.domElement) {
        const h = pick(e.clientX, e.clientY)?.key ?? null;
        if (h !== hovered) {
          hovered = h;
          el.style.cursor = h ? "grab" : "";
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      if (drag) {
        endDrag();
        down = null;
        return;
      }
      if (!down || e.pointerId !== down.id) return;
      const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6;
      if (tap && e.target === renderer.domElement || (tap && down.armed)) latest.current.onSelect(down.key);
      down = null;
    };
    const onLeave = () => {
      hovered = null;
    };
    el.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMovePtr);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerleave", onLeave);

    // the drag handle under the selected piece (the way to move things with a finger)
    const onHandle = (e: PointerEvent) => {
      const key = latest.current.selected;
      const o = key ? objs.get(key) : undefined;
      if (!key || !o) return;
      e.preventDefault();
      e.stopPropagation();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(o.elev));
      const p = onPlane(plane, e.clientX, e.clientY);
      if (!p) return;
      beginDrag(key, plane, p);
      down = { x: e.clientX, y: e.clientY, id: e.pointerId, key, armed: true };
    };
    const hEl = handle.current!;
    hEl.addEventListener("pointerdown", onHandle);

    // ---- the frame loop: easing, cutaway, outline, ring and handle ----
    const view = new THREE.Vector3();
    const proj = new THREE.Vector3();
    let last = performance.now();
    renderer.setAnimationLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (tween) {
        const t = Math.min(1, (now - tween.t0) / 700);
        const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        camera.position.lerpVectors(tween.from, tween.to, k);
        controls.target.lerpVectors(tween.fromT, tween.toT, k);
        if (t >= 1) tween = null;
      }
      controls.update();

      // walls facing the camera hide; from straight above, every wall shows
      view.subVectors(camera.position, controls.target).setY(0);
      const flat = view.length() < 0.25;
      view.normalize();
      for (const w of walls) {
        w.obj.visible = flat || w.outward.dot(view) < 0.2;
        if (w.obj.visible) hiddenWalls.delete(w.i);
        else hiddenWalls.add(w.i);
      }

      const sel = latest.current.selected;
      const ease = 1 - Math.exp(-dt * 14);
      const fall = 1 - Math.exp(-dt * 9);
      for (const o of objs.values()) {
        const lifted = drag?.key === o.key ? DRAG_LIFT : ghost?.key === o.key ? GHOST_LIFT : hovered === o.key ? HOVER_LIFT : 0;
        o.lift += (lifted - o.lift) * (lifted > o.lift ? ease : fall);
        const r = o.root;
        r.position.x += (o.x - r.position.x) * ease;
        r.position.z += (-o.y - r.position.z) * ease;
        r.position.y = o.elev + o.lift;
        const want = (o.rot * Math.PI) / 180;
        let dr = want - r.rotation.y;
        dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        r.rotation.set(0, r.rotation.y + dr * ease, 0);
        r.visible = !o.pending && (ghost?.key === o.key ? !ghostHidden : o.wall === undefined || !hiddenWalls.has(o.wall) || drag?.key === o.key);
        if (o.blob) {
          // the shadow stays on the floor and softens as the piece lifts
          o.blob.position.set(r.position.x, 0.004, r.position.z);
          o.blob.rotation.set(-Math.PI / 2, 0, r.rotation.y, "YXZ");
          o.blob.visible = r.visible;
          (o.blob.material as THREE.MeshBasicMaterial).opacity = 0.42 * Math.max(0.25, 1 - o.lift * 5);
          o.blob.scale.setScalar(1 + o.lift * 1.5);
        }
      }

      const so = sel ? objs.get(sel) : undefined;
      const shape = sel ? latest.current.shapes[sel] : undefined;
      outline.selectedObjects = so && so.root.visible ? [so.root] : [];
      const rk = ringKey();
      const ro_ = rk ? objs.get(rk) : undefined;
      const rs = rk ? latest.current.shapes[rk] ?? (rk === ghost?.key ? ghostShape : undefined) : undefined;
      if (ro_ && rs && rs.mount === "floor" && ro_.root.visible) {
        if (ringFor !== `${rk}:${rs.w}:${rs.d}`) {
          ring.geometry.dispose();
          ring.geometry = ringGeometry(rs.w, rs.d);
          ringFor = `${rk}:${rs.w}:${rs.d}`;
        }
        ring.visible = true;
        // above any rug, so it reads on top of it
        ring.position.set(ro_.root.position.x, (rs.flat ? rs.h : 0) + 0.02, ro_.root.position.z);
        ring.rotation.set(-Math.PI / 2, ro_.root.rotation.y, 0);
        ring.rotation.order = "YXZ";
        ringMat.color.set(overlapNow ? "#c05a4c" : "#1d1d1f");
      } else {
        ring.visible = false;
      }

      // the handle sits just below the piece's footprint on screen
      if (so && shape && so.root.visible && !drag) {
        proj.set(so.root.position.x, so.root.position.y, so.root.position.z).project(camera);
        const x = ((proj.x + 1) / 2) * el.clientWidth;
        const y = ((1 - proj.y) / 2) * el.clientHeight;
        // clear of the toolbar along the bottom
        hEl.style.transform = `translate(${Math.max(4, Math.min(el.clientWidth - 48, x - 22))}px, ${Math.max(56, Math.min(el.clientHeight - 172, y + 10))}px)`;
        hEl.style.opacity = proj.z < 1 ? "1" : "0";
        hEl.style.pointerEvents = proj.z < 1 ? "auto" : "none";
      } else {
        hEl.style.opacity = "0";
        hEl.style.pointerEvents = "none";
      }
      composer.render();
    });

    apiRef.current = {
      ghostAt(piece, shape, cx, cy) {
        const r = renderer.domElement.getBoundingClientRect();
        const over = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
        const p = over ? onPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), cx, cy) : null;
        ghostHidden = !p;
        if (!p) return null;
        const s = settle(shape, p.x, -p.z, piece.rot, latest.current.footprint, planWalls(), (i) => !hiddenWalls.has(i));
        const elev = shape.mount === "wall" ? piece.elev || Math.max(0.9, 1.5 - shape.h / 2) : 0;
        ghost = { ...piece, x: s.x, y: s.y, rot: s.rot, elev, wall: s.wall, placed: true };
        ghostShape = shape;
        if (!objs.has(ghost.key)) sync();
        const o = objs.get(ghost.key);
        if (o) Object.assign(o, { x: s.x, y: s.y, rot: s.rot, elev, wall: s.wall });
        const blocked = blockedAt(ghost.key, shape);
        overlapNow = blocked;
        return { ...s, elev, blocked };
      },
      clearGhost(landed) {
        ghost = null;
        ghostShape = undefined;
        ghostHidden = false;
        // a piece that landed stays; the layout catches up on the next render
        if (!landed) sync();
      },
      screenAxes() {
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        // plan +y is three -z; snap to the room's nearest axis
        const ux = up.x, uy = -up.z;
        const a = Math.abs(ux) > Math.abs(uy) ? { x: Math.sign(ux), y: 0 } : { x: 0, y: Math.sign(uy) || 1 };
        return { up: a, right: { x: a.y, y: -a.x } };
      },
      wallShown: (i) => !hiddenWalls.has(i),
      frame(key) {
        const o = key ? objs.get(key) : undefined;
        const s = key ? latest.current.shapes[key] : undefined;
        if (!o || !s) return setView(latest.current.view);
        // close in on the piece from the current direction, so it fills the middle of the view
        const tgt = new THREE.Vector3(o.x, o.elev + s.h / 2, -o.y);
        const dir = camera.position.clone().sub(controls.target).normalize();
        const dist = Math.max(1.8, Math.max(s.w, s.d, s.h) * 2.4) * fitNow;
        tween = { from: camera.position.clone(), fromT: controls.target.clone(), to: tgt.clone().addScaledVector(dir, dist), toT: tgt, t0: performance.now() };
      },
    };

    return () => {
      disposed = true;
      apiRef.current = null;
      syncRef.current = null;
      viewRef.current = null;
      ro.disconnect();
      renderer.setAnimationLoop(null);
      el.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMovePtr);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onLeave);
      hEl.removeEventListener("pointerdown", onHandle);
      for (const o of [...objs.values()]) retire(o);
      controls.dispose();
      composer.dispose();
      for (const m of wallMats) m.dispose();
      target.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [url, hdri, apiRef]);

  useEffect(() => {
    latest.current = { footprint, pieces, shapes, selected, view, onSelect, onMove, onRefuse, keepClear, onFixed, wallTint };
    syncRef.current?.();
  });

  useEffect(() => {
    viewRef.current?.(view);
  }, [view]);

  useEffect(() => {
    tintRef.current?.(wallTint);
  }, [wallTint]);

  const state = loaded?.url === url ? (loaded.ok ? "ready" : "error") : "loading";
  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={host} className="absolute inset-0 touch-none select-none" />
      <button
        ref={handle}
        aria-label="Drag to move"
        aria-hidden={!selected}
        tabIndex={selected ? 0 : -1}
        title="Drag to move"
        className="absolute left-0 top-0 h-11 w-11 rounded-full bg-surface/95 text-clay shadow-[var(--shadow-2)] border border-clay-soft grid place-items-center opacity-0 touch-none cursor-grab active:cursor-grabbing transition-opacity duration-150"
        style={{ pointerEvents: "none" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
        </svg>
      </button>
      {state !== "ready" && (
        <p className="absolute inset-0 grid place-items-center text-sm text-ink-soft pointer-events-none">
          {state === "loading" ? "Setting out your room…" : "We couldn't show the 3D room. Refresh the page to try again."}
        </p>
      )}
    </div>
  );
}

function isShown(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}
