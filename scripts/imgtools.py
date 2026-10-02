#!/usr/bin/env python3
"""Image helpers for reference-agent (requires Pillow).

  compress <src> <dest_base> [max_width=1440] [quality=80] [max_part_height=16000]
      -> JSON list of written JPEG paths (split into parts if the page is very tall)
  sheet <out.jpg> <cell_width> <img1> [img2 ...]
      -> contact sheet (grid) JPEG; prints out path
  frames <outdir> <sheet.jpg> <img1> [img2 ...]
      -> converts viewport frames to JPEG (max width 1440) in outdir + contact sheet; prints JSON list
  stitch <dest_base> <viewport_css_width> <y1,y2,...> <frame1> [frame2 ...]
      -> stitch viewport frames at their scroll offsets into one page (width 1440, split >16000px); prints JSON list
  repeatcheck <img> <block_px>
      -> prints 1 if the image is mostly the first block repeated (broken full-page stitch), else 0
"""
import json
import math
import sys

from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def to_rgb(im):
    if im.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def compress(src, dest_base, max_w=1440, quality=80, part_h=16000):
    im = to_rgb(Image.open(src))
    w, h = im.size
    if w > max_w:
        nh = round(h * max_w / w)
        im = im.resize((max_w, nh), Image.LANCZOS)
        w, h = im.size
    outs = []
    if h <= part_h:
        p = f"{dest_base}.jpg"
        im.save(p, "JPEG", quality=quality, optimize=True, progressive=True)
        outs.append(p)
    else:
        n = math.ceil(h / part_h)
        for i in range(n):
            part = im.crop((0, i * part_h, w, min(h, (i + 1) * part_h)))
            p = f"{dest_base}-{i + 1}.jpg"
            part.save(p, "JPEG", quality=quality, optimize=True, progressive=True)
            outs.append(p)
    print(json.dumps(outs))


def sheet(out, cell_w, paths):
    ims = []
    for p in paths:
        try:
            ims.append(to_rgb(Image.open(p)))
        except Exception:
            pass
    if not ims:
        sys.exit("no images")
    thumbs = [im.resize((cell_w, round(im.size[1] * cell_w / im.size[0])), Image.LANCZOS) for im in ims]
    cols = min(len(thumbs), 5)
    rows = math.ceil(len(thumbs) / cols)
    gap = 12
    cell_h = max(t.size[1] for t in thumbs)
    W = cols * cell_w + (cols + 1) * gap
    H = rows * cell_h + (rows + 1) * gap
    canvas = Image.new("RGB", (W, H), (235, 235, 238))
    for i, t in enumerate(thumbs):
        r, c = divmod(i, cols)
        canvas.paste(t, (gap + c * (cell_w + gap), gap + r * (cell_h + gap)))
    canvas.save(out, "JPEG", quality=78, optimize=True)
    print(out)


def frames(outdir, sheet_path, paths):
    import os

    os.makedirs(outdir, exist_ok=True)
    outs = []
    for i, p in enumerate(paths):
        im = to_rgb(Image.open(p))
        w, h = im.size
        if w > 1440:
            im = im.resize((1440, round(h * 1440 / w)), Image.LANCZOS)
        o = os.path.join(outdir, f"{i + 1:02d}.jpg")
        im.save(o, "JPEG", quality=80, optimize=True)
        outs.append(o)
    if outs:
        with open(os.devnull, "w") as devnull:
            stdout, sys.stdout = sys.stdout, devnull
            try:
                sheet(sheet_path, 360, outs)
            finally:
                sys.stdout = stdout
    print(json.dumps(outs))


def stitch(dest_base, vw, ys, paths, max_w=1440, part_h=16000, quality=80):
    frames = [to_rgb(Image.open(p)) for p in paths]
    fw, fh = frames[0].size
    dpr = fw / vw
    s = min(1.0, max_w / fw)
    out_w = round(fw * s)
    total_h = round((ys[-1] * dpr + fh) * s)
    canvas = Image.new("RGB", (out_w, total_h), (255, 255, 255))
    for y, im in zip(ys, frames):
        if s != 1.0:
            im = im.resize((out_w, round(im.size[1] * s)), Image.LANCZOS)
        canvas.paste(im, (0, round(y * dpr * s)))
    outs = []
    if total_h <= part_h:
        p = f"{dest_base}.jpg"
        canvas.save(p, "JPEG", quality=quality, optimize=True, progressive=True)
        outs.append(p)
    else:
        for i in range(math.ceil(total_h / part_h)):
            p = f"{dest_base}-{i + 1}.jpg"
            canvas.crop((0, i * part_h, out_w, min(total_h, (i + 1) * part_h))).save(
                p, "JPEG", quality=quality, optimize=True, progressive=True
            )
            outs.append(p)
    print(json.dumps(outs))


def preview(src, dest, max_side=1280, quality=70):
    """Downscale to max_side and save as JPEG (cross-platform replacement for macOS sips)."""
    im = to_rgb(Image.open(src))
    im.thumbnail((max_side, max_side))
    im.save(dest, "JPEG", quality=quality, optimize=True)
    print(dest)


def repeatcheck(path, block):
    im = Image.open(path).convert("L")
    w, h = im.size
    n = h // block
    if n < 3:
        print(0)
        return
    size = (64, 40)
    first = list(im.crop((0, 0, w, block)).resize(size).tobytes())
    same = 0
    for i in range(1, n):
        b = list(im.crop((0, i * block, w, (i + 1) * block)).resize(size).tobytes())
        diff = sum(abs(x - y) for x, y in zip(first, b)) / len(first)
        if diff < 6:
            same += 1
    print(1 if same / (n - 1) >= 0.5 else 0)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "compress":
        a = sys.argv[2:]
        compress(a[0], a[1], *(int(x) for x in a[2:5]))
    elif cmd == "sheet":
        sheet(sys.argv[2], int(sys.argv[3]), sys.argv[4:])
    elif cmd == "frames":
        frames(sys.argv[2], sys.argv[3], sys.argv[4:])
    elif cmd == "stitch":
        stitch(sys.argv[2], int(sys.argv[3]), [int(float(y)) for y in sys.argv[4].split(",")], sys.argv[5:])
    elif cmd == "preview":
        preview(sys.argv[2], sys.argv[3])
    elif cmd == "repeatcheck":
        repeatcheck(sys.argv[2], int(sys.argv[3]))
    else:
        sys.exit("unknown command")
