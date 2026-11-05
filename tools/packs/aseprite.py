"""
Minimal Aseprite (.aseprite) reader: each frame composited from its visible layers, plus the tags.
Pack files are data: only parsed, never run. Supports RGBA, grayscale and indexed sprites with raw,
compressed and linked cels (enough for the packs used here).

  python3 -I tools/packs/aseprite.py <file.aseprite> <out dir>   # writes f00.png... and strip.png
"""
import struct, sys, zlib, os
from PIL import Image

def read(path):
    data = open(path, 'rb').read()
    if len(data) < 128: raise SystemExit('too small')
    size, magic, nframes, W, H, depth, flags, speed = struct.unpack_from('<IHHHHHIH', data, 0)
    if magic != 0xA5E0: raise SystemExit(f'bad magic {magic:#x}')
    transparent_index = data[28]
    pos = 128
    layers, frames, tags, palette = [], [], [], {}
    for fi in range(nframes):
        fsize, fmagic, old_chunks, duration = struct.unpack_from('<IHHH', data, pos)
        if fmagic != 0xF1FA: raise SystemExit('bad frame magic')
        new_chunks = struct.unpack_from('<I', data, pos + 12)[0]
        n = new_chunks or old_chunks
        p = pos + 16
        cels = []
        for _ in range(n):
            csize, ctype = struct.unpack_from('<IH', data, p)
            body = data[p + 6:p + csize]
            if ctype == 0x2004:  # layer
                lflags, ltype, child, _w, _h, blend, opacity = struct.unpack_from('<HHHHHHB', body, 0)
                nlen = struct.unpack_from('<H', body, 16)[0]
                name = body[18:18 + nlen].decode('utf8', 'replace')
                layers.append({'name': name, 'visible': bool(lflags & 1), 'type': ltype, 'opacity': opacity})
            elif ctype == 0x2005:  # cel
                li, x, y, op, ct = struct.unpack_from('<HhhBH', body, 0)
                rest = body[16:]
                if ct in (0, 2):
                    w, h = struct.unpack_from('<HH', rest, 0)
                    px = rest[4:]
                    if ct == 2: px = zlib.decompress(px)
                    cels.append({'layer': li, 'x': x, 'y': y, 'w': w, 'h': h, 'px': px, 'op': op})
                elif ct == 1:
                    link = struct.unpack_from('<H', rest, 0)[0]
                    cels.append({'layer': li, 'link': link})
            elif ctype == 0x2019:  # palette
                psize, first, last = struct.unpack_from('<III', body, 0)
                q = 20
                for i in range(first, last + 1):
                    eflags, r, g, b, a = struct.unpack_from('<HBBBB', body, q)
                    q += 6
                    if eflags & 1:
                        nl = struct.unpack_from('<H', body, q)[0]; q += 2 + nl
                    palette[i] = (r, g, b, a)
            elif ctype == 0x2018:  # tags
                ntags = struct.unpack_from('<H', body, 0)[0]
                q = 10
                for _ in range(ntags):
                    a, b, direction = struct.unpack_from('<HHB', body, q)
                    q += 17
                    nl = struct.unpack_from('<H', body, q)[0]
                    name = body[q + 2:q + 2 + nl].decode('utf8', 'replace')
                    q += 2 + nl
                    tags.append((name, a, b, direction))
            p += csize
        frames.append({'duration': duration, 'cels': cels})
        pos += fsize
    return {'W': W, 'H': H, 'depth': depth, 'frames': frames, 'layers': layers, 'tags': tags, 'palette': palette, 'ti': transparent_index}

def render(doc, fi):
    W, H, depth = doc['W'], doc['H'], doc['depth']
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cels = {c['layer']: c for c in doc['frames'][fi]['cels']}
    for li, layer in enumerate(doc['layers']):
        if not layer['visible'] or layer['type'] != 0 or li not in cels: continue
        c = cels[li]
        if 'link' in c:
            c = next((x for x in doc['frames'][c['link']]['cels'] if x['layer'] == li), None)
            if not c or 'px' not in c: continue
        w, h, px = c['w'], c['h'], c['px']
        bpp = {32: 4, 16: 2, 8: 1}[depth]
        if len(px) < w * h * bpp: continue
        tile = Image.new('RGBA', (w, h))
        tp = tile.load()
        for yy in range(h):
            for xx in range(w):
                i = (yy * w + xx) * bpp
                if depth == 32: col = tuple(px[i:i + 4])
                elif depth == 16: col = (px[i], px[i], px[i], px[i + 1])
                else:
                    idx = px[i]
                    col = (0, 0, 0, 0) if idx == doc['ti'] else doc['palette'].get(idx, (0, 0, 0, 0))
                tp[xx, yy] = col
        img.alpha_composite(tile, (c['x'], c['y'])) if c['x'] >= 0 and c['y'] >= 0 else img.paste(tile, (c['x'], c['y']), tile)
    return img

if __name__ == '__main__':
    doc = read(sys.argv[1])
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    n = len(doc['frames'])
    print('size', doc['W'], doc['H'], 'depth', doc['depth'], 'frames', n, 'layers', [(l['name'], l['visible']) for l in doc['layers']])
    print('tags', doc['tags'])
    print('durations', [f['duration'] for f in doc['frames']])
    strip = Image.new('RGBA', (doc['W'] * n, doc['H']))
    for i in range(n):
        im = render(doc, i)
        im.save(f'{out}/f{i:02d}.png')
        strip.alpha_composite(im, (i * doc['W'], 0))
    strip.save(f'{out}/strip.png')
