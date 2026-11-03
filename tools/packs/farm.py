"""
Farm animals for the farmland world, from four Aseprite files (one still sheet each): sheep, pig,
cow, and chicken / duck / rabbit. Sprites are found as separate shapes on each sheet and copied 1:1
(never scaled) in their own colors, facing left. The sheets hold one pose per animal (the rest are
color swaps and mirrors), so farm_anim.py makes the idle / walk / attack / hurt frames from it; the
rabbit also borrows the sheet's crouching white rabbit, recolored gray.

  python3 -I tools/packs/farm.py <sheep.aseprite> <pig.aseprite> <cow.aseprite> <chicken, duck and rabbit.aseprite> <out.ts>
  python3 -I tools/packs/farm.py --list <same four files> <out dir>      # labeled crops, to choose sprites
  python3 -I tools/packs/farm.py --preview <same four files> <out dir>   # every animation as a PNG strip
"""
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aseprite import read, render  # noqa: E402
from farm_anim import build  # noqa: E402

KEYS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&()*+,-/:;<=>?@[]^_{|}~'


def shapes(img):
    """Opaque 8-connected shapes as (x0, y0, x1, y1), top to bottom, then left to right."""
    W, H = img.size
    px = img.load()
    seen = set()
    out = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] < 128 or (x, y) in seen:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            x0 = x1 = x
            y0 = y1 = y
            while stack:
                cx, cy = stack.pop()
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and px[nx, ny][3] >= 128:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
            if (x1 - x0) * (y1 - y0) >= 12:
                out.append((x0, y0, x1 + 1, y1 + 1))
    # rows of sprites: sort by the row band, then x
    out.sort(key=lambda b: (round(b[1] / 12), b[0]))
    return out


# (export name, sheet index, shape index, mirror?) -- chosen from the --list crops; all face left.
PICKS = [
    ('HEN', 3, 5, False),    # brown hen
    ('DUCK', 3, 2, False),   # mallard
    ('BUNNY', 3, 8, False),  # gray rabbit
    ('RAM', 0, 4, False),    # black ram with horns
    ('PIG', 1, 0, False),    # pig, side view
    ('COW', 2, 1, False),    # spotted cow (the boss)
]

# Extra poses from the sheets: (export name, pose name, sheet, shape, same-pose shape in the sheet's
# other colors). The pose is recolored to the picked sprite's colors through that same-pose twin.
EXTRA = [
    ('BUNNY', 'crouch', 3, 6, 7),  # the white rabbit crouching (shape 7 is the white rabbit standing)
]


def opaque(crop):
    w, h = crop.size
    px = crop.load()
    return {(x, y): px[x, y][:3] for y in range(h) for x in range(w) if px[x, y][3] >= 128}


def recolor_map(twin, picked):
    """Each color of `twin` to the color most often at the same pixel of `picked` (same pose, other colors)."""
    votes = defaultdict(Counter)
    a, b = opaque(twin), opaque(picked)
    for p, c in a.items():
        if p in b:
            votes[c][b[p]] += 1
    return {c: v.most_common(1)[0][0] for c, v in votes.items()}


def indexed(px, w, h, index):
    return [''.join(index[px[(x, y)]] if (x, y) in px else '.' for x in range(w)) for y in range(h)]


def animal(name, crop, extras):
    """The animal's frames (cropped to one shared box), anchor, palette and animations."""
    w, h = crop.size
    px = opaque(crop)
    counts = Counter(px.values())
    lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    pal = sorted(counts, key=lum)
    index = {c: KEYS[i] for i, c in enumerate(pal)}
    rows = indexed(px, w, h, index)
    more = {}
    for pose, (img, cmap) in extras.items():
        epx = opaque(img)
        # A color the twin lacks takes the nearest one it has; the pose stands on the same ground row.
        near = lambda c: min(cmap, key=lambda k: sum((k[i] - c[i]) ** 2 for i in range(3)))
        epx = {p: cmap[c] if c in cmap else cmap[near(c)] for p, c in epx.items()}
        ew, eh = img.size
        more[pose] = indexed(epx, ew, eh, index)
    poses, anims = build(name, rows, more)
    used = ['stand'] + [p for a in anims.values() for p in a[2] if p != 'stand']
    order = list(dict.fromkeys(used))
    frames, frame_of = [], {}
    for n in order:
        sig = tuple(sorted(poses[n].px.items()))
        if sig not in frame_of:
            frame_of[sig] = len(frames)
            frames.append(poses[n])
        frame_of[n] = frame_of[sig]
    allpx = [p for f in frames for p in f.px]
    x0, x1 = min(p[0] for p in allpx), max(p[0] for p in allpx)
    y0, y1 = min(p[1] for p in allpx), max(p[1] for p in allpx)
    assert y1 == h - 1, f'{name}: a frame reaches below the feet'
    # Feet: the middle of the drawn pose's bottom row.
    bottom = [x for (x, y) in px if y == h - 1]
    ax = (min(bottom) + max(bottom)) // 2
    out_rows = [[''.join(f.px.get((x, y), '.') for x in range(x0, x1 + 1)) for y in range(y0, y1 + 1)] for f in frames]
    out_anims = {a: (fps, loop, [frame_of[p] for p in seq]) for a, (fps, loop, seq) in anims.items()}
    return {
        'w': x1 - x0 + 1, 'h': y1 - y0 + 1, 'anchor': (ax - x0, h - 1 - y0), 'pal': pal, 'frames': out_rows,
        'anims': out_anims, 'poses': {n: frame_of[n] for n in order},
    }


def sheet_ts(name, a):
    out = [f'export const {name}: AnimSheet = {{', f"  w: {a['w']},", f"  h: {a['h']},",
           f"  anchor: {{ x: {a['anchor'][0]}, y: {a['anchor'][1]} }},", "  faces: 'left',"]
    out.append('  pal: [' + ', '.join(f"'#{c[0]:02x}{c[1]:02x}{c[2]:02x}'" for c in a['pal']) + '],')
    out.append('  frames: [')
    for rows in a['frames']:
        out.append('    [')
        out += [f"      '{r}'," for r in rows]
        out.append('    ],')
    out.append('  ],')
    out.append('  anims: {')
    for anim, (fps, loop, frames) in a['anims'].items():
        out.append(f"    {anim}: {{ fps: {fps}, loop: {'true' if loop else 'false'}, frames: [{', '.join(map(str, frames))}] }},")
    out.append('  },')
    out.append('};')
    return '\n'.join(out)


def preview(name, a, out, scale=12):
    """One PNG per animal: a row per animation, its distinct frames in order, feet on a ground line."""
    from PIL import Image, ImageDraw
    w, h, (ax, ay) = a['w'], a['h'], a['anchor']
    fw, fh = w * scale + 8, h * scale + 22
    pal = a['pal']
    names = {i: n for n, i in reversed(list(a['poses'].items()))}
    rows = [(anim, list(dict.fromkeys(seq)), fps, seq) for anim, (fps, _, seq) in a['anims'].items()]
    cols = max(len(r[1]) for r in rows)
    page = Image.new('RGB', (max(cols * fw + 8, 520), len(rows) * (fh + 30) + 4), (64, 84, 64))
    d = ImageDraw.Draw(page)
    for r, (anim, uniq, fps, seq) in enumerate(rows):
        top = r * (fh + 30) + 4
        d.text((6, top), f'{name} {anim} {fps}fps: {seq}', fill=(255, 255, 255))
        for c, f in enumerate(uniq):
            ox, oy = 8 + c * fw, top + 26
            d.rectangle([ox, oy, ox + w * scale - 1, oy + h * scale - 1], fill=(92, 120, 92))
            d.line([ox, oy + (ay + 1) * scale, ox + w * scale, oy + (ay + 1) * scale], fill=(40, 40, 30))
            d.line([ox + ax * scale + scale // 2, oy + (ay + 1) * scale, ox + ax * scale + scale // 2, oy + (ay + 1) * scale + 3], fill=(250, 220, 90))
            for y, row in enumerate(a['frames'][f]):
                for x, ch in enumerate(row):
                    if ch != '.':
                        c3 = pal[KEYS.index(ch)]
                        d.rectangle([ox + x * scale, oy + y * scale, ox + x * scale + scale - 1, oy + y * scale + scale - 1], fill=c3)
            d.text((ox + 2, oy + h * scale + 6), f'{f}:{names.get(f, "")}', fill=(255, 255, 160))
    page.save(f'{out}/{name.lower()}.png')


def main():
    args = sys.argv[1:]
    mode = args[0] if args[0] in ('--list', '--preview') else None
    if mode:
        args = args[1:]
    files, out = args[:4], args[4]
    sheets = [render(read(f), 0) for f in files]
    if mode == '--list':
        from PIL import Image, ImageDraw
        os.makedirs(out, exist_ok=True)
        for si, img in enumerate(sheets):
            for k, b in enumerate(shapes(img)):
                c = img.crop(b)
                big = c.resize((c.width * 8, c.height * 8), Image.NEAREST)
                page = Image.new('RGBA', (big.width + 20, big.height + 30), (70, 90, 70, 255))
                page.alpha_composite(big, (10, 25))
                ImageDraw.Draw(page).text((4, 4), f'sheet {si} shape {k} {c.width}x{c.height}', fill=(255, 255, 255, 255))
                page.save(f'{out}/s{si}_{k}.png')
        return
    parts = ['/**', ' * Farm animals (generated by tools/packs/farm.py and farm_anim.py from the four Aseprite sheets; do not edit).',
             ' * Their own colors, facing left, feet on the bottom row; the moves are made from the one drawn pose.', ' */',
             "import type { AnimSheet } from '../indexed';", '']
    if mode == '--preview':
        os.makedirs(out, exist_ok=True)
    for name, si, k, mirror in PICKS:
        crop = sheets[si].crop(shapes(sheets[si])[k])
        extras = {}
        for ename, pose, esi, ek, twin in EXTRA:
            if ename == name:
                cmap = recolor_map(sheets[esi].crop(shapes(sheets[esi])[twin]), crop)
                extras[pose] = (sheets[esi].crop(shapes(sheets[esi])[ek]), cmap)
        if mirror:
            from PIL import ImageOps
            crop = ImageOps.mirror(crop)
        a = animal(name, crop, extras)
        if mode == '--preview':
            preview(name, a, out)
            continue
        parts.append(sheet_ts(name, a))
        parts.append('')
    if mode == '--preview':
        print(f'previews in {out}')
        return
    open(out, 'w').write('\n'.join(parts))
    print(f'wrote {out}')


if __name__ == '__main__':
    main()
