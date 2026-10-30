"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { RoomScene } from "@/lib/spatial";

const FLOOR_COLOR = 0xe2dccc;
const WALL_COLOR = 0xf2eee3;

function buildObjects(scene: RoomScene, loader: THREE.TextureLoader): THREE.Group {
  const group = new THREE.Group();

  for (const obj of scene.objects) {
    const [w, h, d] = obj.size;
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(obj.color),
      roughness: 0.85,
    });
    const box = new THREE.Mesh(geometry, material);
    box.position.set(obj.position[0], obj.position[1] + h / 2, obj.position[2]);
    box.rotation.y = (obj.rotationY * Math.PI) / 180;
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);

    // A photographed piece gets its actual photo mapped onto a card
    // standing just off its front face — a real reference, not a guess.
    if (obj.photoDataUrl) {
      const texture = loader.load(obj.photoDataUrl);
      texture.colorSpace = THREE.SRGBColorSpace;
      const cardH = Math.min(h, 0.6);
      const cardW = cardH * 1.2;
      const cardGeo = new THREE.PlaneGeometry(cardW, cardH);
      const cardMat = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        roughness: 0.9,
      });
      const card = new THREE.Mesh(cardGeo, cardMat);
      const angle = (obj.rotationY * Math.PI) / 180;
      const offset = d / 2 + 0.03;
      card.position.set(
        obj.position[0] + Math.sin(angle) * offset,
        obj.position[1] + h / 2,
        obj.position[2] + Math.cos(angle) * offset
      );
      card.rotation.y = angle;
      group.add(card);
    }
  }

  return group;
}

export default function Room3D({ scene }: { scene: RoomScene }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const objectGroupRef = useRef<THREE.Group | null>(null);
  const [exporting, setExporting] = useState(false);

  // one-time setup
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const three = new THREE.Scene();
    three.background = new THREE.Color(0xece7dc);
    sceneRef.current = three;

    const width = mount.clientWidth;
    const height = 440;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xfff7ec, 0x554433, 1.1);
    three.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1de, 1.3);
    sun.position.set(4, 6, 3);
    sun.castShadow = true;
    three.add(sun);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.49;

    let raf = 0;
    const animate = () => {
      controls.update();
      renderer.render(three, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener("resize", onResize);

    (mount as HTMLDivElement & { __cleanup?: () => void }).__cleanup = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    (mount as HTMLDivElement & { __camera?: THREE.PerspectiveCamera }).__camera = camera;
    (mount as HTMLDivElement & { __controls?: OrbitControls }).__controls = controls;

    return () => {
      (mount as HTMLDivElement & { __cleanup?: () => void }).__cleanup?.();
    };
  }, []);

  // rebuild geometry whenever the room scene changes
  useEffect(() => {
    const three = sceneRef.current;
    const mount = mountRef.current;
    if (!three || !mount) return;

    if (objectGroupRef.current) {
      three.remove(objectGroupRef.current);
    }
    // clear any previous room shell (everything except lights)
    for (const child of [...three.children]) {
      if (child.userData.isRoomShell) three.remove(child);
    }

    const { width, depth, wallHeight } = scene;
    const loader = new THREE.TextureLoader();

    const floorGeo = new THREE.PlaneGeometry(width, depth);
    const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(width / 2, 0, depth / 2);
    floor.receiveShadow = true;
    floor.userData.isRoomShell = true;
    three.add(floor);

    let backWallMat: THREE.Material;
    if (scene.backWallPhotoDataUrl) {
      const tex = loader.load(scene.backWallPhotoDataUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      backWallMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
    } else {
      backWallMat = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 1 });
    }
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(width, wallHeight), backWallMat);
    backWall.position.set(width / 2, wallHeight / 2, 0);
    backWall.receiveShadow = true;
    backWall.userData.isRoomShell = true;
    three.add(backWall);

    const sideWallMat = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 1 });
    const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, wallHeight), sideWallMat);
    sideWall.rotation.y = Math.PI / 2;
    sideWall.position.set(0, wallHeight / 2, depth / 2);
    sideWall.receiveShadow = true;
    sideWall.userData.isRoomShell = true;
    three.add(sideWall);

    const group = buildObjects(scene, loader);
    objectGroupRef.current = group;
    three.add(group);

    const camera = (mount as HTMLDivElement & { __camera?: THREE.PerspectiveCamera }).__camera;
    const controls = (mount as HTMLDivElement & { __controls?: OrbitControls }).__controls;
    if (camera && controls) {
      const center = new THREE.Vector3(width / 2, wallHeight * 0.32, depth / 2);
      camera.position.set(width * 0.95 + 1.2, wallHeight * 1.7, depth * 1.15 + 1.2);
      controls.target.copy(center);
      controls.update();
    }
  }, [scene]);

  function exportGlb() {
    const three = sceneRef.current;
    if (!three) return;
    setExporting(true);
    const exporter = new GLTFExporter();
    exporter.parse(
      three,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `homebody-${scene.room}.glb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExporting(false);
      },
      (err) => {
        console.error("glTF export failed", err);
        setExporting(false);
      },
      { binary: true }
    );
  }

  return (
    <div className="rounded-md border border-line-strong bg-surface overflow-hidden">
      <div ref={mountRef} className="w-full" style={{ height: 440 }} />
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line">
        <p className="text-xs text-ink-faint max-w-md">
          Proxy geometry sized to your room and item footprints — not a photo
          reconstruction. Drag to orbit.
        </p>
        <button
          onClick={exportGlb}
          disabled={exporting}
          className="mono text-xs px-3 py-2 rounded-full border border-clay text-clay hover:bg-clay-tint transition-colors disabled:opacity-50 flex-none"
        >
          {exporting ? "Exporting…" : "Export for Blender (.glb)"}
        </button>
      </div>
    </div>
  );
}
