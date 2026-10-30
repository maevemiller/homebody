"""Build a room in Blender from a Homebody room spec (see lib/scan/spec.ts).

Run headless:
  Blender -b --factory-startup -P blender/build_room.py -- SPEC.json OUT_DIR ASSETS_DIR [--quick] [--look LOOK.json]

Writes OUT_DIR/room.glb (for the live viewer), OUT_DIR/render_*.png (Cycles
stills) and OUT_DIR/build.json. Progress lines start with "HB:" so the app
can follow along.

LOOK.json (optional, written by blender/photo_look.py from the owner's photos)
overrides colors measured from the photos and picks the sky and lamps that
match the photos' light. Without it the spec's own colors and lighting text
are used.
"""
import bpy
import bmesh
import json
import math
import os
import random
import re
import sys
import time
from mathutils import Matrix, Vector

import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
SPEC_PATH, OUT, ASSETS = argv[0], argv[1], argv[2]
QUICK = "--quick" in argv
LOOK_PATH = argv[argv.index("--look") + 1] if "--look" in argv else None
spec = json.load(open(SPEC_PATH))
LOOK = json.load(open(LOOK_PATH)) if LOOK_PATH and os.path.exists(LOOK_PATH) else {}
os.makedirs(OUT, exist_ok=True)
T0 = time.time()


def log(stage, msg=""):
    print(f"HB:{stage} {msg}", flush=True)


# Measured colors from the photos win over the colors read by eye
if LOOK:
    if LOOK.get("walls"):
        spec.setdefault("walls", {})["color"] = LOOK["walls"]
    if LOOK.get("floor"):
        spec.setdefault("floor", {})["color"] = LOOK["floor"]
    if LOOK.get("ceiling"):
        spec["ceiling_color"] = LOOK["ceiling"]
    for it in spec.get("items", []):
        if it.get("id") in (LOOK.get("items") or {}):
            it["primary_color"] = LOOK["items"][it["id"]]


# ---------------------------------------------------------------- helpers

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(hex_color, fallback="#b3b3b3"):
    h = (hex_color or fallback).strip().lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    try:
        return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except ValueError:
        return hex_rgb(fallback)


def rgba(hex_color, fallback="#b3b3b3"):
    r, g, b = hex_rgb(hex_color, fallback)
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def pos(v, minimum=0.01):
    try:
        return max(minimum, float(v))
    except (TypeError, ValueError):
        return minimum


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def set_input(node, names, value):
    """Principled BSDF socket names shift between Blender versions; try each."""
    for n in names if isinstance(names, (list, tuple)) else [names]:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
    return False


# ------------------------------------------------------------- materials

# kind -> (Poly Haven texture id, tile size in meters, color mode, extras)
# color mode "grain": keep the photo texture's own variation, shifted to the spec's color (woods, stone)
# color mode "tint": keep only its light and dark, in the spec's color (paint, fabric)
TEX = {
    "floor:wood_light": ("laminate_floor_02", 2.4, "grain", {"coat": 0.18}),
    "floor:wood_mid": ("wood_floor", 2.4, "grain", {"coat": 0.18}),
    "floor:wood_dark": ("dark_wooden_planks", 2.0, "grain", {"coat": 0.18}),
    "floor:parquet": ("herringbone_parquet", 1.5, "grain", {"coat": 0.2}),
    "floor:concrete": ("smooth_concrete_floor", 3.0, "grain", {"coat": 0.1}),
    "floor:painted_concrete": ("concrete_floor_painted", 3.0, "tint", {}),
    "floor:tile": ("interior_tiles", 3.0, "grain", {"coat": 0.35, "rot": 45}),
    "floor:terrazzo": ("terrazzo_tiles", 1.5, "grain", {"coat": 0.3}),
    "floor:carpet": ("knitted_fleece", 0.8, "tint", {"sheen": 0.3, "rough": 0.95}),
    "wall:paint": ("plastered_wall_04", 2.5, "tint", {"nor": 0.25, "rough": 0.88, "contrast": 0.35}),
    "wall:painted_brick": ("painted_brick", 2.0, "tint", {}),
    "wall:brick": ("brick_wall_001", 2.0, "grain", {}),
    "wall:concrete": ("painted_concrete", 3.0, "tint", {"contrast": 0.6}),
    "wall:wood_panel": ("brown_planks_05", 2.0, "grain", {}),
    "item:wood_light": ("oak_veneer_01", 1.0, "grain", {"coat": 0.15}),
    "item:wood_mid": ("white_oak_veneer", 1.0, "grain", {"coat": 0.15}),
    "item:wood_dark": ("american_walnut_veneer", 1.0, "grain", {"coat": 0.2}),
    "item:fabric": ("poly_wool_herringbone", 0.35, "tint", {"sheen": 0.25, "rough": 0.9, "nor": 0.6}),
    "item:boucle": ("curly_teddy_natural", 0.3, "tint", {"sheen": 0.2, "rough": 0.95, "nor": 1.2}),
    "item:velvet": ("velour_velvet", 0.5, "tint", {"sheen": 0.6, "rough": 0.8}),
    "item:leather": ("fabric_leather_02", 0.6, "tint", {"coat": 0.1, "contrast": 0.8}),
    "item:linen": ("rough_linen", 0.4, "tint", {"sheen": 0.15, "rough": 0.9}),
    "item:marble": ("marble_01", 1.0, "grain", {"coat": 0.4}),
    "item:stone": ("smooth_concrete_floor", 1.0, "grain", {}),
    "item:wicker": ("hessian_230", 0.15, "tint", {"nor": 1.4}),
    "rug:fabric": ("knitted_fleece", 0.6, "tint", {"sheen": 0.3, "rough": 0.95, "nor": 0.8}),
    "rug:shag": ("knitted_fleece", 0.25, "tint", {"sheen": 0.45, "rough": 1.0, "nor": 2.2, "contrast": 1.6}),
    "item:walnut": ("american_walnut_veneer", 1.0, "grain", {"coat": 0.25}),
    "item:oak": ("oak_veneer_01", 1.0, "grain", {"coat": 0.2}),
    "floor:marble": ("marble_01", 2.4, "grain", {"coat": 0.7, "contrast": 0.7}),
    "rug:wicker": ("hessian_230", 0.4, "tint", {"nor": 1.0}),
}

# kind -> (roughness, metallic, extra settings) for materials without photos
FLAT = {
    "metal_black": (0.4, 1.0, {"color": "#1b1b1b"}),
    "metal_brass": (0.28, 1.0, {"color": "#c9a45b"}),
    "metal_chrome": (0.1, 1.0, {"color": "#e6e6e6"}),
    "painted": (0.6, 0.0, {}),
    "plastic": (0.4, 0.0, {}),
    "ceramic": (0.25, 0.0, {"coat": 0.6}),
    "glass": (0.02, 0.0, {"transmission": 1.0, "color": "#f2f6f7"}),
    "mirror": (0.02, 1.0, {"color": "#f0f0f0"}),
    "foliage": (0.5, 0.0, {"sheen": 0.15}),
    "screen": (0.32, 0.0, {"color": "#050506", "coat": 0.12}),
    "ember": (0.6, 0.0, {"color": "#1a0c06", "emission": (1.0, 0.42, 0.12), "strength": 1.2}),
    "filament": (0.3, 0.0, {"color": "#ffd9a0", "emission": (1.0, 0.7, 0.4), "strength": 12.0}),
    "sheer": (0.8, 0.0, {"alpha": 0.55}),
    "shade": (0.9, 0.0, {}),
    "rubber": (0.8, 0.0, {"color": "#151515"}),
    "soil": (0.95, 0.0, {"color": "#2b2119"}),
    "paper": (0.7, 0.0, {}),
}

_mats = {}
_recolored = {}
TEX_OUT = os.path.join(OUT, "tex")


def tex_path(tex_id, kind):
    return os.path.join(ASSETS, "textures", tex_id, f"{tex_id}_{kind}_1k.jpg")


def recolored_texture(tex_id, color, mode, contrast=1.0):
    """The texture's diffuse map recolored to the spec's (or the photo's) color, saved as its own image so the
    renders and the glb in the live viewer show the same thing. Recoloring works in linear light:
    "grain" scales each channel so the texture's average lands on the target color; "tint" keeps only the
    texture's brightness pattern around the target color."""
    key = (tex_id, color, mode, contrast)
    if key in _recolored:
        return _recolored[key]
    src = bpy.data.images.load(tex_path(tex_id, "diff"), check_existing=True)
    w, h = src.size
    px = np.empty(w * h * 4, dtype=np.float32)
    src.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    rgb = px[:, :3]
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    target = np.array(rgba(color)[:3], dtype=np.float32)
    # nothing in a real room reflects more than about 90% of the light
    target = np.minimum(target, 0.85)
    if mode == "grain":
        # Brightness pattern from the texture, hue from the target, plus a third of the texture's own color
        # variation (so oak grain stays oak-like). Scaling channels directly can tip a pale oak into pink when the
        # target is a dark walnut.
        luma = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        rel = (luma / max(float(luma.mean()), 1e-4)) ** (0.9 * contrast)
        chroma = lin / np.maximum(luma, 1e-4)[:, None]
        cvar = 1.0 + 0.35 * (chroma / np.maximum(chroma.mean(0), 1e-4) - 1.0)
        out = target[None, :] * rel[:, None] * cvar
    else:
        luma = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        rel = (luma / max(float(luma.mean()), 1e-4)) ** contrast
        out = rel[:, None] * target[None, :]
    out = np.clip(out, 0.0, 0.95)
    enc = np.where(out <= 0.0031308, out * 12.92, 1.055 * np.power(out, 1 / 2.4) - 0.055)
    px[:, :3] = enc
    px[:, 3] = 1.0
    os.makedirs(TEX_OUT, exist_ok=True)
    name = f"{tex_id}_{(color or 'x').lstrip('#')}_{mode}"
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = os.path.join(TEX_OUT, name + ".jpg")
    img.file_format = "JPEG"
    bpy.context.scene.render.image_settings.quality = 90
    img.save()
    _recolored[key] = img
    return img


def new_material(name):
    m = bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):
        m.use_nodes = True
    return m


def material(key, color):
    """key like 'item:fabric', 'floor:wood_mid', 'rug:fabric', or a FLAT kind like 'metal_black'."""
    cache = (key, color)
    if cache in _mats:
        return _mats[cache]
    m = new_material(f"{key}:{color}")
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    kind = key.split(":")[-1]
    tex = TEX.get(key)
    set_input(bsdf, "Base Color", rgba(color))
    set_input(bsdf, "Roughness", 0.6)

    if tex and os.path.exists(tex_path(tex[0], "diff")):
        tex_id, tile, mode, extra = tex
        uv = nt.nodes.new("ShaderNodeUVMap")
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (1 / tile, 1 / tile, 1)
        if extra.get("rot"):  # the source photo is shot on the diagonal
            mapping.inputs["Rotation"].default_value[2] = math.radians(extra["rot"])
        nt.links.new(uv.outputs["UV"], mapping.inputs["Vector"])

        def image(img, non_color):
            node = nt.nodes.new("ShaderNodeTexImage")
            node.image = img
            if non_color:
                node.image.colorspace_settings.name = "Non-Color"
            nt.links.new(mapping.outputs["Vector"], node.inputs["Vector"])
            return node

        diff = image(recolored_texture(tex_id, color, mode, extra.get("contrast", 1.0)), False)
        nt.links.new(diff.outputs["Color"], bsdf.inputs["Base Color"])
        if "rough" in extra:
            set_input(bsdf, "Roughness", extra["rough"])
        elif os.path.exists(tex_path(tex_id, "rough")):
            rough = image(bpy.data.images.load(tex_path(tex_id, "rough"), check_existing=True), True)
            nt.links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
        if os.path.exists(tex_path(tex_id, "nor_gl")):
            nor = image(bpy.data.images.load(tex_path(tex_id, "nor_gl"), check_existing=True), True)
            nmap = nt.nodes.new("ShaderNodeNormalMap")
            nmap.inputs["Strength"].default_value = extra.get("nor", 0.8)
            nt.links.new(nor.outputs["Color"], nmap.inputs["Color"])
            nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
        if extra.get("sheen"):
            set_input(bsdf, ["Sheen Weight", "Sheen"], extra["sheen"])
            set_input(bsdf, "Sheen Roughness", 0.4)
            c = rgba(color)
            set_input(bsdf, "Sheen Tint", (min(1, c[0] * 2 + 0.1), min(1, c[1] * 2 + 0.1), min(1, c[2] * 2 + 0.1), 1))
        if extra.get("coat"):
            set_input(bsdf, ["Coat Weight", "Clearcoat"], extra["coat"])
            set_input(bsdf, "Coat Roughness", 0.12)
    else:
        rough, metal, extra = FLAT.get(kind, (0.5, 0.0, {}))
        if "color" in extra:
            set_input(bsdf, "Base Color", rgba(extra["color"]))
        set_input(bsdf, "Roughness", rough)
        set_input(bsdf, "Metallic", metal)
        if extra.get("transmission"):
            set_input(bsdf, ["Transmission Weight", "Transmission"], extra["transmission"])
            set_input(bsdf, "IOR", 1.45)
        if extra.get("coat"):
            set_input(bsdf, ["Coat Weight", "Clearcoat"], extra["coat"])
        if extra.get("sheen"):
            set_input(bsdf, ["Sheen Weight", "Sheen"], extra["sheen"])
        if extra.get("emission"):
            set_input(bsdf, ["Emission Color", "Emission"], (*extra["emission"], 1))
            set_input(bsdf, "Emission Strength", extra.get("strength", 1.0))
        if extra.get("alpha"):
            set_input(bsdf, "Alpha", extra["alpha"])
            if hasattr(m, "surface_render_method"):
                m.surface_render_method = "BLENDED"
    m["homebody_kind"] = kind
    m["homebody_color"] = color or ""
    _mats[cache] = m
    return m


def render_materials():
    """Swaps in render-only shading after the glb is saved: glass that lets daylight through (so the sky can
    light the room through the window), and lamp shades, leaves and curtains that glow when light is behind them."""
    for m in bpy.data.materials:
        kind = m.get("homebody_kind")
        if not kind or not m.node_tree:
            continue
        bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf:
            continue
        if kind == "glass":
            # a thin pane: mostly see-through, with a faint mirror reflection
            set_input(bsdf, ["Transmission Weight", "Transmission"], 0.0)
            set_input(bsdf, "Metallic", 1.0)
            set_input(bsdf, "Roughness", 0.02)
            set_input(bsdf, "Base Color", (0.9, 0.93, 0.95, 1))
            set_input(bsdf, "Alpha", 0.08)
        elif kind in ("shade", "foliage", "paper"):
            set_input(bsdf, "Thin Wall", True)
            set_input(bsdf, ["Subsurface Weight", "Subsurface"], 0.85 if kind == "shade" else 0.35)
        elif kind == "sheer":
            set_input(bsdf, "Thin Wall", True)
            set_input(bsdf, ["Subsurface Weight", "Subsurface"], 0.6)
            set_input(bsdf, "Alpha", 0.6)
        elif m.name.startswith("drape:"):
            set_input(bsdf, "Thin Wall", True)
            set_input(bsdf, ["Subsurface Weight", "Subsurface"], 0.4)


# ---------------------------------------------------------------- geometry

def add_box(bm, cx, cy, z0, w, d, h, mat_index=0):
    x0, x1, y0, y1, z1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2, z0 + h
    v = [bm.verts.new(c) for c in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                     (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]]
    for idx in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]:
        f = bm.faces.new([v[i] for i in idx])
        f.material_index = mat_index


def add_soft(bm, w, d, h, r, puff=0.0, side_puff=0.0, matrix=None, mat_index=0):
    """A cage for a rounded, slightly overstuffed box, centered on x and y with its bottom at z=0. A Subdivision
    Surface modifier turns it into a cushion: the loops at distance r from each edge set how round the edges are,
    and puff lifts the middle of the top (and side_puff pushes out the middle of the sides)."""
    def axis(half):
        rr = min(r, half * 0.45)
        return [-half, -half + rr, 0.0, half - rr, half]
    X, Y, Z = axis(w / 2), axis(d / 2), axis(h / 2)
    M = matrix or Matrix()
    verts = {}

    def V(i, j, k):
        key = (i, j, k)
        if key in verts:
            return verts[key]
        x, y, z = X[i], Y[j], Z[k]
        fx, fy, fz = 1 - (x / (w / 2)) ** 2, 1 - (y / (d / 2)) ** 2, 1 - (z / (h / 2)) ** 2
        if k == 4:
            z += puff * fx * fy
        if k == 0:
            z -= puff * 0.25 * fx * fy
        if i in (0, 4):
            x += math.copysign(side_puff * fy * fz, x)
        if j in (0, 4):
            y += math.copysign(side_puff * fx * fz, y)
        v = bm.verts.new(M @ Vector((x, y, z + h / 2)))
        verts[key] = v
        return v

    faces = []
    rng = range(4)
    for a in rng:
        for b2 in rng:
            faces.append([V(a, b2, 0), V(a, b2 + 1, 0), V(a + 1, b2 + 1, 0), V(a + 1, b2, 0)])
            faces.append([V(a, b2, 4), V(a + 1, b2, 4), V(a + 1, b2 + 1, 4), V(a, b2 + 1, 4)])
            faces.append([V(a, 0, b2), V(a + 1, 0, b2), V(a + 1, 0, b2 + 1), V(a, 0, b2 + 1)])
            faces.append([V(a, 4, b2), V(a, 4, b2 + 1), V(a + 1, 4, b2 + 1), V(a + 1, 4, b2)])
            faces.append([V(0, a, b2), V(0, a, b2 + 1), V(0, a + 1, b2 + 1), V(0, a + 1, b2)])
            faces.append([V(4, a, b2), V(4, a + 1, b2), V(4, a + 1, b2 + 1), V(4, a, b2 + 1)])
    for vs in faces:
        f = bm.faces.new(vs)
        f.material_index = mat_index
        f.smooth = True


def add_cyl(bm, cx, cy, z0, r, h, r2=None, seg=28, rot=None, mat_index=0, caps=True):
    m = Matrix.Translation((cx, cy, z0 + h / 2))
    if rot is not None:
        m = Matrix.Translation((cx, cy, z0)) @ rot @ Matrix.Translation((0, 0, h / 2))
    ret = bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=seg,
                                radius1=r, radius2=r if r2 is None else r2, depth=h, matrix=m)
    faces = {f for v in ret["verts"] for f in v.link_faces}
    bm.normal_update()
    for f in faces:
        f.material_index = mat_index
        f.smooth = abs(f.normal.z) < 0.7 or rot is not None


def add_sphere(bm, cx, cy, cz, r, scale=(1, 1, 1), mat_index=0):
    m = Matrix.Translation((cx, cy, cz)) @ Matrix.Diagonal((*scale, 1))
    ret = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r, matrix=m)
    for f in {f for v in ret["verts"] for f in v.link_faces}:
        f.material_index = mat_index
        f.smooth = True


def box_uv(bm):
    """Project UVs from each face's dominant axis, in meters, so textures keep real scale."""
    bm.normal_update()
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            co = loop.vert.co
            loop[uv].uv = (co.y, co.z) if ax == 0 else (co.x, co.z) if ax == 1 else (co.x, co.y)


SHELL = bpy.data.collections.new("shell")
ITEMS = bpy.data.collections.new("items")
PTS = [Vector((float(p["x"]), float(p["y"]), 0)) for p in spec["footprint"]]


def make_object(name, bm, mats, parent=None, bevel=0.0, collection=None, subsurf=0, recalc=True):
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    box_uv(bm)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    (collection or ITEMS).objects.link(ob)
    if parent:
        ob.parent = parent
    if bevel > 0:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
        mod.harden_normals = False
        for p in ob.data.polygons:
            p.use_smooth = True
        ob.modifiers.new("smooth", "SMOOTH_BY_ANGLE") if hasattr(bpy.types, "SmoothByAngleModifier") else None
    if subsurf:
        mod = ob.modifiers.new("soft", "SUBSURF")
        mod.levels = subsurf
        mod.render_levels = subsurf
    return ob


def smooth_by_angle(ob, angle=0.6):
    """Smooth shading on curved parts, sharp on the flat ones (the 'Auto Smooth' look)."""
    me = ob.data
    if hasattr(me, "set_sharp_from_angle"):
        me.set_sharp_from_angle(angle=angle)




# ------------------------------------------------------------- ceiling shape

def ceiling_model():
    """The ceiling's shape: spec.ceiling when the read gave one, else what the summary says ("mono-pitch ceiling
    ... rises from about 2.9 m at the window wall to about 3.7 m"), else flat. Returns a dict with the low
    height, the high height, the shape, the low wall's line and inward direction, the run across the room, and
    whether there are rafters or a beam."""
    low = pos(spec.get("ceiling_height", 2.6), 1.8)
    c = spec.get("ceiling") or {}
    text = f"{spec.get('summary') or ''} {spec.get('lighting') or ''}".lower()
    shape = c.get("shape")
    if not shape:
        if any(k in text for k in ("mono-pitch", "monopitch", "mono pitch", "single-pitch", "lean-to", "skillion",
                                   "sloped ceiling", "sloping ceiling", "raked ceiling")):
            shape = "mono_pitch"
        elif any(k in text for k in ("vaulted", "cathedral", "gable", "a-frame", "pitched ceiling")):
            shape = "gable"
        else:
            shape = "flat"
    high = c.get("high_height")
    if not high and shape != "flat":
        nums = [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\s*m\b", text) if 1.8 <= float(x) <= 7]
        high = max(nums) if len(nums) >= 2 else low + 0.9
    high = max(float(high or low), low)
    n = len(PTS)
    # the low wall: the one named, else the one with the biggest window (the read's "window wall"), else wall 0
    lw = c.get("low_wall")
    if not isinstance(lw, int) or not 0 <= lw < n:
        area = {}
        for o in spec.get("openings", []):
            if o.get("type") in ("window", "glass_door"):
                area[int(o.get("wall", 0))] = area.get(int(o.get("wall", 0)), 0) + pos(o.get("width")) * pos(o.get("height"))
        lw = max(area, key=area.get) if ("window wall" in text and area) else 0
    a, b2 = PTS[lw], PTS[(lw + 1) % n]
    u = (b2 - a).normalized()
    inward = Vector((-u.y, u.x, 0))
    run = max(((p - a).dot(inward) for p in PTS), default=1.0) or 1.0
    beam_words = ("beam",)
    return {
        "shape": shape, "low": low, "high": high, "a": a, "u": u, "in": inward, "run": run, "wall": lw,
        "rafters": c.get("rafters") if isinstance(c.get("rafters"), bool) else ("rafter" in text or "joist" in text) and shape != "flat",
        "rafter_color": c.get("rafter_color") or ("#3a2519" if any(k in text for k in ("dark-stained", "dark stained", "dark rafter", "dark beam")) else "#9a7350"),
        "beam": c.get("beam") if isinstance(c.get("beam"), bool) else any(k in text for k in beam_words) and shape != "flat",
        "beam_color": c.get("beam_color") or "#b98348",
        "live_edge_beam": "live-edge" in text or "live edge" in text,
    }


CEIL = ceiling_model()


def CEILING_AT(p):
    """Ceiling height above a floor point."""
    if CEIL["shape"] == "flat":
        return CEIL["low"]
    t = clamp((Vector((p[0], p[1], 0)) - CEIL["a"]).dot(CEIL["in"]) / CEIL["run"], 0.0, 1.0)
    if CEIL["shape"] == "gable":
        t = 1 - abs(2 * t - 1)
    return CEIL["low"] + (CEIL["high"] - CEIL["low"]) * t


H_MAX = CEIL["high"] if CEIL["shape"] != "flat" else CEIL["low"]


class Builder:
    """Collects an item's parts in its own frame: origin at the footprint center on
    the floor, width along +x, front facing +y."""

    def __init__(self, item, empty):
        self.item, self.empty, self.n = item, empty, 0
        words = f"{item.get('name') or ''} {item.get('notes') or ''} {item.get('id') or ''}".lower()

        def key(mat):
            if mat.startswith("wood"):
                if "walnut" in words:
                    return "item:walnut"
                if "oak" in words and mat != "wood_dark":
                    return "item:oak"
            return "item:" + mat
        self.P = material(key(item.get("primary_material", "fabric")), item.get("primary_color"))
        self.S = material(key(item.get("secondary_material", "wood_mid")), item.get("secondary_color"))

    def _name(self, label):
        self.n += 1
        return f"{self.empty.name}.{label}.{self.n}"

    def box(self, label, mat, cx, cy, z0, w, d, h, bevel=0.01):
        bm = bmesh.new()
        add_box(bm, cx, cy, z0, max(w, 0.003), max(d, 0.003), max(h, 0.003))
        b = min(bevel, w / 3, d / 3, h / 3)
        ob = make_object(self._name(label), bm, [mat], self.empty, b)
        smooth_by_angle(ob)
        return ob

    def soft(self, label, mat, cx, cy, z0, w, d, h, r=0.04, puff=0.0, side_puff=0.0, tilt=0.0, pivot_y=None):
        """An upholstered part. tilt leans it back (radians) around its bottom edge at pivot_y."""
        bm = bmesh.new()
        w, d, h = max(w, 0.01), max(d, 0.01), max(h, 0.01)
        py = d / 2 if pivot_y is None else pivot_y
        m = (Matrix.Translation((cx, cy, z0)) @ Matrix.Translation((0, py, 0))
             @ Matrix.Rotation(-tilt, 4, "X") @ Matrix.Translation((0, -py, 0)))
        add_soft(bm, w, d, h, r, puff, side_puff, m)
        return make_object(self._name(label), bm, [mat], self.empty, subsurf=2)

    def cyl(self, label, mat, cx, cy, z0, r, h, r2=None, rot=None, seg=28, caps=True):
        bm = bmesh.new()
        add_cyl(bm, cx, cy, z0, max(r, 0.003), max(h, 0.003), r2, seg, rot, caps=caps)
        return make_object(self._name(label), bm, [mat], self.empty, recalc=caps)

    def raw(self, label, mats, build, bevel=0.0, recalc=True):
        bm = bmesh.new()
        build(bm)
        return make_object(self._name(label), bm, mats, self.empty, bevel, recalc=recalc)

    def light(self, x, y, z, watts=18, radius=0.04):
        """A warm bulb (2700 K). Lamps are lit unless the photos showed them off."""
        data = bpy.data.lights.new(self._name("light"), "POINT")
        data.energy = watts if LAMPS_ON else 0.0
        if hasattr(data, "use_temperature"):
            data.use_temperature = True
            data.temperature = 2700
        else:
            data.color = (1.0, 0.75, 0.5)
        data.shadow_soft_size = radius
        ob = bpy.data.objects.new(data.name, data)
        ITEMS.objects.link(ob)
        ob.parent = self.empty
        ob.location = (x, y, z)


LAMPS_ON = (LOOK.get("light") or {}).get("lamps_on", True)


# ------------------------------------------------------------ furniture

def legs(b, mat, w, d, h, inset=0.06, r=0.02, taper=0.65):
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.cyl("leg", mat, sx * (w / 2 - inset), sy * (d / 2 - inset), 0, r * taper, h, r2=r, seg=16)


def sofa(b, w, d, h, seats=None, ox=0.0, arms=(True, True), corner=()):
    """Upholstered sofa or armchair at real proportions: legs, a deck, rolled arms, a back frame, puffed seat
    cushions and back cushions that lean back. ox shifts it along x and arms picks which ends get an arm, so a
    sectional can be put together from pieces."""
    one = seats == 1
    leg = 0.12 if h >= 0.7 else 0.06
    seat_top = clamp(h * 0.56, 0.38, 0.47)
    cush_t = 0.14 if one else 0.15
    deck = seat_top - cush_t
    arm_w = clamp(w * (0.15 if one else 0.085), 0.1, 0.2)
    back_d = clamp(d * 0.2, 0.13, 0.22)
    arm_top = min(seat_top + 0.2, h - 0.08)
    b.soft("base", b.P, ox, 0.0, leg, w - 0.01, d - 0.02, deck - leg + 0.02, r=0.03)
    b.soft("back", b.P, ox, -d / 2 + back_d / 2, leg, w, back_d, h - leg, r=0.05, puff=0.01)
    for sx, has in zip((-1, 1), arms):
        if has:
            b.soft("arm", b.P, ox + sx * (w / 2 - arm_w / 2), 0.005, leg, arm_w, d - 0.01, arm_top - leg, r=0.05, puff=0.012)
    left, right = (arm_w if arms[0] else 0.0), (arm_w if arms[1] else 0.0)
    for side in corner:  # the corner seat's back, across the full depth at that end
        b.soft("cornerback", b.P, ox + side * (w / 2 - back_d / 2), 0.005, leg, back_d, d - 0.01, h - leg, r=0.05, puff=0.01)
        if side == -1:
            left = back_d
        else:
            right = back_d
    inner = w - left - right
    ox = ox + (left - right) / 2
    n = seats or max(1, round(inner / 0.7))
    cw = inner / n
    seat_d = d - back_d
    back_t = clamp(seat_d * 0.32, 0.12, 0.2)
    for i in range(n):
        x = ox - inner / 2 + cw * (i + 0.5)
        b.soft("cushion", b.P, x, -d / 2 + back_d + seat_d / 2 + 0.01, deck, cw - 0.008, seat_d + 0.01, cush_t,
               r=0.045, puff=0.02, side_puff=0.008)
        bh = max(h - seat_top - 0.01, 0.12)
        b.soft("backcushion", b.P, x, -d / 2 + back_d + back_t / 2 - 0.02, seat_top - 0.01, cw - 0.008, back_t, bh,
               r=0.055, puff=0.015, side_puff=0.02, tilt=math.radians(9), pivot_y=-back_t / 2)
    if ox == 0.0:
        legs(b, b.S, w, d, leg, 0.07, 0.022)
    return leg, seat_top, deck, cush_t, arm_w, arm_top


def sectional(b, w, d, h):
    """An L-shaped sectional: a sofa along the back with a chaise coming forward at one end. The chaise sits on
    the left unless the notes say right. A footprint too shallow for an L (the read gave the back row only)
    still gets the chaise when the notes say it has one, reaching about 1.5 m forward."""
    notes = (b.item.get("notes") or "").lower() + " " + (b.item.get("name") or "").lower()
    hinted = any(k in notes for k in ("l-shape", "l shape", "l-shaped", "chaise", "corner", "sectional with", "the return"))
    if d < 1.3 and not hinted:
        sofa(b, w, d, h)
        return
    side = 1 if "right" in notes and "left" not in notes else -1
    row = min(d, 0.95) if d >= 1.3 else d
    reach = d if d >= 1.3 else 1.5
    cw = clamp(w * 0.32, 0.75, 1.0)
    # the back row runs the full width; the chaise replaces its seat at one end and comes forward
    shift = (d - row) / 2 if d >= 1.3 else 0.0  # keep the back row against the back of the footprint
    main_w = w - cw
    mx = -side * cw / 2
    arms = (False, True) if side == -1 else (True, False)
    # build the back row in a frame shifted so its back sits at -d/2
    leg, seat_top, deck, cush_t, arm_w, arm_top = _sofa_row(b, main_w, row, h, mx, arms, -shift)
    cx = side * (w / 2 - cw / 2)
    depth = reach
    back_d = clamp(row * 0.2, 0.13, 0.22)
    y_back = (-d / 2) if d >= 1.3 else (-row / 2)
    yc = y_back + depth / 2
    b.soft("chaise_base", b.P, cx, yc, leg, cw - 0.01, depth - 0.02, deck - leg + 0.02, r=0.03)
    b.soft("chaise_back", b.P, cx, y_back + back_d / 2, leg, cw, back_d, h - leg, r=0.05, puff=0.01)
    b.soft("chaise_arm", b.P, cx + side * (cw / 2 - arm_w / 2), yc, leg, arm_w, depth - 0.01, arm_top - leg, r=0.05, puff=0.012)
    seat_w = cw - arm_w
    sx = cx - side * arm_w / 2
    b.soft("chaise_cushion", b.P, sx, y_back + back_d + (depth - back_d) / 2 + 0.01, deck, seat_w - 0.008, depth - back_d + 0.01, cush_t,
           r=0.045, puff=0.02, side_puff=0.008)
    back_t = clamp((row - back_d) * 0.32, 0.12, 0.2)
    b.soft("chaise_backcushion", b.P, sx, y_back + back_d + back_t / 2 - 0.02, seat_top - 0.01, seat_w - 0.008, back_t,
           max(h - seat_top - 0.01, 0.12), r=0.055, puff=0.015, side_puff=0.02, tilt=math.radians(9), pivot_y=-back_t / 2)
    for (lx, ly) in [(-w / 2 + 0.07, y_back + 0.07), (w / 2 - 0.07, y_back + 0.07),
                     (mx + side * -(main_w / 2 - 0.07), y_back + row - 0.07),
                     (cx - side * (cw / 2 - 0.07), y_back + depth - 0.07), (cx + side * (cw / 2 - 0.07), y_back + depth - 0.07)]:
        b.cyl("leg", b.S, lx, ly, 0, 0.022 * 0.65, leg, r2=0.022, seg=16)


def _sofa_row(b, w, d, h, ox, arms, oy):
    """The back row of a sectional, placed with its center at (ox, oy)."""
    before = set(b.empty.children)
    out = sofa(b, w, d, h, None, ox, arms)
    if oy:
        for ob in set(b.empty.children) - before:
            ob.location.y += oy
    return out


def chair(b, w, d, h, back=True):
    seat_h = (min(0.46, h * 0.55) if back else h) - 0.045
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.cyl("leg", b.S, sx * (w / 2 - 0.04), sy * (d / 2 - 0.04), 0, 0.012, seat_h, r2=0.018, seg=16)
    if b.item.get("primary_material") in ("fabric", "boucle", "velvet", "leather"):
        b.soft("seat", b.P, 0, 0, seat_h - 0.01, w, d, 0.06, r=0.02, puff=0.01)
    else:
        b.box("seat", b.P, 0, 0, seat_h, w, d, 0.04, 0.008)
    if back:
        bh = max(h - seat_h - 0.045, 0.1)
        b.box("back", b.P, 0, -d / 2 + 0.03, seat_h + 0.045, w * 0.96, 0.03, bh, 0.01)
        for sx in (-1, 1):
            b.cyl("post", b.S, sx * (w / 2 - 0.04), -d / 2 + 0.04, seat_h, 0.013, bh + 0.04, seg=16)


def notes_say(b, *words):
    text = f"{b.item.get('notes') or ''} {b.item.get('name') or ''}".lower()
    return any(w in text for w in words)


def table(b, w, d, h, top_t=0.035, shelf=False):
    if notes_say(b, "solid block", "block form", "cube", "plinth base", "box form", "drum"):
        b.box("body", b.P, 0, 0, 0, w, d, h, 0.008)
        return
    if notes_say(b, "hairpin"):
        b.box("top", b.P, 0, 0, h - top_t, w, d, top_t, 0.008) if abs(w - d) >= 0.06 else \
            b.cyl("top", b.P, 0, 0, h - top_t, w / 2, top_t, seg=64)
        black = material("metal_black", "#151515")
        for k in range(3 if abs(w - d) < 0.06 else 4):
            a = math.tau * k / (3 if abs(w - d) < 0.06 else 4) + math.pi / 4
            lx, ly = math.cos(a) * w * 0.32, math.sin(a) * d * 0.32
            for off in (-0.02, 0.02):
                b.cyl("hairpin", black, lx + off * math.sin(a), ly - off * math.cos(a), 0, 0.005, h - top_t, seg=8)
        return
    if abs(w - d) < 0.06 and w < 1.3:
        b.cyl("top", b.P, 0, 0, h - top_t, w / 2, top_t, seg=64)
        b.cyl("pedestal", b.S, 0, 0, 0.02, 0.035, h - top_t - 0.02, r2=0.045)
        b.cyl("foot", b.S, 0, 0, 0, w * 0.22, 0.02, seg=48)
        return
    b.box("top", b.P, 0, 0, h - top_t, w, d, top_t, 0.008)
    inset = clamp(min(w, d) * 0.08, 0.04, 0.08)
    if h > 0.6:  # dining tables and desks have an apron under the top
        b.box("apron", b.P, 0, 0, h - top_t - 0.08, w - 2 * inset, d - 2 * inset, 0.08, 0.003)
    legs(b, b.S, w, d, h - top_t, inset, 0.024 if h > 0.6 else 0.02, 0.6)
    if shelf:
        b.box("shelf", b.P, 0, 0, h * 0.2, w - 2 * inset - 0.02, d - 2 * inset, 0.022, 0.004)


def casework(b, w, d, h, rows, leg=0.0, top_mat=None, top_t=0.025):
    body_h = h - leg - top_t
    b.box("body", b.P, 0, 0, leg, w, d, body_h, 0.003)
    tm = top_mat or b.P
    over = 0.02 if top_mat else 0
    b.box("top", tm, 0, over / 2, h - top_t, w + over, d + over, top_t, 0.004)
    cols = max(1, round(w / 0.55))
    cw, rh = w / cols, body_h / rows
    handle = material("metal_brass" if b.item.get("secondary_material") == "metal_brass" else "metal_black", "#222222")
    for c in range(cols):
        for r in range(rows):
            x = -w / 2 + cw * (c + 0.5)
            z = leg + rh * r
            b.box("front", b.P, x, d / 2 + 0.009, z + 0.003, cw - 0.005, 0.018, rh - 0.005, 0.002)
            b.box("pull", handle, x, d / 2 + 0.024, z + rh - 0.05, min(0.14, cw * 0.4), 0.012, 0.012, 0.004)
    if leg:
        legs(b, b.S, w, d, leg, 0.05, 0.02, 0.6)


def shelving(b, w, d, h, books=True):
    t = 0.022
    for sx in (-1, 1):
        b.box("side", b.P, sx * (w / 2 - t / 2), 0, 0, t, d, h, 0.002)
    n = max(2, int(h / 0.36))
    gap = (h - t) / n
    for i in range(n + 1):
        b.box("shelf", b.P, 0, 0, i * gap, w - 2 * t, d, t, 0.002)
    if books and b.item.get("category") == "bookshelf":
        b.box("backpanel", b.P, 0, -d / 2 + 0.005, 0, w, 0.01, h, 0)
    if not books:
        return
    rnd = random.Random(b.item.get("id", "x"))
    palette = ["#7b2f2a", "#1f3b57", "#d8cfbd", "#2f4f3a", "#c4882e", "#3a3a3a", "#8a6d5a", "#a9b8c4", "#e9e4d8", "#5b6b5d"]
    mats = [material("paper", c) for c in palette]

    def fill(bm):
        for i in range(n):
            if rnd.random() < 0.2:
                continue
            x = -w / 2 + t + 0.01
            end = -w / 2 + t + (w - 2 * t) * rnd.uniform(0.45, 0.95)
            while x < end:
                bw = rnd.uniform(0.018, 0.045)
                bh = min(gap - t - 0.02, rnd.uniform(0.17, 0.28))
                bd = min(d - 0.03, rnd.uniform(0.14, 0.22))
                add_box(bm, x + bw / 2, d / 2 - bd / 2 - 0.01, i * gap + t, bw, bd, bh, rnd.randrange(len(mats)))
                x += bw + 0.002
            if rnd.random() < 0.5:  # a few books lying flat
                for k in range(rnd.randint(2, 4)):
                    bh = rnd.uniform(0.025, 0.04)
                    add_box(bm, end + 0.13, d / 2 - 0.12, i * gap + t + k * bh, 0.2, 0.16, bh, rnd.randrange(len(mats)))
    b.raw("books", mats, fill, 0.003)


def bed(b, w, d, h):
    linen = material("item:linen", "#ece8e1")
    frame_h = 0.3
    b.box("frame", b.S, 0, 0, 0.08, w, d, frame_h - 0.08, 0.012)
    legs(b, b.S, w, d, 0.08, 0.08, 0.025)
    b.soft("mattress", linen, 0, 0.03, frame_h - 0.04, w - 0.08, d - 0.12, 0.24, r=0.06, puff=0.01)
    top = frame_h + 0.2
    b.soft("duvet", b.P, 0, d * 0.11, top - 0.16, w + 0.02, (d - 0.12) * 0.74, 0.23, r=0.07, puff=0.03, side_puff=0.01)
    b.soft("fold", b.P, 0, d * 0.11 - (d - 0.12) * 0.37 + 0.12, top + 0.06, w - 0.04, 0.22, 0.03, r=0.015, puff=0.01)
    b.soft("headboard", b.S, 0, -d / 2 + 0.04, frame_h - 0.1, w + 0.04, 0.08, max(h, frame_h + 0.6) - frame_h + 0.1, r=0.03)
    pillows = 2 if w > 1.2 else 1
    for i in range(pillows):
        x = 0 if pillows == 1 else (-1 + 2 * i) * w / 4
        b.soft("pillow", linen, x, -d / 2 + 0.28, top - 0.02, min(0.66, w / pillows - 0.08), 0.42, 0.14, r=0.06, puff=0.04,
               tilt=math.radians(18), pivot_y=-0.21)


def lamp_shade(b, cx, cy, z0, r, h, r2):
    """An open fabric drum with no top or bottom, so light pools on the ceiling and the floor."""
    shade = material("shade", "#f1e6d2")
    b.cyl("shade", shade, cx, cy, z0, r, h, r2=r2, seg=48, caps=False)


def floor_lamp(b, w, d, h):
    r = clamp(min(w, d) / 2, 0.14, 0.24)
    b.cyl("base", b.S, 0, 0, 0, r * 0.75, 0.025, seg=40)
    b.cyl("pole", b.S, 0, 0, 0.025, 0.011, h - 0.3)
    lamp_shade(b, 0, 0, h - 0.34, r, 0.32, r * 0.8)
    b.light(0, 0, h - 0.2, 9)


def table_lamp(b, w, d, h):
    r = max(min(w, d) / 2, 0.09)
    b.raw("base", [b.P], lambda bm: add_sphere(bm, 0, 0, h * 0.27, r * 0.6, (1, 1, h * 0.5 / (r * 1.2))))
    b.cyl("neck", b.S, 0, 0, h * 0.5, 0.008, h * 0.12, seg=12)
    lamp_shade(b, 0, 0, h * 0.58, r, h * 0.42, r * 0.75)
    b.light(0, 0, h * 0.72, 5, 0.03)


def pendant(b, w, d, h):
    r = max(min(w, d) / 2, 0.1)
    elev = b.item.get("elevation", 2.0)
    cord = max(CEILING_AT(b.empty.location) - elev - h, 0.05)
    b.cyl("cord", material("metal_black", "#111111"), 0, 0, h, 0.003, cord, seg=8)
    b.cyl("canopy", material("metal_black", "#111111"), 0, 0, h + cord - 0.03, 0.05, 0.03, seg=24)
    b.cyl("shade", b.P, 0, 0, 0, r, h, r2=r * 0.2, seg=48, caps=False)
    b.light(0, 0, h * 0.35, 12, 0.03)


def plant(b, w, d, h):
    """A potted plant: tapered pot with a rim and soil, stems, and cupped elliptical leaves that turn outward and
    droop, lit through from behind."""
    rnd = random.Random(b.item.get("id", "p"))
    r = max(min(w, d) / 2, 0.1)
    pot_h = clamp(h * 0.22, 0.15, 0.42)
    pot_r = clamp(r * 0.55, 0.08, 0.26)
    b.cyl("pot", b.S, 0, 0, 0, pot_r * 0.8, pot_h, r2=pot_r, seg=36)
    b.cyl("rim", b.S, 0, 0, pot_h - 0.025, pot_r + 0.008, 0.025, seg=36)
    b.cyl("soil", material("soil", "#2b2119"), 0, 0, pot_h - 0.04, pot_r - 0.01, 0.01, seg=36)
    green = material("foliage", b.item.get("primary_color") or "#4c7a4a")
    stem_mat = material("item:wood_dark", "#4a3a28")
    tall = h - pot_h
    stems = max(3, int(r * 18))

    def leaf(bm, base, direction, length, width, droop):
        side = direction.cross(Vector((0, 0, 1)))
        if side.length < 1e-3:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(direction).normalized()
        rows = []
        for i in range(6):
            t = i / 5
            half = width * math.sin(math.pi * min(t * 1.05, 1.0)) * 0.5 + 0.002
            center = base + direction * (length * t) - Vector((0, 0, droop * t * t))
            rows.append([bm.verts.new(center + side * half * s + up * (abs(s) * width * 0.15)) for s in (-1, 0, 1)])
        for i in range(5):
            for j in range(2):
                f = bm.faces.new([rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]])
                f.smooth = True

    def leaves(bm):
        for s in range(stems):
            ang = math.tau * s / stems + rnd.uniform(-0.3, 0.3)
            lean = rnd.uniform(0.08, 0.3)
            top = Vector((math.cos(ang) * r * lean * 2, math.sin(ang) * r * lean * 2, pot_h + tall * rnd.uniform(0.7, 1.0)))
            start = Vector((0, 0, pot_h - 0.03))
            k = rnd.randint(5, 8)
            for j in range(k):
                t = 0.35 + 0.65 * (j + rnd.random() * 0.5) / k
                p = start.lerp(top, min(t, 1.0))
                a2 = ang + rnd.uniform(-1.4, 1.4)
                out = Vector((math.cos(a2), math.sin(a2), rnd.uniform(0.1, 0.6))).normalized()
                size = clamp(h * rnd.uniform(0.11, 0.17), 0.07, 0.32) * (1.15 - t * 0.35)
                leaf(bm, p, out, size, size * 0.6, size * 0.25)

    def stalks(bm):
        rs = random.Random(b.item.get("id", "p"))
        for s in range(stems):
            ang = math.tau * s / stems + rs.uniform(-0.3, 0.3)
            lean = rs.uniform(0.08, 0.3)
            dx, dy = math.cos(ang) * r * lean * 2, math.sin(ang) * r * lean * 2
            hgt = tall * rs.uniform(0.7, 1.0) + 0.03
            rot = Matrix.Rotation(math.atan2(math.hypot(dx, dy), hgt), 4, Vector((-dy, dx, 0)).normalized() if (dx or dy) else "X")
            add_cyl(bm, 0, 0, pot_h - 0.03, 0.007, hgt, r2=0.004, seg=8, rot=rot)
    b.raw("stems", [stem_mat], stalks)
    b.raw("leaves", [green], leaves, recalc=False)


def curtains(b, w, d, h):
    """Curtains drawn open: two gathered panels pulled to the ends of the rod, so the window's glass shows
    between them, hung from a rod with finials and wall brackets that reads as a rod."""
    panel = min(max(w * 0.2, 0.22), w * 0.4)
    rod_y, rod_z, rod_r = 0.06, h + 0.01, 0.014
    reach = w / 2 + 0.08
    drape_mat = material("item:linen", b.item.get("primary_color") or "#efe9df")
    drape_mat.name = "drape:" + drape_mat.name

    def drape(x0, x1):
        def build(bm):
            folds = max(3, int((x1 - x0) / 0.09))
            n = folds * 8
            rows = []
            for zi, z in enumerate((0.015, h * 0.5, h - 0.01)):
                row = []
                for i in range(n + 1):
                    t = i / n
                    x = x0 + (x1 - x0) * t
                    amp = 0.035 if zi else 0.045  # the hem flares a little
                    y = 0.01 + amp * math.sin(t * folds * math.tau)
                    row.append(bm.verts.new((x, y, z)))
                rows.append(row)
            for r0, r1 in ((rows[0], rows[1]), (rows[1], rows[2])):
                for i in range(n):
                    f = bm.faces.new([r0[i], r0[i + 1], r1[i + 1], r1[i]])
                    f.smooth = True
        return build

    b.raw("drape", [drape_mat], drape(-w / 2 - 0.04, -w / 2 + panel), recalc=False)
    b.raw("drape", [drape_mat], drape(w / 2 - panel, w / 2 + 0.04), recalc=False)
    b.cyl("rod", b.S, -reach, rod_y, rod_z, rod_r, reach * 2, rot=Matrix.Rotation(math.pi / 2, 4, "Y"), seg=16)
    for sx in (-1, 1):
        b.raw("finial", [b.S], lambda bm, sx=sx: add_sphere(bm, sx * reach, rod_y, rod_z, rod_r * 2.1))
        # brackets back to the wall, just inside each end
        b.box("bracket", b.S, sx * (w / 2 + 0.02), (rod_y - 0.07) / 2, rod_z - 0.02, 0.02, rod_y + 0.07, 0.03, 0.003)


def artwork(b, w, d, h, mirror=False):
    """A framed print: a thin frame, a white mat and the picture set back behind it."""
    fw = 0.025
    for (cx, cz, bw, bh) in [(0, 0, w, fw), (0, h - fw, w, fw), (-w / 2 + fw / 2, 0, fw, h), (w / 2 - fw / 2, 0, fw, h)]:
        b.box("frame", b.S, cx, 0, cz, bw, 0.03, bh, 0.003)
    if mirror:
        b.box("face", material("mirror", "#ffffff"), 0, -0.002, fw, w - 2 * fw, 0.01, h - 2 * fw, 0)
        return
    b.box("backing", material("paper", "#f3f1ec"), 0, -0.004, fw, w - 2 * fw, 0.01, h - 2 * fw, 0)
    m = min(w, h) * 0.12
    b.box("print", b.P, 0, 0.0, fw + m, w - 2 * fw - 2 * m, 0.006, h - 2 * fw - 2 * m, 0)


def bicycle(b, w, d, h):
    rubber = material("rubber", "#151515")
    wheel_r = min(0.34, h / 2.2)
    upright = Matrix.Rotation(math.pi / 2, 4, "X")
    for sx in (-1, 1):
        b.cyl("wheel", rubber, sx * (w / 2 - wheel_r), 0.015, wheel_r, wheel_r, 0.03, rot=upright, seg=40)
    frame = b.P

    def tube(label, x0, z0, x1, z1, r=0.016):
        length = math.hypot(x1 - x0, z1 - z0)
        ang = math.atan2(x1 - x0, z1 - z0)
        b.cyl(label, frame, x0, 0, z0, r, length, rot=Matrix.Rotation(ang, 4, "Y"), seg=12)
    hub_l, hub_r = -w / 2 + wheel_r, w / 2 - wheel_r
    tube("down", hub_l + 0.45, wheel_r, hub_r - 0.05, h * 0.85)
    tube("top", hub_l + 0.3, h * 0.85, hub_r - 0.1, h * 0.85)
    tube("seat", hub_l + 0.45, wheel_r, hub_l + 0.3, h * 0.9)
    tube("rear", hub_l, wheel_r, hub_l + 0.45, wheel_r)
    tube("fork", hub_r, wheel_r, hub_r - 0.1, h * 0.95)



def add_rod(bm, p0, p1, r, seg=8, mat_index=0):
    """A thin cylinder from p0 to p1 (wire frames, splayed legs)."""
    p0, p1 = Vector(p0), Vector(p1)
    v = p1 - p0
    if v.length < 1e-4:
        return
    rot = Vector((0, 0, 1)).rotation_difference(v.normalized()).to_matrix().to_4x4()
    add_cyl(bm, p0.x, p0.y, p0.z, r, v.length, seg=seg, rot=rot, mat_index=mat_index)


def add_prism(bm, outline, z0, z1, mat_index=0):
    """An upright slab from a floor outline (counterclockwise points)."""
    bot = [bm.verts.new((x, y, z0)) for x, y in outline]
    top = [bm.verts.new((x, y, z1)) for x, y in outline]
    n = len(outline)
    faces = [bm.faces.new(list(reversed(bot))), bm.faces.new(top)]
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new([bot[i], bot[j], top[j], top[i]]))
    for f in faces:
        f.material_index = mat_index


def live_edge(n, half_w, half_d, rnd, amp=0.025, round_ends=False):
    """An outline with a natural, wavy edge front and back (a live-edge slab)."""
    pts = []
    for side in (-1, 1):
        for i in range(n + 1):
            t = i / n if side == -1 else 1 - i / n
            x = -half_w + 2 * half_w * t
            wob = amp * (0.6 * math.sin(t * 7.3 + rnd.random() * 0.4) + 0.4 * math.sin(t * 17.1 + side)) + amp
            edge = half_d - wob
            if round_ends:
                edge *= math.sqrt(max(0.0, 1 - (2 * t - 1) ** 8))
            pts.append((x, side * edge))
    return pts


def cladding(b, w, d, h):
    """Vertical battens or slats on a dark backing, floor to ceiling (or as tall as the read says)."""
    back = material("painted", b.item.get("secondary_color") or "#2a2a2a")
    b.box("backing", back, 0, -d / 2 + 0.006, 0, w, 0.012, h, 0)
    slat_w = 0.045 if w > 0.25 else 0.035
    gap = 0.022
    n = max(2, int(round((w + gap) / (slat_w + gap))))
    pitch = w / n
    depth = max(d - 0.012, 0.02)

    def build(bm):
        for i in range(n):
            add_box(bm, -w / 2 + pitch * (i + 0.5), -d / 2 + 0.012 + depth / 2, 0, pitch - gap, depth, h)
    b.raw("slats", [b.P], build, 0.002)


def fireplace(b, w, d, h):
    """An electric fire insert in a thick timber surround, with a glowing ember bed."""
    t = clamp(min(w, h) * 0.11, 0.06, 0.11)
    for (cx, cz, bw, bh) in [(0, 0, w, t), (0, h - t, w, t), (-w / 2 + t / 2, 0, t, h), (w / 2 - t / 2, 0, t, h)]:
        b.box("surround", b.P, cx, 0, cz, bw, d, bh, 0.008)
    iw, ih = w - 2 * t, h - 2 * t
    b.box("insert", material("screen", "#060606"), 0, -0.03, t, iw, d - 0.06, ih, 0.002)
    b.box("embers", material("ember", "#1a0c06"), 0, d / 2 - 0.07, t + 0.02, iw * 0.82, 0.05, 0.05, 0.01)


def floating_shelf(b, w, d, h):
    """A thick shelf with a live (natural) front edge, held on black brackets."""
    rnd = random.Random(b.item.get("id", "s"))
    outline = live_edge(24, w / 2, d / 2, rnd, amp=0.02) if notes_say(b, "live-edge", "live edge", "raw-edge", "raw edge") else \
        [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    if outline[0][1] > 0:
        outline = list(reversed(outline))
    b.raw("slab", [b.P], lambda bm: add_prism(bm, outline, 0, max(h, 0.035)), 0.004)
    black = material("metal_black", "#151515")
    for sx in (-0.33, 0.33):
        b.box("bracket", black, sx * w, -d / 2 + d * 0.35, -0.005, 0.02, d * 0.7, 0.006, 0)
        b.box("bracket", black, sx * w, -d / 2 + 0.004, -0.12, 0.02, 0.008, 0.12, 0)


def ac_unit(b, w, d, h):
    """A wall-mounted split air-conditioner head."""
    b.soft("body", material("plastic", b.item.get("primary_color") or "#f4f4f4"), 0, 0, 0, w, d, h, r=0.035)
    b.box("vent", material("plastic", "#cfcfcf"), 0, d / 2 - 0.02, 0.02, w * 0.85, 0.03, 0.035, 0.003)


def shell_chair(b, w, d, h):
    """A moulded shell chair (Eames-style): one curved seat-and-back shell on splayed dowel legs with a wire
    cross-brace."""
    seat_h = 0.44
    cols, rows = 9, 12

    def build(bm):
        grid = []
        for j in range(rows + 1):
            v = j / rows
            row = []
            for i in range(cols + 1):
                u = -1 + 2 * i / cols
                if v < 0.5:  # the seat, front to back
                    t = v / 0.5
                    y = d / 2 - 0.04 - t * (d - 0.13)
                    z = seat_h - 0.02 * math.sin(math.pi * t) + 0.05 * u ** 4
                    x = u * w / 2 * (0.92 + 0.06 * t)
                else:  # the back, curving up and wrapping forward at the sides
                    t = (v - 0.5) / 0.5
                    y = -d / 2 + 0.09 - 0.07 * t + 0.07 * u ** 2 * (0.4 + t)
                    z = seat_h + 0.02 + t * (h - seat_h - 0.02)
                    x = u * w / 2 * (0.98 + 0.04 * math.sin(math.pi * t))
                row.append(bm.verts.new((x, y, z)))
            grid.append(row)
        for j in range(rows):
            for i in range(cols):
                f = bm.faces.new([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]])
                f.smooth = True
    ob = b.raw("shell", [b.P], build, recalc=False)
    sol = ob.modifiers.new("thick", "SOLIDIFY")
    sol.thickness = 0.009
    sub = ob.modifiers.new("soft", "SUBSURF")
    sub.levels = sub.render_levels = 1
    wood = b.S
    black = material("metal_black", "#151515")
    top = [(-w * 0.18, 0.06), (w * 0.18, 0.06), (-w * 0.18, -0.08), (w * 0.18, -0.08)]
    foot = [(-w * 0.42, d * 0.42), (w * 0.42, d * 0.42), (-w * 0.42, -d * 0.4), (w * 0.42, -d * 0.4)]

    def legs_build(bm):
        for (tx, ty), (fx, fy) in zip(top, foot):
            add_rod(bm, (fx, fy, 0), (tx, ty, seat_h - 0.03), 0.013, seg=12)
    b.raw("legs", [wood], legs_build)

    def wires(bm):
        add_rod(bm, (foot[0][0] * 0.7, foot[0][1] * 0.7, 0.16), (foot[3][0] * 0.7, foot[3][1] * 0.7, 0.16), 0.003)
        add_rod(bm, (foot[1][0] * 0.7, foot[1][1] * 0.7, 0.16), (foot[2][0] * 0.7, foot[2][1] * 0.7, 0.16), 0.003)
        for (tx, ty) in top:
            add_rod(bm, (tx, ty, seat_h - 0.03), (tx * 0.9, ty * 0.9, seat_h - 0.012), 0.006)
    b.raw("wires", [black], wires)


def hairpin_legs(b, w, d, h, round_top):
    black = material("metal_black", "#151515")
    k = 3 if round_top else 4
    for i in range(k):
        a = math.tau * i / k + (math.pi / 2 if round_top else math.pi / 4)
        lx, ly = math.cos(a) * w * 0.32, math.sin(a) * d * 0.32

        def build(bm, lx=lx, ly=ly, a=a):
            off = 0.022
            ox, oy = -math.sin(a) * off, math.cos(a) * off
            add_rod(bm, (lx + ox, ly + oy, 0.01), (lx * 0.85 + ox, ly * 0.85 + oy, h), 0.005)
            add_rod(bm, (lx - ox, ly - oy, 0.01), (lx * 0.85 - ox, ly * 0.85 - oy, h), 0.005)
            add_rod(bm, (lx + ox, ly + oy, 0.01), (lx - ox, ly - oy, 0.01), 0.005)
        b.raw("hairpin", [black], build)


def tree_slice_table(b, w, d, h):
    """A round tree-slice top with a thin bark ring, on hairpin legs."""
    rnd = random.Random(b.item.get("id", "t"))
    r = min(w, d) / 2
    top_t = 0.05
    n = 48
    radii = [r * (1 + 0.035 * math.sin(i * 0.9 + rnd.random()) + 0.02 * rnd.uniform(-1, 1)) for i in range(n)]
    outer = [(math.cos(math.tau * i / n) * radii[i], math.sin(math.tau * i / n) * radii[i]) for i in range(n)]
    inner = [(x * 0.93, y * 0.93) for x, y in outer]
    bark = material("item:wood_dark", "#3b2a1c")
    b.raw("bark", [bark], lambda bm: add_prism(bm, outer, h - top_t, h - 0.002), 0.003)
    b.raw("top", [b.P], lambda bm: add_prism(bm, inner, h - top_t + 0.002, h), 0.002)
    hairpin_legs(b, w, d, h - top_t, True)


def live_edge_table(b, w, d, h):
    """A thick live-edge slab with a glossy finish on two black steel frames."""
    rnd = random.Random(b.item.get("id", "le"))
    top_t = 0.06
    outline = live_edge(40, w / 2, d / 2, rnd, amp=0.03)
    if outline[0][1] > 0:
        outline = list(reversed(outline))
    b.raw("top", [b.P], lambda bm: add_prism(bm, outline, h - top_t, h), 0.006)
    black = b.S if b.item.get("secondary_material", "").startswith("metal") else material("metal_black", "#151515")
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.16)
        for sy in (-1, 1):
            b.box("post", black, x, sy * (d / 2 - 0.1), 0, 0.04, 0.04, h - top_t, 0.002)
        b.box("rail", black, x, 0, h - top_t - 0.04, 0.04, d - 0.16, 0.04, 0.002)
        b.box("foot", black, x, 0, 0, 0.04, d - 0.16, 0.03, 0.002)


def cage_pendant(b, w, d, h):
    """An open wire pyramid cage around a bare filament bulb."""
    s = max(min(w, d) / 2, 0.12)
    black = material("metal_black", "#111111")
    elev = b.item.get("elevation", 2.0)
    cord = max(CEILING_AT(b.empty.location) - elev - h, 0.05)
    b.cyl("cord", black, 0, 0, h, 0.003, cord, seg=8)
    corners = [(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)]
    apex = (0, 0, h)

    def build(bm):
        for i in range(4):
            add_rod(bm, corners[i], corners[(i + 1) % 4], 0.004)
            add_rod(bm, corners[i], apex, 0.004)
            mid = [c * 0.5 for c in corners[i]]
            mid2 = [c * 0.5 for c in corners[(i + 1) % 4]]
            add_rod(bm, (mid[0], mid[1], h * 0.5), (mid2[0], mid2[1], h * 0.5), 0.003)
    b.raw("cage", [black], build)
    b.raw("bulb", [material("filament", "#ffd9a0")], lambda bm: add_sphere(bm, 0, 0, h * 0.42, 0.045, (1, 1, 1.3)))
    b.light(0, 0, h * 0.42, 14, 0.03)


def sheers(b, w, h):
    """White sheer panels behind the drapes, softly gathered across the window."""
    mat = material("sheer", b.item.get("secondary_color") or "#f6f6f4")

    def build(bm):
        folds = max(4, int(w / 0.07))
        n = folds * 6
        rows = []
        for z in (0.01, h - 0.01):
            row = []
            for i in range(n + 1):
                t = i / n
                row.append(bm.verts.new((-w / 2 + w * t, -0.02 + 0.015 * math.sin(t * folds * math.tau), z)))
            rows.append(row)
        for i in range(n):
            f = bm.faces.new([rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]])
            f.smooth = True
    b.raw("sheer", [mat], build, recalc=False)


FIXED_WORDS = ("cladding", "slat", "batten", "fireplace", "shelf", "built-in", "built in", "accent", "painted section",
               "split-system", "split system", "air-con", "air con", "ac unit", "radiator", "niche", "panel")


def is_fixed(item):
    """Built-in architecture (cladding, fireplaces, floating shelves, accent panels, wall AC, wall-mounted TVs),
    which the editor shouldn't let anyone carry around."""
    if isinstance(item.get("fixed"), bool):
        return item["fixed"]
    c = item.get("category", "other")
    text = f"{item.get('id') or ''} {item.get('name') or ''} {item.get('notes') or ''}".lower()
    if c in ("other", "appliance", "shelving_unit", "cabinet") and any(k in text for k in FIXED_WORDS):
        return True
    return c == "tv" and float(item.get("elevation", 0) or 0) > 0.5


def sectional_joins(item):
    """Which ends of a sofa or sectional meet another piece of the same seating (an L built from two items),
    and which of those ends also reach a wall (that end becomes the corner seat's back)."""
    out = {"join": set(), "corner": set()}
    if item.get("category") not in ("sectional", "sofa"):
        return out
    cx, cy = float(item.get("x", 0)), float(item.get("y", 0))
    rot = math.radians(float(item.get("rotation", 0) or 0))
    ax = Vector((math.cos(rot), math.sin(rot), 0))
    w = pos(item.get("width"), 0.05)
    for other in spec.get("items", []):
        if other is item or other.get("category") not in ("sectional", "sofa"):
            continue
        ca, cb = hex_rgb(other.get("primary_color")), hex_rgb(item.get("primary_color"))
        if other.get("primary_material") != item.get("primary_material") or max(abs(x - y) for x, y in zip(ca, cb)) > 0.06:
            continue  # a different sofa, not the other half of this one
        dv = Vector((float(other.get("x", 0)) - cx, float(other.get("y", 0)) - cy, 0))
        reach = w / 2 + max(pos(other.get("width")), pos(other.get("depth"))) / 2 + 0.3
        if dv.length > reach:
            continue
        orot = math.radians(float(other.get("rotation", 0) or 0))
        if abs(math.cos(orot - rot)) > 0.3:  # only perpendicular pieces make an L
            continue
        out["join"].add(1 if dv.dot(ax) > 0 else -1)
    for side in list(out["join"]):
        end = Vector((cx, cy, 0)) + ax * side * w / 2
        for i in range(len(PTS)):
            a, b2 = PTS[i], PTS[(i + 1) % len(PTS)]
            ab = b2 - a
            t = max(0.0, min(1.0, (end - a).dot(ab) / max(ab.length_squared, 1e-9)))
            if (a + ab * t - end).length < 0.3:
                out["corner"].add(side)
    return out


def build_item(item):
    w, d, h = pos(item.get("width"), 0.05), pos(item.get("depth"), 0.02), pos(item.get("height"), 0.01)
    empty = bpy.data.objects.new(f"item__{item['id']}", None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.location = (float(item.get("x", 0)), float(item.get("y", 0)), float(item.get("elevation", 0) or 0))
    empty.rotation_euler = (0, 0, math.radians(float(item.get("rotation", 0) or 0)))
    empty["homebody_item"] = item["id"]
    empty["homebody_name"] = item.get("name", item["id"])
    fixed = is_fixed(item)
    if fixed:
        empty["homebody_fixed"] = True
    # Hung and built-in items remember their wall, so viewers can hide them with a cut-away wall
    if (empty.location.z > 0.4 or fixed) and PTS:
        p = Vector((empty.location.x, empty.location.y, 0))
        for i in range(len(PTS)):
            a, b2 = PTS[i], PTS[(i + 1) % len(PTS)]
            ab = b2 - a
            t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
            if (a + ab * t - p).length < 0.35:
                empty["homebody_on_wall"] = i
                break
    ITEMS.objects.link(empty)
    b = Builder(item, empty)
    c = item.get("category", "other")
    joins = sectional_joins(item)
    text = f"{item.get('id') or ''} {item.get('name') or ''} {item.get('notes') or ''}".lower()
    if c in ("sectional", "sofa") and joins["join"]:
        # one piece of an L made of two items: no arm where they meet; the piece that reaches the wall there
        # carries the corner seat's back
        arms = (-1 not in joins["join"], 1 not in joins["join"])
        sofa(b, w, d, h, None, 0.0, arms, corner=joins["corner"])
    elif c == "sectional":
        sectional(b, w, d, h)
    elif c == "sofa":
        sofa(b, w, d, h)
    elif c in ("armchair", "accent_chair"):
        sofa(b, w, d, h, seats=1)
    elif c == "dining_chair" and any(k in text for k in ("shell", "eames", "moulded", "molded")):
        shell_chair(b, w, d, h)
    elif c in ("dining_chair", "office_chair"):
        chair(b, w, d, h)
    elif c == "stool":
        chair(b, w, d, h, back=False)
    elif c in ("bench", "ottoman"):
        if c == "ottoman" or item.get("primary_material") in ("fabric", "boucle", "velvet", "leather"):
            b.soft("body", b.P, 0, 0, 0, w, d, h, r=min(0.05, h * 0.3), puff=0.015, side_puff=0.008)
        else:
            table(b, w, d, h, 0.04)
    elif c in ("coffee_table", "side_table") and any(k in text for k in ("tree-slice", "tree slice", "log slice", "wood slice")):
        tree_slice_table(b, w, d, h)
    elif c in ("coffee_table", "side_table", "dining_table", "desk", "console_table") and any(
            k in text for k in ("live-edge", "live edge", "raw-edge", "raw edge")):
        live_edge_table(b, w, d, h)
    elif c in ("coffee_table", "side_table"):
        table(b, w, d, h, 0.04)
    elif c in ("dining_table", "desk"):
        table(b, w, d, h, 0.035)
    elif c == "console_table":
        table(b, w, d, h, 0.03, shelf=True)
    elif c in ("kitchen_island", "counter"):
        stone = material("item:" + item.get("secondary_material", "stone"), item.get("secondary_color"))
        casework(b, w, d, h, 2, top_mat=stone, top_t=0.035)
    elif c in ("dresser",):
        casework(b, w, d, h, 3, leg=0.1)
    elif c in ("nightstand",):
        casework(b, w, d, h, 2, leg=0.1)
    elif c in ("tv_stand",):
        casework(b, w, d, h, 1, leg=0.0 if notes_say(b, "wall-hung", "floating", "wall hung", "wall-mounted") else 0.12)
    elif c in ("cabinet", "wardrobe"):
        casework(b, w, d, h, 1)
    elif c == "bookshelf":
        shelving(b, w, d, h)
    elif c == "shelving_unit":
        shelving(b, w, d, h, books=False)
    elif c == "bed":
        bed(b, w, d, h)
    elif c == "rug":
        shag = any(k in text for k in ("shag", "plush", "pile", "fluffy", "deep"))
        rug_key = "rug:wicker" if item.get("primary_material") == "wicker" else "rug:shag" if shag else "rug:fabric"
        b.soft("rug", material(rug_key, item.get("primary_color")), 0, 0, 0, w, d, 0.03 if shag else 0.012,
               r=0.012 if shag else 0.004, puff=0.006 if shag else 0.0)
    elif c == "floor_lamp":
        floor_lamp(b, w, d, h)
    elif c == "table_lamp":
        table_lamp(b, w, d, h)
    elif c == "pendant_light" and any(k in text for k in ("cage", "wire", "pyramid", "geometric frame")):
        cage_pendant(b, w, d, h)
    elif c == "pendant_light":
        pendant(b, w, d, h)
    elif c == "plant":
        plant(b, w, d, h)
    elif c == "tv":
        dd = max(d, 0.03)
        b.box("body", material("plastic", "#111214"), 0, -0.004, 0, w, dd - 0.008, h, 0.004)
        b.box("screen", material("screen", "#050607"), 0, dd / 2 - 0.006, 0.01, w - 0.02, 0.004, h - 0.02, 0)
    elif c == "mirror":
        artwork(b, w, d, h, mirror=True)
    elif c == "artwork":
        artwork(b, w, d, h)
    elif c == "curtains":
        if "sheer" in text:
            sheers(b, w, h)
        curtains(b, w, d, h)
    elif c == "appliance" and any(k in text for k in ("split", "air-con", "air con", "ac unit", "air conditioner")):
        ac_unit(b, w, d, h)
    elif c == "appliance":
        b.box("body", b.P, 0, 0, 0, w, d, h, 0.012)
        b.box("handle", material("metal_chrome", "#dddddd"), w * 0.3, d / 2 + 0.02, h * 0.55, 0.02, 0.03, h * 0.3, 0.004)
    elif c == "bicycle":
        bicycle(b, w, d, h)
    elif any(k in text for k in ("slat", "batten", "cladding")):
        cladding(b, w, d, h)
    elif "fireplace" in text or "fire insert" in text:
        fireplace(b, w, d, h)
    elif "shelf" in text and h < 0.15:
        floating_shelf(b, w, d, h)
    elif fixed and d < 0.05:  # a painted accent panel or other flat built-in
        b.box("panel", b.P, 0, 0, 0, w, max(d, 0.01), h, 0)
    else:
        b.box("body", b.P, 0, 0, 0, w, d, h, 0.02)


# ------------------------------------------------------------- room shell

def build_ceiling_timber(ceil):
    """Exposed rafters running up the slope, and a big beam along the room, hung from the ceiling (and hidden
    with it in cut-away views)."""
    a, u, inn, run = CEIL["a"], CEIL["u"], CEIL["in"], CEIL["run"]
    span = max(((p - a).dot(u) for p in PTS), default=1.0)
    start = min(((p - a).dot(u) for p in PTS), default=0.0)
    rise = CEIL["high"] - CEIL["low"]

    def timber(name, mat, center, along, length, width, depth, tilt):
        bm = bmesh.new()
        add_box(bm, 0, 0, -depth / 2, width, length, depth)
        # local y runs along the timber; tilt it to the slope, then turn it to face "along"
        m = (Matrix.Translation(center) @ Matrix.Rotation(math.atan2(along.y, along.x) - math.pi / 2, 4, "Z")
             @ Matrix.Rotation(tilt, 4, "X"))
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts[:])
        ob = make_object(name, bm, [mat], parent=ceil, bevel=0.006, collection=SHELL)
        ob["homebody_fixed"] = True
        return ob

    if CEIL["rafters"]:
        mat = material("item:wood_dark", CEIL["rafter_color"])
        k = max(2, int((span - start) / 0.9))
        for i in range(k):
            t = start + (span - start) * (i + 0.5) / k
            halves = [(0.0, 1.0)] if CEIL["shape"] == "mono_pitch" else [(0.0, 0.5), (0.5, 1.0)]
            for (f0, f1) in halves:
                p0 = a + u * t + inn * (run * f0)
                p1 = a + u * t + inn * (run * f1)
                z0, z1 = CEILING_AT(p0), CEILING_AT(p1)
                ln = math.hypot((p1 - p0).length, z1 - z0)
                c = (p0 + p1) / 2
                tilt = math.atan2(z1 - z0, (p1 - p0).length)
                timber(f"ceiling.rafter.{i}", mat, Vector((c.x, c.y, (z0 + z1) / 2 - 0.004)), inn, ln, 0.075, 0.15, tilt)
    if CEIL["beam"]:
        mat = material("item:oak" if CEIL["live_edge_beam"] else "item:wood_mid", CEIL["beam_color"])
        d = run * (0.5 if CEIL["shape"] == "gable" else 0.55)
        p = a + inn * d + u * (start + span) / 2
        timber("ceiling.beam", mat, Vector((p.x, p.y, CEILING_AT(p) - 0.16)), u, span - start, 0.24, 0.22, 0.0)


def build_shell():
    pts = [Vector((float(p["x"]), float(p["y"]), 0)) for p in spec["footprint"]]
    H = pos(spec.get("ceiling_height", 2.6), 1.8)
    n = len(pts)
    wall_mat = material("wall:" + spec["walls"].get("material", "paint"), spec["walls"].get("color", "#f2f0eb"))
    words_f = f"{spec.get('summary') or ''}".lower()
    fkind = spec["floor"].get("material", "wood_mid")
    if fkind == "tile" and "marble" in words_f:
        fkind = "marble"  # large-format marble-look porcelain: veined stone, no dark grout grid
    if fkind == "tile" and any(k in words_f for k in ("wood-look", "wood look", "wood-effect", "plank tile", "plank-style")):
        fkind = "wood_dark" if sum(hex_rgb(spec["floor"].get("color"))) < 1.2 else "wood_mid"
    floor_mat = material("floor:" + fkind, spec["floor"].get("color", "#b48a5a"))
    if any(k in words_f for k in ("polished", "glossy", "high-gloss", "mirror")):
        bsdf = next(n for n in floor_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        set_input(bsdf, ["Coat Weight", "Clearcoat"], 0.8)
        set_input(bsdf, "Coat Roughness", 0.03)
    trim = material("painted", "#f4f2ee")
    words = f"{spec.get('summary') or ''} {spec.get('lighting') or ''}".lower()
    dark_frames = spec["walls"].get("material") in ("brick", "painted_brick", "concrete") or any(
        k in words for k in ("black-framed", "black frame", "black-frame", "dark frame", "dark-framed", "anthracite"))
    frame_mat = material("metal_black", "#1a1a1a") if dark_frames else material("painted", "#f4f2ee")
    glass = material("glass", "#ffffff")
    door_mat = material("item:wood_mid", "#8a6a4a")
    T = 0.12

    def poly(z, flip, thickness=0.0):
        bm = bmesh.new()
        vs = [bm.verts.new((p.x, p.y, z)) for p in (reversed(pts) if flip else pts)]
        f = bm.faces.new(vs)
        if thickness:
            ext = bmesh.ops.extrude_face_region(bm, geom=[f])
            for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
                v.co.z -= thickness
        return bm

    floor = make_object("floor", poly(0, False, 0.05), [floor_mat], collection=SHELL)
    floor["homebody_floor"] = 1
    ceil_mat = material("wall:paint", spec.get("ceiling_color", "#f5f4f0"))
    cbm = poly(H, True)
    if CEIL["shape"] == "gable":  # split along the ridge so each half can slope
        mid = CEIL["a"] + CEIL["in"] * CEIL["run"] / 2
        bmesh.ops.bisect_plane(cbm, geom=cbm.verts[:] + cbm.edges[:] + cbm.faces[:], plane_co=mid, plane_no=CEIL["in"])
    for v in cbm.verts:
        v.co.z = CEILING_AT(v.co)
    ceil = make_object("ceiling", cbm, [ceil_mat], collection=SHELL)
    ceil["homebody_ceiling"] = 1
    if CEIL["shape"] != "flat":
        ceil["homebody_ceiling_shape"] = CEIL["shape"]
        build_ceiling_timber(ceil)
    H = H_MAX  # walls go up to the highest point and are then cut to the slope

    walls = []
    for i in range(n):
        a, b2 = pts[i], pts[(i + 1) % n]
        L = (b2 - a).length
        if L < 0.05:
            continue
        u = (b2 - a).normalized()
        inward = Vector((-u.y, u.x, 0))
        frame = Matrix(((u.x, inward.x, 0, a.x), (u.y, inward.y, 0, a.y), (0, 0, 1, 0), (0, 0, 0, 1)))
        ops = sorted([o for o in spec.get("openings", []) if int(o.get("wall", -1)) == i], key=lambda o: o["offset"])
        bm, bb, fx = bmesh.new(), bmesh.new(), bmesh.new()
        cursor = 0.0
        for o in ops:
            o0 = min(max(float(o["offset"]), 0), L)
            o1 = min(o0 + pos(o["width"], 0.2), L)
            s = max(float(o.get("sill", 0) or 0), 0)
            top = min(s + pos(o["height"], 0.3), H)
            if o0 > cursor:
                add_box(bm, (cursor + o0) / 2, -T / 2, 0, o0 - cursor, T, H)
                add_box(bb, (cursor + o0) / 2, 0.006, 0, o0 - cursor, 0.012, 0.09)
            if s > 0:
                add_box(bm, (o0 + o1) / 2, -T / 2, 0, o1 - o0, T, s)
            if top < H:
                add_box(bm, (o0 + o1) / 2, -T / 2, top, o1 - o0, T, H - top)
            ow, oh, mid = o1 - o0, top - s, (o0 + o1) / 2
            kind = o.get("type", "window")
            if kind in ("window", "glass_door"):
                add_box(fx, mid, -T * 0.6, s, ow, 0.008, oh, 1)
                for (cx, z, w_, h_) in [(o0 + 0.025, s, 0.05, oh), (o1 - 0.025, s, 0.05, oh),
                                        (mid, s, ow, 0.05), (mid, top - 0.05, ow, 0.05)]:
                    add_box(fx, cx, -T * 0.6, z, w_, 0.06, h_, 0)
                if ow > 1.4:
                    add_box(fx, mid, -T * 0.6, s, 0.04, 0.05, oh, 0)
                if kind == "window" and s > 0.2:  # a sill you could set a plant on
                    add_box(fx, mid, -T / 2 + 0.03, s - 0.025, ow + 0.08, T / 2 + 0.06, 0.025, 0)
                # casing around the opening on the room side
                for (cx, z, w_, h_) in [(o0 - 0.035, s, 0.07, oh + 0.035), (o1 + 0.035, s, 0.07, oh + 0.035),
                                        (mid, top, ow + 0.14, 0.07)]:
                    add_box(fx, cx, 0.008, z if kind == "glass_door" or cx == mid else max(s, 0), w_, 0.016, h_, 0)
            elif kind == "door":
                add_box(fx, mid, -0.03, 0, ow - 0.02, 0.04, oh - 0.01, 2)
                add_box(fx, o0 + ow * 0.85, 0.0, 1.0, 0.12, 0.03, 0.02, 0)
                for (cx, z, w_, h_) in [(o0 - 0.035, 0, 0.07, oh + 0.035), (o1 + 0.035, 0, 0.07, oh + 0.035),
                                        (mid, oh, ow + 0.14, 0.07)]:
                    add_box(fx, cx, 0.008, z, w_, 0.016, h_, 0)
            cursor = o1
        if cursor < L:
            add_box(bm, (cursor + L) / 2, -T / 2, 0, L - cursor, T, H)
            add_box(bb, (cursor + L) / 2, 0.006, 0, L - cursor, 0.012, 0.09)
        for mesh in (bm, bb, fx):
            bmesh.ops.transform(mesh, matrix=frame, verts=mesh.verts[:])
        if CEIL["shape"] != "flat":
            if CEIL["shape"] == "gable":
                mid = CEIL["a"] + CEIL["in"] * CEIL["run"] / 2
                bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=mid, plane_no=CEIL["in"])
            for v in bm.verts:  # the tops of the wall follow the ceiling
                if v.co.z > H - 1e-4:
                    v.co.z = CEILING_AT(v.co)
        wall = make_object(f"wall_{i}", bm, [wall_mat], collection=SHELL)
        wall["homebody_wall"] = i
        wall["outward"] = [-inward.x, -inward.y]
        walls.append(wall)
        if bb.verts:
            make_object(f"wall_{i}.baseboard", bb, [trim], parent=wall, bevel=0.003, collection=SHELL)
        else:
            bb.free()
        if fx.verts:
            make_object(f"wall_{i}.openings", fx, [frame_mat, glass, door_mat], parent=wall, bevel=0.003, collection=SHELL)
        else:
            fx.free()
    return pts, H, walls, ceil


# ---------------------------------------------------------- light & render

HDRI_BY_KIND = {
    "overcast": "residential_garden",
    "partly": "balcony",
    "clear": "suburban_garden",
    "golden": "belfast_sunset",
    "dusk": "kiara_9_dusk",
}


def pick_hdri(hdri_dir):
    """The sky outside the windows: the photos' pick (look.json) if any, else a guess from the spec's lighting
    notes, else a bright partly cloudy day."""
    have = {f.rsplit("_2k", 1)[0]: f for f in os.listdir(hdri_dir)} if os.path.isdir(hdri_dir) else {}
    if not have:
        return None, None
    light = LOOK.get("light") or {}
    want = LOOK.get("hdri")
    # what the windows look onto, from the read
    view = spec.get("outdoor_view")
    text = f"{spec.get('summary') or ''} {spec.get('lighting') or ''} {spec.get('name') or ''}".lower()
    if not view or view == "unknown":
        for words, v in [(("lake", "river", "sea view", "ocean", "waterfront", "water view", "harbour", "harbor"), "water"),
                         (("skyline", "city view", "street", "apartment block", "buildings opposite"), "city")]:
            if any(wd in text for wd in words):
                view = v
                break
    if not want and view == "water":
        want = "lakeside"
    elif not want and view in ("city", "street"):
        want = "residential_garden"
    want = want or HDRI_BY_KIND.get(light.get("kind", ""))
    kind = light.get("kind")
    if not want:
        text = (spec.get("lighting") or "").lower()
        for words, k in [(("dusk", "night", "evening"), "dusk"), (("sunset", "golden", "warm afternoon"), "golden"),
                         (("overcast", "cloudy", "diffuse", "soft"), "overcast"),
                         (("sunny", "direct sun", "bright sun", "sunlight"), "clear")]:
            if any(wd in text for wd in words):
                kind = k
                break
        want = HDRI_BY_KIND.get(kind or "partly")
    name = want if want in have else next(iter(sorted(have)))
    return os.path.join(hdri_dir, have[name]), kind


def sun_azimuth(img):
    """Where the sun sits in an equirectangular sky, as (azimuth, elevation) in Blender's world frame, from the
    brightest pixels. None for an overcast sky with no clear peak."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    lum = (px.reshape(h, w, 4)[:, :, :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32))
    peak = float(lum.max())
    if peak < 20 * float(np.median(lum)):  # no sun disc
        return None
    rows, cols = np.nonzero(lum >= peak * 0.5)
    u, v = (cols.mean() + 0.5) / w, (rows.mean() + 0.5) / h
    a = (u - 0.5) * math.tau
    el = (v - 0.5) * math.pi
    d = Vector((-math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
    return math.atan2(d.y, d.x), el


def setup_world_and_lights(pts, H):
    world = bpy.data.worlds.new("world")
    bpy.context.scene.world = world
    if bpy.app.version < (5, 0, 0):
        world.use_nodes = True
    nt = world.node_tree
    bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
    path, kind = pick_hdri(os.path.join(ASSETS, "hdri"))
    n = len(pts)
    windows = []
    for o in spec.get("openings", []):
        if o.get("type") not in ("window", "glass_door", "opening"):
            continue
        i = int(o["wall"])
        if 0 <= i < n:
            windows.append((o, i))
    info = {"hdri": os.path.basename(path) if path else None, "kind": kind}
    if path:
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(path, check_existing=True)
        coord = nt.nodes.new("ShaderNodeTexCoord")
        mapping = nt.nodes.new("ShaderNodeMapping")
        nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
        nt.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = 1.0
        # Turn the sky so its sun shines in through the biggest window, a little off square, like a real afternoon
        sun = sun_azimuth(env.image)
        if sun and windows:
            o, i = max(windows, key=lambda ow: pos(ow[0]["width"]) * pos(ow[0]["height"]))
            a, b2 = pts[i], pts[(i + 1) % n]
            u = (b2 - a).normalized()
            outward = Vector((u.y, -u.x, 0))
            target = math.atan2(outward.y, outward.x) + math.radians(35)
            mapping.inputs["Rotation"].default_value[2] = sun[0] - target
            info["sun_elevation_deg"] = round(math.degrees(sun[1]), 1)
    else:
        bg.inputs["Color"].default_value = (0.75, 0.82, 0.95, 1)
        bg.inputs["Strength"].default_value = 1.2

    # Each window gets a light portal: it adds no light of its own, it tells Cycles where the sky comes in,
    # so the room is lit by the real sky through the glass instead of a stand-in lamp.
    for o, i in windows:
        a, b2 = pts[i], pts[(i + 1) % n]
        u = (b2 - a).normalized()
        inward = Vector((-u.y, u.x, 0))
        w, hgt = pos(o["width"], 0.2), pos(o["height"], 0.3)
        c = a + u * (float(o["offset"]) + w / 2) - inward * 0.13
        c.z = float(o.get("sill", 0) or 0) + hgt / 2
        data = bpy.data.lights.new(f"window_{i}", "AREA")
        data.shape = "RECTANGLE"
        data.size, data.size_y = w, hgt
        if hasattr(data, "cycles"):
            data.cycles.is_portal = True
        ob = bpy.data.objects.new(data.name, data)
        # a portal only guides sampling; the camera and reflections should see the sky through it, never the portal
        for flag in ("visible_camera", "visible_glossy", "visible_transmission"):
            if hasattr(ob, flag):
                setattr(ob, flag, False)
        SHELL.objects.link(ob)
        ob.location = c
        # area lights shine down their local -Z; aim it into the room
        q = (-inward).to_track_quat("Z", "Y")
        ob.rotation_euler = q.to_euler()
    if not windows:
        # a room with no windows we know of: a soft ceiling panel, like a flush-mount fixture
        xs, ys = [p.x for p in pts], [p.y for p in pts]
        data = bpy.data.lights.new("ceiling_fixture", "AREA")
        data.shape = "DISK"
        data.size = 0.4
        data.energy = 120
        if hasattr(data, "use_temperature"):
            data.use_temperature = True
            data.temperature = 3000
        fix = bpy.data.objects.new("ceiling_fixture", data)
        SHELL.objects.link(fix)
        fix.location = ((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, H - 0.02)
    return info


def setup_render(scene):
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for dev in prefs.devices:
            dev.use = True
        scene.cycles.device = "GPU"
    except Exception as e:  # CPU still works, just slower
        log("warn", f"GPU unavailable: {e}")
    c = scene.cycles
    c.samples = 48 if QUICK else 256
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.03 if QUICK else 0.01
    c.use_denoising = True
    c.max_bounces = 12
    c.diffuse_bounces = 5
    c.glossy_bounces = 4
    c.transmission_bounces = 8
    c.transparent_max_bounces = 16
    c.sample_clamp_indirect = 8.0
    c.blur_glossy = 1.0
    c.caustics_reflective = False
    c.caustics_refractive = False
    scene.render.use_persistent_data = True
    scene.render.resolution_x, scene.render.resolution_y = (800, 500) if QUICK else (1600, 1000)
    scene.render.image_settings.file_format = "PNG"
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    scene.view_settings.exposure = 0.0


WB_STRENGTH = 0.7


def white_balance(scene, kind):
    """A phone balances white to the daylight in the room; warm lamps stay a little warm, as they look in photos."""
    v = scene.view_settings
    if not hasattr(v, "use_white_balance"):
        return
    v.use_white_balance = True
    v.white_balance_temperature = {"golden": 4700, "dusk": 3800}.get(kind, 6300)
    v.white_balance_tint = 0


def camera(name, location, target, lens, level=False):
    """A camera aimed at target. level keeps it upright like a photographer would (vertical lines stay vertical)
    and frames the target with lens shift instead of tilting."""
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_width = 36
    data.clip_start = 0.05
    data.clip_end = 200
    cam = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = location
    direction = Vector(target) - Vector(location)
    if level:
        flat = Vector((direction.x, direction.y, 0))
        dist = max(flat.length, 0.5)
        cam.rotation_euler = flat.to_track_quat("-Z", "Y").to_euler()
        data.shift_y = clamp(direction.z / dist * lens / 36 * (bpy.context.scene.render.resolution_x / bpy.context.scene.render.resolution_y) / 1.6, -0.25, 0.25)
    else:
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return cam


def auto_exposure(scene, key=0.2):
    """Meters the shot like a camera: a tiny fast render, log-average brightness with the windows and lamp
    hot spots left out, then the exposure that puts it at a photographic middle grey."""
    r = scene.render
    keep = (r.resolution_x, r.resolution_y, scene.cycles.samples, scene.cycles.use_denoising, r.image_settings.file_format,
            r.filepath, scene.view_settings.exposure)
    r.resolution_x, r.resolution_y = 160, 100
    scene.cycles.samples = 12
    scene.cycles.use_denoising = False
    r.image_settings.file_format = "OPEN_EXR"
    meter = os.path.join(OUT, "_meter.exr")
    r.filepath = meter
    try:
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(meter)
        px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        px = px.reshape(-1, 4)
        if scene.render.film_transparent:
            px = px[px[:, 3] > 0.5]  # only the room, not the empty space around it
        lum = px[:, :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        lum = np.sort(lum[np.isfinite(lum)])
        lum = lum[: max(1, int(len(lum) * 0.95))]  # leave out the brightest 5% (sky, bulbs)
        avg = float(np.exp(np.mean(np.log(np.maximum(lum, 1e-5)))))
        # Auto white balance against a grey card: a second meter pass with every surface a neutral grey shows the
        # color of the light itself (sky, sun, lamps, the bounce off the ground outside), not of the furniture, so
        # a room full of warm wood isn't pushed blue. Corrected most of the way, so lamps and golden hour stay warm.
        wp = None
        if hasattr(scene.view_settings, "white_balance_whitepoint"):
            grey = bpy.data.materials.get("_grey_card") or new_material("_grey_card")
            g_bsdf = next(n for n in grey.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            set_input(g_bsdf, "Base Color", (0.5, 0.5, 0.5, 1))
            set_input(g_bsdf, "Roughness", 0.9)
            vl = bpy.context.view_layer
            vl.material_override = grey
            # the override would turn the window glass into grey card too and shut out the sky
            panes = [o for o in bpy.data.objects if o.name.endswith(".openings") and not o.hide_render]
            for o in panes:
                o.hide_render = True
            try:
                bpy.ops.render.render(write_still=True)
            finally:
                vl.material_override = None
                for o in panes:
                    o.hide_render = False
            card = bpy.data.images.load(meter)
            cp = np.empty(card.size[0] * card.size[1] * 4, dtype=np.float32)
            card.pixels.foreach_get(cp)
            bpy.data.images.remove(card)
            cp = cp.reshape(-1, 4)
            if scene.render.film_transparent:
                cp = cp[cp[:, 3] > 0.5]
            cl = cp[:, :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
            lo, hi = np.percentile(cl, [20, 90])
            mids = cp[(cl >= lo) & (cl <= hi), :3]
            if len(mids) > 100:
                m = mids.mean(0)
                m = m / max(float(m @ np.array([0.2126, 0.7152, 0.0722])), 1e-6)
                wp = tuple(float(1 + (c - 1) * WB_STRENGTH) for c in m)
        ev = clamp(math.log2(key / max(avg, 1e-6)), -4.0, 8.0)
    except Exception as e:
        log("warn", f"metering failed: {e}")
        ev, wp = 0.0, None
    finally:
        (r.resolution_x, r.resolution_y, scene.cycles.samples, scene.cycles.use_denoising, r.image_settings.file_format,
         r.filepath, scene.view_settings.exposure) = keep
        if os.path.exists(meter):
            os.remove(meter)
    scene.view_settings.exposure = ev
    if wp:
        v = scene.view_settings
        v.use_white_balance = True
        log("meter", f"ev {ev:.2f} whitepoint {tuple(round(c, 3) for c in wp)}")
        try:
            v.white_balance_whitepoint = wp
        except (AttributeError, TypeError, ValueError) as e:
            log("warn", f"white balance: {e}")
    return ev


def render_views(pts, H, walls, ceil):
    scene = bpy.context.scene
    xs, ys = [p.x for p in pts], [p.y for p in pts]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    size = max(max(xs) - min(xs), max(ys) - min(ys))
    centroid = Vector((sum(xs) / len(xs), sum(ys) / len(ys), 0))
    shots = []

    # Dollhouse: from above one corner, with the ceiling and the two near walls cut away
    view_dir = Vector((0.75, -1.0, 0)).normalized()
    eye = Vector((cx, cy, 0)) + view_dir * size * 1.15
    eye.z = H_MAX + size * 0.95
    shots.append(("render_dollhouse", eye, (cx, cy, 0.3), 30, view_dir, False))

    # Two eye-level views from opposite corners, like a photo taken standing in a doorway: a phone's main
    # camera is about a 24 mm lens (full-frame equivalent), held level at about 1.5 m.
    # Step in from each corner until the camera isn't inside anything tall.
    def blocked(p):
        for it in spec.get("items", []):
            elev = float(it.get("elevation", 0) or 0)
            if elev > 1.6 or elev + pos(it.get("height")) < 1.1:
                continue
            reach = max(pos(it.get("width")), pos(it.get("depth"))) / 2 + 0.35
            if abs(p.x - float(it.get("x", 0))) < reach and abs(p.y - float(it.get("y", 0))) < reach:
                return True
        return False

    lens = 22 if size < 4.5 else 24
    # Candidate eye-level spots in every corner and at each wall's middle, each aimed at the furniture. A view is
    # only worth rendering if it shows the room: score each by how many pieces fall inside its frame, skip any
    # that sees fewer than three, and keep the best two from different spots.
    furn = [it for it in spec.get("items", []) if it.get("category") not in ("curtains",) and not is_fixed(it)]
    if furn:
        aim = Vector((sum(float(i.get("x", 0)) for i in furn) / len(furn), sum(float(i.get("y", 0)) for i in furn) / len(furn), 0))
    else:
        aim = centroid
    half_fov = math.atan(18 / lens) * 0.92

    def score(p, tgt):
        fwd = Vector((tgt.x - p.x, tgt.y - p.y, 0)).normalized()
        seen = 0.0
        for it in spec.get("items", []):
            q = Vector((float(it.get("x", 0)) - p.x, float(it.get("y", 0)) - p.y, 0))
            if q.length < 0.6:
                continue
            ang = math.acos(clamp(q.normalized().dot(fwd), -1, 1))
            if ang < half_fov:
                seen += 0.5 if is_fixed(it) or it.get("category") in ("rug", "curtains") else 1.0
        return seen

    cands = []
    spots = list(pts) + [(pts[i] + pts[(i + 1) % len(pts)]) / 2 for i in range(len(pts))]
    for corner in spots:
        t = 0.08
        p = corner + (centroid - corner) * t
        while (blocked(p) or (p - corner).length < 0.4) and t < 0.55:
            t += 0.04
            p = corner + (centroid - corner) * t
        if blocked(p):
            continue
        cands.append((score(p, aim), p))
    cands.sort(key=lambda c: -c[0])
    picked = []
    for sc, p in cands:
        if sc < 3 and picked:
            break
        if all((p - q).length > 1.2 for _, q in picked):
            picked.append((sc, p))
        if len(picked) == 2:
            break
    for k, (sc, p) in enumerate(picked):
        log("view", f"eye_{k + 1} sees {sc:g} pieces")
        shots.append((f"render_eye_{k + 1}", Vector((p.x, p.y, 1.5)), (aim.x, aim.y, 1.0), lens, None, True))

    # Same viewpoints as the owner's photos: solved from marked points (photo_look.py) or recovered poses
    for pc in LOOK.get("cameras") or []:
        try:
            shots.append((f"render_photo_{int(pc['photo'])}", Matrix(pc["matrix"]), None, float(pc.get("lens_mm", 26)),
                          None, pc))
        except (KeyError, TypeError, ValueError):
            continue

    def near_segment(p, a, b2, tol):
        ab = b2 - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
        return (a + ab * t - p).length < tol

    wall_mounted = []
    for ob in bpy.data.objects:
        if "homebody_item" in ob and (ob.location.z > 0.4 or ob.get("homebody_fixed")):
            wall_mounted.append(ob)

    files, exposures = [], {}
    base_res = (scene.render.resolution_x, scene.render.resolution_y)
    for name, eye, target, lens_mm, cut, level in shots:
        if isinstance(level, dict):  # a photo's own camera: its pose, lens and shape
            pc = level
            data = bpy.data.cameras.new(name)
            data.lens, data.sensor_width, data.sensor_fit = lens_mm, 36, "HORIZONTAL"
            data.clip_start, data.clip_end = 0.05, 200
            cam = bpy.data.objects.new(name, data)
            scene.collection.objects.link(cam)
            cam.matrix_world = eye
            aspect = float(pc.get("aspect", 1.5))
            scene.render.resolution_x, scene.render.resolution_y = base_res[0], int(round(base_res[0] / aspect))
        else:
            scene.render.resolution_x, scene.render.resolution_y = base_res
            cam = camera(name, eye, target, lens_mm, level)
        scene.camera = cam
        ceil.hide_render = cut is not None
        for child in ceil.children:
            child.hide_render = cut is not None
        cut_segments = []
        for wl in walls:
            out = Vector((wl["outward"][0], wl["outward"][1], 0))
            hidden = cut is not None and out.dot(cut) > 0.15
            wl.hide_render = hidden
            for child in wl.children:
                child.hide_render = hidden
            if hidden:
                i = wl["homebody_wall"]
                cut_segments.append((pts[i], pts[(i + 1) % len(pts)]))
        # art and shelves hung on a cut-away wall would float in midair
        for ob in wall_mounted:
            p = Vector((ob.location.x, ob.location.y, 0))
            hidden = any(near_segment(p, a, b2, 0.35) for a, b2 in cut_segments)
            for child in ob.children_recursive:
                child.hide_render = hidden
        log("render", name)
        # the dollhouse floats on a transparent background, so the page shows behind it
        scene.render.film_transparent = cut is not None
        scene.render.image_settings.color_mode = "RGBA" if cut is not None else "RGB"
        # eye-level views take the photos' own brightness (a moody room stays moody); the dollhouse stays bright
        key = clamp(float(LOOK.get("key") or 0.14), 0.05, 0.2)
        exposures[name] = round(auto_exposure(scene, 0.24 if cut is not None else key), 2)
        path = os.path.join(OUT, name + ".png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        files.append(os.path.basename(path))
    for wl in walls:
        wl.hide_render = False
        for child in wl.children:
            child.hide_render = False
    ceil.hide_render = False
    scene.render.resolution_x, scene.render.resolution_y = base_res
    return files, exposures


def lab(rgb_lin):
    """Linear sRGB (N,3) to CIE Lab (D65)."""
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = rgb_lin @ m.T / np.array([0.9505, 1.0, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)


def color_check():
    """Checks that every measured color in look.json reached the material it drives: the average albedo of that
    material's base color (texture or flat) against the look color, as a CIE ΔE. Over 6 is a visible miss."""
    targets = {}
    for k in ("walls", "floor", "ceiling"):
        if LOOK.get(k):
            targets[k] = LOOK[k]
    for k, v in (LOOK.get("items") or {}).items():
        targets[f"item {k}"] = v
    out = []
    for label, hexc in targets.items():
        mats = [m for m in bpy.data.materials if m.get("homebody_color") == hexc]
        if not mats:
            out.append({"what": label, "look": hexc, "material": None, "delta_e": None, "ok": False})
            continue
        m = mats[0]
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        link = bsdf.inputs["Base Color"].links
        if link and link[0].from_node.type == "TEX_IMAGE":
            img = link[0].from_node.image
            px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
            img.pixels.foreach_get(px)
            rgb = px.reshape(-1, 4)[:, :3]
            got = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4).mean(0)
        else:
            got = np.array(bsdf.inputs["Base Color"].default_value[:3])
        want = np.minimum(np.array(rgba(hexc)[:3]), 0.85)
        de = float(np.linalg.norm(lab(got[None, :]) - lab(want[None, :])))
        enc = np.where(got <= 0.0031308, got * 12.92, 1.055 * np.power(np.maximum(got, 0), 1 / 2.4) - 0.055)
        out.append({"what": label, "look": hexc, "material": m.name, "got": "#" + "".join(f"{int(round(min(c, 1) * 255)):02x}" for c in enc),
                    "delta_e": round(de, 1), "ok": de < 6})
    bad = [o for o in out if not o["ok"]]
    log("check", f"{len(out) - len(bad)}/{len(out)} measured colors reached their materials" + (f"; misses: {[o['what'] for o in bad]}" if bad else ""))
    return out


def match_scores(files):
    """For renders made from a photo's own camera: how far the render is from the photo. Both are shrunk to
    96 px wide and blurred a little. color_de is the mean CIE ΔE per pixel (0 = same colors; under ~10 reads as
    close); edges is the correlation of their edge maps (1 = the same lines in the same places, 0 = unrelated)."""
    import OpenImageIO as oiio
    out = {}
    cams = {f"render_photo_{int(pc['photo'])}.png": pc for pc in LOOK.get("cameras") or []}
    for f in files:
        pc = cams.get(f)
        if not pc or not os.path.exists(pc.get("file", "")):
            continue

        def small(path):
            b = oiio.ImageBuf(path)
            sp = b.spec()
            w = 96
            hh = max(1, int(round(sp.height * w / sp.width)))
            b = oiio.ImageBufAlgo.resize(b, roi=oiio.ROI(0, w, 0, hh, 0, 1, 0, 3))
            a = b.get_pixels(oiio.FLOAT)[:, :, :3].astype(np.float64)
            return a
        ph, rd = small(pc["file"]), small(os.path.join(OUT, f))
        hh = min(ph.shape[0], rd.shape[0])
        ph, rd = ph[:hh], rd[:hh]
        lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
        de = np.linalg.norm(lab(lin(ph).reshape(-1, 3)) - lab(lin(rd).reshape(-1, 3)), axis=1).mean()

        def edges(a):
            g = a @ np.array([0.2126, 0.7152, 0.0722])
            gx, gy = np.zeros_like(g), np.zeros_like(g)
            gx[:, 1:-1] = g[:, 2:] - g[:, :-2]
            gy[1:-1, :] = g[2:, :] - g[:-2, :]
            e = np.hypot(gx, gy)
            return (e - e.mean()) / (e.std() + 1e-6)
        corr = float((edges(ph) * edges(rd)).mean())
        out[f] = {"photo": os.path.basename(pc["file"]), "color_de": round(float(de), 1), "edges": round(corr, 3),
                  "reprojection_px": pc.get("rms_px")}
        log("match", f"{f}: color ΔE {de:.1f}, edge correlation {corr:.2f}")
    return out


# ------------------------------------------------------------------- main

def main():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    scene = bpy.context.scene
    scene.collection.children.link(SHELL)
    scene.collection.children.link(ITEMS)
    scene.unit_settings.system = "METRIC"

    log("shell", "walls, floor, openings")
    pts, H, walls, ceil = build_shell()
    log("items", f"{len(spec.get('items', []))} pieces")
    for item in spec.get("items", []):
        try:
            build_item(item)
        except Exception as e:  # one odd item shouldn't sink the room
            log("warn", f"item {item.get('id')}: {e}")

    log("export", "room.glb")
    glb = os.path.join(OUT, "room.glb")
    kwargs = dict(filepath=glb, export_format="GLB", export_apply=True, export_extras=True,
                  export_lights=False, export_cameras=False, export_yup=True)
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_image_format="JPEG")
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)

    render_materials()
    light = setup_world_and_lights(pts, H)
    setup_render(scene)
    white_balance(scene, light.get("kind") if spec.get("openings") else "dusk")
    renders, exposures = render_views(pts, H, walls, ceil)
    checks = color_check()
    match = match_scores(renders)

    json.dump({"glb": "room.glb", "renders": renders, "seconds": round(time.time() - T0, 1),
               "quick": QUICK, "blender": bpy.app.version_string,
               "light": {**light, "lamps_on": LAMPS_ON, "exposure_ev": exposures},
               "look": os.path.basename(LOOK_PATH) if LOOK else None, "color_check": checks, "match": match,
               "ceiling": {"shape": CEIL["shape"], "low": CEIL["low"], "high": round(CEIL["high"], 2)}},
              open(os.path.join(OUT, "build.json"), "w"), indent=2)
    log("done", f"{round(time.time() - T0, 1)}s")


main()
