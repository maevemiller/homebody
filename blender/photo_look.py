"""Measure a room's look from the owner's photos: true surface colors, and the light to match.

Run headless (Blender's bundled Python has numpy and OpenImageIO):
  Blender -b --factory-startup -P blender/photo_look.py -- SPEC.json PHOTOS_DIR OUT_LOOK.json

Reads the prepared photos (photos/photo-NN.jpg, as lib/scan/images.ts writes them) and the spec. Writes
look.json, which blender/build_room.py takes with --look:
  walls, floor, ceiling     measured hex colors
  items                     {item id: hex} for each item with a measured patch
  light                     {kind: overcast|partly|clear|golden|dusk, lamps_on, kelvin_estimate}
  stats                     what was measured, for checking

How colors are measured: each photo is white balanced first (on the ceiling patch if there is one, else on its
bright near-neutral pixels), then each surface's color is the median of its patches. Photos record light, not
paint, so brightness is anchored to the spec's own wall color (read by eye from all photos at once) and only the
measured hue and saturation, plus the relative brightness between surfaces, come from the pixels.
Without photo_regions in the spec it falls back to safe bands: the floor from the bottom strip of each photo and
the walls from the upper middle, which works for the usual eye-level shot.
"""
import json
import math
import os
import sys

import numpy as np
import OpenImageIO as oiio

argv = sys.argv[sys.argv.index("--") + 1:]
SPEC, PHOTOS, OUT = argv[0], argv[1], argv[2]
spec = json.load(open(SPEC))
LUMA = np.array([0.2126, 0.7152, 0.0722])


def to_linear(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def to_hex(lin):
    lin = np.clip(lin, 0, 1)
    s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    return "#" + "".join(f"{int(round(v * 255)):02x}" for v in s)


def hex_linear(h):
    h = (h or "#b3b3b3").lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        return to_linear(np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]))
    except ValueError:
        return to_linear(np.array([0.7, 0.7, 0.7]))


def load(path):
    buf = oiio.ImageBuf(path)
    spec_ = buf.spec()
    # work at about 800 px; plenty for medians and fast
    if spec_.width > 900:
        h = int(spec_.height * 800 / spec_.width)
        buf = oiio.ImageBufAlgo.resize(buf, roi=oiio.ROI(0, 800, 0, h, 0, 1, 0, spec_.nchannels))
    px = buf.get_pixels(oiio.FLOAT)[:, :, :3]
    return to_linear(px.astype(np.float64))


def patch(img, box):
    h, w, _ = img.shape
    x0, y0, x1, y1 = [float(v) for v in box]
    x0, x1 = sorted((min(max(x0, 0), 1), min(max(x1, 0), 1)))
    y0, y1 = sorted((min(max(y0, 0), 1), min(max(y1, 0), 1)))
    a = img[int(y0 * h):max(int(y1 * h), int(y0 * h) + 1), int(x0 * w):max(int(x1 * w), int(x0 * w) + 1)]
    a = a.reshape(-1, 3)
    lum = a @ LUMA
    keep = (lum > 0.003) & (a.max(1) < 0.98)  # no crushed shadows, no clipped highlights
    return a[keep] if keep.sum() > 20 else None


def white_gains(img, ceiling_px):
    """Per-channel gains that make the scene's white neutral, like a camera's white balance in reverse."""
    ref = np.median(ceiling_px, 0) if ceiling_px is not None and len(ceiling_px) > 50 else None
    if ref is not None and (ref.max() - ref.min()) / max(ref.max(), 1e-4) > 0.25:
        ref = None  # that "ceiling" patch is colored (a beam, a lamp's glow); don't balance on it
    if ref is None:
        a = img.reshape(-1, 3)
        lum = a @ LUMA
        ok = (a.max(1) < 0.97) & (lum > np.percentile(lum, 70))
        a = a[ok]
        sat = (a.max(1) - a.min(1)) / np.maximum(a.max(1), 1e-4)
        a = a[sat < np.percentile(sat, 40)]
        if len(a) < 50:
            return np.ones(3), None
        ref = a.mean(0)
    ref = np.maximum(ref, 1e-4)
    # Phones already white balance, so only nudge: at most 8% per channel
    g = np.clip((ref @ LUMA) / ref, 0.92, 1.08)
    return g, ref


def kelvin(ref):
    """A rough color temperature of the light from its white-reference color (red/blue balance)."""
    if ref is None:
        return None
    rb = ref[0] / max(ref[2], 1e-4)
    # ~1.0 at 6500 K daylight, ~1.6 at 4000 K, ~2.4 at 3000 K, ~0.8 at 8000 K (sRGB primaries, rough fit)
    return int(round(6500 / max(rb, 0.3) ** 0.85, -2))


def solve_camera(points, W, H):
    """A camera from marked points: [(u, v) in pixels, (x, y, z) in room meters]. Square pixels and a centered
    principal point; solves the focal length and the pose by least squares on the reprojection error, started
    from a direct linear transform. Returns (focal px, R, t, rms px) in OpenCV convention (x right, y down,
    z forward), or None."""
    uv = np.array([p[0] for p in points], float)
    X = np.array([p[1] for p in points], float)
    n = len(points)
    if n < 6:
        return None
    # DLT for a starting pose
    A = []
    for (u, v), (x, y, z) in zip(uv, X):
        A.append([x, y, z, 1, 0, 0, 0, 0, -u * x, -u * y, -u * z, -u])
        A.append([0, 0, 0, 0, x, y, z, 1, -v * x, -v * y, -v * z, -v])
    P = np.linalg.svd(np.array(A))[2][-1].reshape(3, 4)
    M = P[:, :3]
    if np.linalg.det(M) < 0:
        P, M = -P, -M
    # RQ decomposition of M = K R
    Q, Rr = np.linalg.qr(np.flipud(M).T)
    K = np.flipud(np.fliplr(Rr.T))
    R = np.flipud(Q.T)
    D = np.diag(np.sign(np.diag(K)))
    K, R = K @ D, D @ R
    t = np.linalg.solve(K, P[:, 3])
    if np.linalg.det(R) < 0:
        R, t = -R, -t
    f0 = float(abs(K[0, 0] / K[2, 2]) + abs(K[1, 1] / K[2, 2])) / 2
    if not np.isfinite(f0) or not 0.3 * W < f0 < 5 * W:
        f0 = W * 0.9
    cx, cy = W / 2, H / 2

    def rodrigues(r):
        th = np.linalg.norm(r)
        if th < 1e-9:
            return np.eye(3)
        k = r / th
        Kx = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
        return np.eye(3) + np.sin(th) * Kx + (1 - np.cos(th)) * Kx @ Kx

    def to_rvec(Rm):
        th = np.arccos(np.clip((np.trace(Rm) - 1) / 2, -1, 1))
        if th < 1e-9:
            return np.zeros(3)
        return th / (2 * np.sin(th)) * np.array([Rm[2, 1] - Rm[1, 2], Rm[0, 2] - Rm[2, 0], Rm[1, 0] - Rm[0, 1]])

    def resid(q):
        f, r, tt = q[0], q[1:4], q[4:7]
        pc = X @ rodrigues(r).T + tt
        z = np.where(np.abs(pc[:, 2]) < 1e-6, 1e-6, pc[:, 2])
        return np.concatenate([f * pc[:, 0] / z + cx - uv[:, 0], f * pc[:, 1] / z + cy - uv[:, 1]])

    def refine(q):
        lam = 1e-2
        err = resid(q)
        for _ in range(150):  # Levenberg-Marquardt with a numeric Jacobian
            J = np.zeros((len(err), 7))
            for j in range(7):
                dq = np.zeros(7)
                dq[j] = 1e-6 * max(1.0, abs(q[j]))
                J[:, j] = (resid(q + dq) - err) / dq[j]
            g = J.T @ err
            Hm = J.T @ J
            try:
                step = np.linalg.solve(Hm + lam * np.diag(np.diag(Hm) + 1e-9), -g)
            except np.linalg.LinAlgError:
                break
            new = resid(q + step)
            if new @ new < err @ err:
                q, err, lam = q + step, new, lam * 0.3
                if np.linalg.norm(step) < 1e-9:
                    break
            else:
                lam *= 10
                if lam > 1e8:
                    break
        return q, err

    def look_at(C, target):
        fwd = target - C
        fwd /= np.linalg.norm(fwd)
        right = np.cross(fwd, [0, 0, 1.0])
        right /= max(np.linalg.norm(right), 1e-9)
        down = np.cross(fwd, right)
        Rm = np.stack([right, down, fwd])  # rows: camera x (right), y (down), z (forward) in world
        return Rm, -Rm @ C

    # Several starts (the linear solve, and a grid of standing positions in the room at a few focal lengths); keep
    # the one that reprojects best with every point in front of the camera
    starts = [np.concatenate([[f0], to_rvec(R), t])]
    lo, hi = X.min(0), X.max(0)
    centre = X.mean(0)
    span = max(hi[0] - lo[0], hi[1] - lo[1], 2.0)
    for gx in np.linspace(-1, 1, 5):
        for gy in np.linspace(-1, 1, 5):
            C = np.array([centre[0] + gx * span, centre[1] + gy * span, 1.4])
            if np.linalg.norm(C[:2] - centre[:2]) < 0.5:
                continue
            Rm, tt = look_at(C, centre)
            for fm in (14, 20, 26, 35):
                starts.append(np.concatenate([[fm / 36 * W], to_rvec(Rm), tt]))
    best = None
    for q0 in starts:
        q, err = refine(q0)
        Rm = rodrigues(q[1:4])
        if not (0.2 * W < q[0] < 4 * W) or np.any((X @ Rm.T + q[4:7])[:, 2] <= 0.1):
            continue
        rms = float(np.sqrt((err ** 2).mean()))
        if best is None or rms < best[3]:
            best = (float(q[0]), Rm, q[4:7], rms)
    return best


def photo_cameras(by_number):
    """Cameras for the photos that have marked points (spec.photo_marks, or marks.json next to the photos)."""
    marks = list(spec.get("photo_marks") or [])
    mfile = os.path.join(os.path.dirname(os.path.abspath(PHOTOS)), "marks.json")
    if os.path.exists(mfile):
        marks += json.load(open(mfile)).get("photo_marks", [])
    cams = []
    for m in marks:
        num = int(m.get("photo", 0))
        path = by_number.get(num)
        if not path or len(m.get("points") or []) < 6:
            continue
        sp = oiio.ImageInput.open(path).spec()
        W, H = sp.width, sp.height
        pts = [((p["u"] * W, p["v"] * H), (p["x"], p["y"], p["z"])) for p in m["points"]]
        sol = solve_camera(pts, W, H)
        if not sol:
            print(f"HB:warn camera for photo {num} didn't solve", flush=True)
            continue
        f, R, t, rms = sol
        # OpenCV camera (x right, y down, z forward) to Blender's (x right, y up, looking down -z)
        cam_to_world = R.T @ np.diag([1.0, -1.0, -1.0])
        C = -R.T @ t
        mw = np.eye(4)
        mw[:3, :3] = cam_to_world
        mw[:3, 3] = C
        cams.append({"photo": num, "file": os.path.abspath(path), "matrix": mw.tolist(), "lens_mm": round(f / W * 36, 2),
                     "aspect": W / H, "rms_px": round(rms, 1), "position": [round(c, 2) for c in C]})
        print(f"HB:camera photo {num}: {f / W * 36:.1f} mm at {np.round(C, 2).tolist()}, rms {rms:.1f}px", flush=True)
    return cams


def main():
    files = sorted(f for f in os.listdir(PHOTOS) if f.startswith("photo-") and f.endswith(".jpg"))
    by_number = {}
    for f in files:
        stem = f[len("photo-"):-4]
        if stem.isdigit():
            by_number[int(stem)] = os.path.join(PHOTOS, f)
    regions = spec.get("photo_regions") or []
    samples = {}  # surface -> list of WB'd colors (one per patch)
    temps, contrasts, clipped, means, keys = [], [], [], [], []
    for num, path in sorted(by_number.items()):
        img = load(path)
        mine = [r for r in regions if int(r.get("photo", -1)) == num and len(r.get("box") or []) == 4]
        ceil_px = [p for p in (patch(img, r["box"]) for r in mine if r.get("surface") == "ceiling") if p is not None]
        gains, ref = white_gains(img, np.concatenate(ceil_px) if ceil_px else None)
        temps.append(kelvin(ref))
        lum = img.reshape(-1, 3) @ LUMA
        p5, p50, p95 = np.percentile(lum, [5, 50, 95])
        contrasts.append(float(p95 / max(p5, 1e-4)))
        clipped.append(float((img.reshape(-1, 3).max(1) > 0.97).mean()))
        means.append(float(p50))
        srt = np.sort(lum)[: max(1, int(len(lum) * 0.95))]
        keys.append(float(np.exp(np.mean(np.log(np.maximum(srt, 1e-5))))))
        if not mine:  # no patches from the read: safe bands for an eye-level shot
            mine = [{"surface": "floor", "box": [0.3, 0.88, 0.7, 0.99]},
                    {"surface": "wall", "box": [0.35, 0.18, 0.65, 0.35]}]
        for r in mine:
            px = patch(img, r["box"])
            if px is None:
                continue
            samples.setdefault(r["surface"], []).append(np.median(px * gains, 0))

    look = {"source": "photos", "stats": {}}
    med = {k: np.median(np.array(v), 0) for k, v in samples.items() if v}
    # Brightness anchor: the walls as read by eye (they fill most photos and the read sees them in context)
    spec_wall = hex_linear((spec.get("walls") or {}).get("color"))
    anchor = None
    if "wall" in med and med["wall"] @ LUMA > 1e-4:
        anchor = (spec_wall @ LUMA) / (med["wall"] @ LUMA)
    elif "ceiling" in med and med["ceiling"] @ LUMA > 1e-4:
        anchor = (hex_linear(spec.get("ceiling_color")) @ LUMA) / (med["ceiling"] @ LUMA)

    def finish(lin, fallback_hex, surface=""):
        """The photo's hue and saturation at the read's brightness. A photo's light varies too much across the
        room (a sunlit floor, a wall in shade) for raw pixel brightness to stand for paint or fabric."""
        read = hex_linear(fallback_hex)
        # A near-neutral surface (white paint, grey stone) stays as the read gave it unless the photo clearly
        # shows a color: small casts in a photo (sky bounce, white balance) shouldn't tint white walls cyan
        def sat(c):
            c = np.clip(c, 1e-6, None) ** (1 / 2.2)
            return (c.max() - c.min()) / max(c.max(), 1e-6)
        limit = 0.3 if surface in ("wall", "ceiling") else 0.12
        if sat(read) < 0.07 and sat(lin) < limit:
            return fallback_hex.lower() if fallback_hex else to_hex(read)
        want = read @ LUMA
        lin = lin * (want / max(lin @ LUMA, 1e-4))
        # halfway between the read's color and the measured one: a patch can land on the wrong thing, and the
        # read sees the whole room
        lin = 0.5 * lin + 0.5 * read
        return to_hex(np.minimum(lin, 0.9))

    if "wall" in med:
        look["walls"] = finish(med["wall"], (spec.get("walls") or {}).get("color"), "wall")
    if "floor" in med:
        look["floor"] = finish(med["floor"], (spec.get("floor") or {}).get("color"))
    if "ceiling" in med:
        look["ceiling"] = finish(med["ceiling"], spec.get("ceiling_color"), "ceiling")
    items = {it["id"]: it for it in spec.get("items", [])}
    look["items"] = {k: finish(v, items[k].get("primary_color")) for k, v in med.items() if k in items}

    # The light: color temperature from the white reference, hard sun from the contrast, and the spec's own words
    temp = int(np.median([t for t in temps if t])) if any(temps) else None
    contrast = float(np.median(contrasts)) if contrasts else 0
    text = (spec.get("lighting") or "").lower()
    if any(w in text for w in ("night", "dusk", "evening", "dark outside")):
        kind = "dusk"
    elif any(w in text for w in ("sunset", "golden", "low sun", "warm afternoon")) or (temp and temp < 4200):
        kind = "golden"
    elif any(w in text for w in ("overcast", "cloudy", "diffuse", "soft daylight", "grey day", "gray day")):
        kind = "overcast"
    elif any(w in text for w in ("direct sun", "sunny", "sunlight", "sun streaming", "bright sun")) or contrast > 60:
        kind = "clear"
    elif contrast < 12:
        kind = "overcast"
    else:
        kind = "partly"
    lamps_on = any(w in text for w in ("lamp on", "lamps on", "lamp is on", "lamps are on", "lit lamp", "lights on", "warm lamp"))
    lamps_off = any(w in text for w in ("lamps off", "lamp off", "no lamps", "lights off", "unlit"))
    look["light"] = {"kind": kind, "kelvin_estimate": temp, "lamps_on": kind == "dusk" or (lamps_on and not lamps_off)}
    look["stats"] = {
        "photos": len(by_number), "patches": {k: len(v) for k, v in samples.items()},
        "used_regions": bool(regions), "contrast_p95_p5": round(contrast, 1),
        "clipped": round(float(np.median(clipped)) if clipped else 0, 3), "brightness_anchor": anchor and round(float(anchor), 3),
    }
    look["cameras"] = photo_cameras(by_number)
    # How bright the photos are overall (log-average of linear luminance, without the brightest 5%): the renders
    # use it as their exposure key, so a dim, moody room isn't rendered bright and airy
    if keys:
        look["key"] = round(float(np.median(keys)), 4)
    json.dump(look, open(OUT, "w"), indent=2)
    print("HB:look", json.dumps({k: look.get(k) for k in ("walls", "floor", "ceiling", "light")}), flush=True)


main()
