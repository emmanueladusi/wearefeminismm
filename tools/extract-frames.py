#!/usr/bin/env python3
"""Extract an animated GIF's frames into img/underwater/ for js/uwscrub.js.

    python3 tools/extract-frames.py img/underwater.gif

Three things worth knowing about the source (a 512x288, 128-colour GIF):

  * It's PALETTISED AND DITHERED. Blown up to a full-bleed backdrop the dither
    reads as crosshatch speckle — that, not the resolution, is most of what
    looks "low quality". A gentle blur + median pass dissolves it, and the
    resulting smooth frames also compress far better.
  * GIFs store deltas plus a disposal method, so a naive .seek() yields torn
    frames. We composite each frame onto a running canvas to coalesce them.
  * There is no "fps" here. uwscrub.js advances frames by SCROLL POSITION,
    so FRAMES controls scrub smoothness, not playback speed.

Upscaling past ~2.5x buys bytes, not detail. 1280w is the practical ceiling
for a 512w source.
"""
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

WIDTH = 768        # 1.5x the 512w source. Past this you store interpolated
                   # pixels: no real detail, but real bytes and decode time.
FRAMES = 0         # 0 = keep every frame. Playback is time-driven now, so the
                   # full 338 are needed to run at the GIF's native rate
                   # without looking choppy.
FORMAT = "WEBP"
QUALITY = 75
BLUR = 0.8         # dissolve the GIF's dither before upscaling
MEDIAN = 3

def coalesce(im):
    """Composite GIF deltas into whole frames."""
    canvas = Image.new("RGBA", im.size)
    for i in range(im.n_frames):
        im.seek(i)
        frame = im.convert("RGBA")
        if im.info.get("disposal") == 2:
            canvas = Image.new("RGBA", im.size)
        canvas = Image.alpha_composite(canvas, frame)
        yield i, canvas

def main():
    if len(sys.argv) < 2:
        sys.exit("usage: extract-frames.py <path-to.gif> [outdir]")
    src = sys.argv[1]
    outdir = sys.argv[2] if len(sys.argv) > 2 else "img/underwater"

    im = Image.open(src)
    total = getattr(im, "n_frames", 1)
    if total < 2:
        sys.exit(f"{src}: only {total} frame — not an animation")

    if FRAMES and FRAMES < total:
        keep = set(round(i * (total - 1) / (FRAMES - 1)) for i in range(FRAMES))
    else:
        keep = set(range(total))

    # ---- camera drift ------------------------------------------------
    # The artwork's camera pans downward mid-loop (~360 px at source scale).
    # Measure each step's vertical shift by best row alignment so the player
    # can CANCEL the pan: scroll owns the descent, not the artwork.
    def _gray(img, w=256):
        h = round(img.height * w / img.width)
        return np.asarray(img.convert("L").resize((w, h)), dtype=np.float32)

    def _vshift(a, b, rng=12):
        best, bestd = 0, 1e18
        for dy in range(-rng, rng + 1):
            if dy >= 0:
                d = np.mean((a[dy:, :] - b[: b.shape[0] - dy, :]) ** 2)
            else:
                d = np.mean((a[:dy, :] - b[-dy:, :]) ** 2)
            if d < bestd:
                bestd, best = d, dy
        return best

    # the GIF's own timing, so playback runs at the artwork's real speed
    delays = []
    for i in range(total):
        im.seek(i)
        delays.append(im.info.get("duration") or 0)
    im.seek(0)
    avg = sum(delays) / len(delays) if delays else 83
    fps = round(1000.0 / avg, 2) if avg else 12.0

    os.makedirs(outdir, exist_ok=True)
    for old in os.listdir(outdir):
        if old.endswith((".jpg", ".webp", ".json")):
            os.remove(os.path.join(outdir, old))

    w, h = im.size
    out_w = min(WIDTH, w * 3)  # never wildly upscale
    out_h = round(h * out_w / w)
    ext = FORMAT.lower()

    files = []
    drift_src = []          # cumulative camera offset, source pixels
    prev_g = None
    acc = 0.0
    gscale = None
    n = 0
    for i, canvas in coalesce(im):
        g = _gray(canvas)
        if gscale is None:
            gscale = im.size[1] / g.shape[0]
        if prev_g is not None:
            acc += _vshift(prev_g, g) * gscale
        prev_g = g
        if i not in keep:
            continue
        drift_src.append(acc)
        rgb = Image.new("RGB", canvas.size, (0, 0, 0))
        rgb.paste(canvas, mask=canvas.split()[3])
        # de-dither at source resolution, THEN upscale — order matters
        rgb = rgb.filter(ImageFilter.GaussianBlur(BLUR)).filter(ImageFilter.MedianFilter(MEDIAN))
        rgb = rgb.resize((out_w, out_h), Image.LANCZOS)
        name = f"frame-{n:03d}.{ext}"
        rgb.save(os.path.join(outdir, name), FORMAT, quality=QUALITY, method=6)
        files.append(name)
        n += 1

    # frame filenames are stable across re-extracts, so a browser would happily
    # serve yesterday's pixels. Stamp a rev derived from the encode settings and
    # let uwscrub.js hang it off every frame URL.
    rev = hashlib.md5(
        f"{out_w}x{out_h}:{len(files)}:{QUALITY}:{os.path.basename(src)}".encode()
    ).hexdigest()[:8]
    # drift in OUTPUT pixels, zero-based
    k = out_w / im.size[0]
    d0 = min(drift_src)
    drift = [round((d - d0) * k, 1) for d in drift_src]
    manifest = {
        "files": files, "width": out_w, "height": out_h,
        "source": os.path.basename(src), "rev": rev, "fps": fps,
        "drift": drift,
    }
    with open(os.path.join(outdir, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)

    kb = sum(os.path.getsize(os.path.join(outdir, f)) for f in files) / 1024
    print(f"{src}: {total} frames -> {len(files)} kept @ {out_w}x{out_h} {ext}")
    print(f"total {kb/1024:.1f} MB ({kb/len(files):.0f} KB/frame)  rev={rev}  fps={fps}")
    print(f"camera drift: 0 -> {max(drift):.0f} px (output scale)")

if __name__ == "__main__":
    main()
