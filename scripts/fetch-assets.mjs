// Downloads the CC0 textures and sky that blender/build_room.py uses, from
// Poly Haven (https://polyhaven.com). Run once: `npm run assets`.
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("blender/assets");
const TEXTURES = [
  "oak_wood_planks", "wood_floor_worn", "dark_wooden_planks", "herringbone_parquet",
  "concrete_floor_worn_001", "concrete_floor_painted", "floor_tiles_06", "terrazzo_tiles",
  "dirty_carpet", "painted_plaster_wall", "painted_brick", "brick_wall_001", "painted_concrete",
  "brown_planks_05", "fine_grained_wood", "kitchen_wood", "dark_wood", "rough_linen",
  "velour_velvet", "brown_leather", "marble_01",
  // realism pass, 2026-10-29: real floor, plaster, upholstery and veneer maps
  "laminate_floor_02", "wood_floor", "smooth_concrete_floor", "plastered_wall_04",
  "poly_wool_herringbone", "curly_teddy_natural", "fabric_leather_02", "cotton_jersey",
  "knitted_fleece", "hessian_230", "oak_veneer_01", "white_oak_veneer", "american_walnut_veneer", "interior_tiles",
];
const MAPS = { Diffuse: "diff", Rough: "rough", nor_gl: "nor_gl" };
// Skies for the windows, picked per room to match the photos' light (see blender/photo_look.py)
const HDRIS = [
  "kloofendal_48d_partly_cloudy_puresky", // fallback: bright, partly cloudy
  "residential_garden", // overcast, apartment buildings outside
  "balcony", // partly cloudy daylight, houses and trees
  "suburban_garden", // clear sun
  "belfast_sunset", // golden hour
  "kiara_9_dusk", // dusk, lamps on
  "lakeside", // water and trees, for rooms that look onto a lake or river
];

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function download(url, dest) {
  if (await exists(dest)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function files(id) {
  const res = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!res.ok) throw new Error(`Poly Haven has no asset "${id}" (${res.status})`);
  return res.json();
}

for (const id of TEXTURES) {
  const dir = path.join(ROOT, "textures", id);
  await mkdir(dir, { recursive: true });
  const info = await files(id);
  for (const [key, suffix] of Object.entries(MAPS)) {
    const url = info[key]?.["1k"]?.jpg?.url;
    if (!url) { console.warn(`  ${id}: no ${key} map`); continue; }
    await download(url, path.join(dir, `${id}_${suffix}_1k.jpg`));
  }
  console.log(`texture ${id}`);
}

await mkdir(path.join(ROOT, "hdri"), { recursive: true });
for (const id of HDRIS) {
  const sky = (await files(id)).hdri["2k"].hdr.url;
  await download(sky, path.join(ROOT, "hdri", `${id}_2k.hdr`));
  console.log(`sky ${id}`);
}
