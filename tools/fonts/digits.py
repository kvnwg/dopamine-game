"""
Builds "Dumpster Digits": a tiny font with only a clearer 2 and 5 for Pixelify Sans, so UI numbers
stop reading as Z and S (Pixelify Sans draws 2 like Z and 5 like S). The glyphs are drawn on
Pixelify Sans's own grid: 5 columns by 7 rows whose edges are the strokes of its 3 (bars and columns
keep their exact thickness at each weight). The 5 gets a flat top bar with square corners over a
round bowl; the 2 gets a round top, a stepped diagonal and a flat base. CSS lists this font first
and Pixelify Sans second, so every other character still comes from Pixelify Sans.

  python3 -I tools/fonts/digits.py <out dir>

Needs fontTools. License: SIL Open Font License 1.1, like Pixelify Sans (see CREDITS.md).
"""
import sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

# Pixelify Sans's grid per weight (from its "3"): column edges left to right, row edges bottom to top.
GRIDS = {
    500: {'x': [60, 150, 247, 343, 440, 531], 'y': [-12, 77, 166, 255, 366, 455, 544, 633], 'adv': 592},
    700: {'x': [61, 188, 263, 339, 414, 542], 'y': [-11, 125, 186, 246, 381, 441, 501, 638], 'adv': 603},
}
# Pixelify Sans's vertical metrics (same at both weights).
ASCENT, DESCENT, LINE_GAP, WIN_ASCENT, WIN_DESCENT = 920, -280, 0, 920, 280

GLYPHS = {
    'five': [
        '#####',
        '#....',
        '#....',
        '####.',
        '....#',
        '#...#',
        '.###.',
    ],
    'two': [
        '.###.',
        '#...#',
        '....#',
        '...#.',
        '..#..',
        '.#...',
        '#####',
    ],
}
# Bold diagonal steps are doubled sideways so they keep the stroke weight.
BOLD_TWO = [
    '.###.',
    '#...#',
    '....#',
    '..##.',
    '.##..',
    '##...',
    '#####',
]


def glyph(rows, grid):
    xs, ys = grid['x'], grid['y']
    pen = TTGlyphPen(None)
    for r, row in enumerate(rows):
        y0, y1 = ys[6 - r], ys[7 - r]
        c = 0
        while c < 5:
            if row[c] == '#':
                c2 = c
                while c2 < 5 and row[c2] == '#':
                    c2 += 1
                x0, x1 = xs[c], xs[c2]
                pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
                c = c2
            else:
                c += 1
    return pen.glyph()


def build(weight, out_path):
    g = GRIDS[weight]
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(['.notdef', 'two', 'five'])
    fb.setupCharacterMap({0x32: 'two', 0x35: 'five'})
    two = BOLD_TWO if weight >= 600 else GLYPHS['two']
    fb.setupGlyf({'.notdef': TTGlyphPen(None).glyph(), 'two': glyph(two, g), 'five': glyph(GLYPHS['five'], g)})
    fb.setupHorizontalMetrics({'.notdef': (g['adv'], 0), 'two': (g['adv'], g['x'][0]), 'five': (g['adv'], g['x'][0])})
    fb.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT)
    fb.setupOS2(sTypoAscender=ASCENT, sTypoDescender=DESCENT, sTypoLineGap=LINE_GAP,
                usWinAscent=WIN_ASCENT, usWinDescent=WIN_DESCENT, usWeightClass=weight)
    fb.setupNameTable({'familyName': 'Dumpster Digits', 'styleName': 'Bold' if weight >= 600 else 'Regular',
                       'copyright': 'Glyphs drawn on the grid of Pixelify Sans (SIL Open Font License 1.1)'})
    fb.setupPost()
    fb.font.flavor = 'woff'
    fb.save(out_path)


if __name__ == '__main__':
    out = sys.argv[1]
    for w in GRIDS:
        build(w, f'{out}/dumpster-digits-{w}.woff')
        print(f'{out}/dumpster-digits-{w}.woff')
