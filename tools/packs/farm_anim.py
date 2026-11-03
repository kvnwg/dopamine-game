"""
Moves for the farm animals (used by farm.py). Each animal is drawn once in its pack, standing and
facing left; its other frames are made here from that pose the way a pixel artist would: a whole
part (head, legs, tail, ears) moved by an art pixel or two, the body squashed or stretched by one row
at a seam, an eye closed for a blink. Frames only reuse the sprite's own colors, and every gap a
move opens in the outline is closed with the outline color, so the art stays clean.

Coordinates are pixels of the drawn pose (x right, y down, '0' is the outline: the darkest color of
every animal); a frame may reach outside it (a peck past the beak), and farm.py crops all of an
animal's frames to one shared box with the feet on its bottom row.
"""
from collections import Counter

LINE = '0'
FAR = 999


class Pose:
    """One frame as {(x, y): palette key}; '.' (transparent) pixels are simply absent."""

    def __init__(self, px, ground):
        self.px = dict(px)
        self.ground = ground  # the feet row: nothing is drawn below it

    @staticmethod
    def of(rows):
        return Pose({(x, y): c for y, r in enumerate(rows) for x, c in enumerate(r) if c != '.'}, len(rows) - 1)

    def copy(self):
        return Pose(self.px, self.ground)

    def box(self, x0, y0, x1, y1):
        """The drawn pixels inside a box (inclusive)."""
        return {p for p in self.px if x0 <= p[0] <= x1 and y0 <= p[1] <= y1}

    def move(self, *parts):
        """Moves parts (pixel sets, each with its dx, dy) together; later parts are drawn over earlier ones."""
        lifted = []
        for sel, dx, dy in parts:
            lifted.append({(x + dx, y + dy): self.px[(x, y)] for (x, y) in sel if (x, y) in self.px})
        gone = set()
        for sel, _, _ in parts:
            for p in sel:
                if self.px.pop(p, None) is not None:
                    gone.add(p)
        for part in lifted:
            self.px.update(part)
        return self.close(gone - self.px.keys())

    def squash(self, y, x0=-FAR, x1=FAR):
        """Drops row y (between columns x0..x1): everything above it comes down a pixel."""
        out = {}
        for (x, yy), c in self.px.items():
            if x0 <= x <= x1 and yy <= y:
                if yy == y:
                    continue
                yy += 1
            out[(x, yy)] = c
        self.px = out
        return self.close(set())

    def stretch(self, y, x0=-FAR, x1=FAR):
        """Doubles row y (between columns x0..x1): everything above it goes up a pixel."""
        out = {}
        for (x, yy), c in self.px.items():
            if x0 <= x <= x1 and yy <= y:
                out[(x, yy - 1)] = c
                if yy == y:
                    out[(x, yy)] = c
            else:
                out[(x, yy)] = c
        self.px = out
        return self.close(set())

    def widen(self, x, y0=-FAR, y1=FAR):
        """Doubles column x (between rows y0..y1): everything left of it goes a pixel further left."""
        out = {}
        for (xx, y), c in self.px.items():
            if y0 <= y <= y1 and xx <= x:
                out[(xx - 1, y)] = c
                if xx == x:
                    out[(xx, y)] = c
            else:
                out[(xx, y)] = c
        self.px = out
        return self.close(set())

    def narrow(self, x, y0=-FAR, y1=FAR):
        """Drops column x (between rows y0..y1): everything left of it comes a pixel to the right."""
        out = {}
        for (xx, y), c in self.px.items():
            if y0 <= y <= y1 and xx <= x:
                if xx == x:
                    continue
                xx += 1
            out[(xx, y)] = c
        self.px = out
        return self.close(set())

    def lean(self, *bands):
        """Shears the pose: each (y0, y1, dx) band of rows slides sideways while the feet stay planted."""
        return self.move(*[(self.box(-FAR, y0, FAR, y1), dx, 0) for y0, y1, dx in bands])

    def lift(self, dy):
        """The whole pose up (dy < 0) off the ground, e.g. mid-hop."""
        self.px = {(x, y + dy): c for (x, y), c in self.px.items()}
        return self

    def put(self, key, *points):
        """Repaints pixels with one of the sprite's own colors (a closed eye, a touch-up)."""
        for p in points:
            self.px[p] = key
        return self

    def erase(self, *points):
        for p in points:
            self.px.pop(p, None)
        return self.close(set(points))

    def close(self, holes):
        """
        Closes the outline: an empty pixel next to a colored (non-outline) one becomes outline, except
        a hole a move left inside the body, which takes the body color around it. The drawn poses are
        fully outlined, so this never changes them.
        """
        adds = {}
        cand = set()
        for (x, y), c in self.px.items():
            if c == LINE:
                continue
            for n in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if n not in self.px and n[1] <= self.ground:
                    cand.add(n)
        for (x, y) in cand:
            around = [self.px.get(n) for n in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))]
            if (x, y) in holes and all(around):
                fills = Counter(c for c in around if c != LINE)
                adds[(x, y)] = fills.most_common(1)[0][0]
            else:
                adds[(x, y)] = LINE
        self.px.update(adds)
        return self


def build(name, rows, extra=None):
    """The poses and animations of one animal: ({pose name: Pose}, {anim: (fps, loop, [pose names])})."""
    base = Pose.of(rows)
    assert base.copy().close(set()).px == base.px, f'{name}: the drawn pose is not fully outlined'
    return RECIPES[name](base, extra or {})


# ------------------------------------------------------------------ helpers

def poses(base, **made):
    out = {'stand': base}
    out.update(made)
    return out


def placed(rows, ground, dx=0):
    """A pose borrowed from the sheet, standing on the same ground row."""
    dy = ground - (len(rows) - 1)
    return Pose({(x + dx, y + dy): c for y, r in enumerate(rows) for x, c in enumerate(r) if c != '.'}, ground)


def colored(p, sel):
    return {q for q in sel if p.px[q] != LINE}


# ------------------------------------------------------------------ the animals
#
# Each recipe names its parts by box (pixels of the drawn pose) and builds poses from the stand.


def hen(base, extra):
    head = base.box(0, 0, 7, 6)            # comb, head and neck
    near = colored(base, base.box(7, 13, 8, 14))   # near leg: thigh and foot
    far = colored(base, base.box(5, 14, 5, 14))    # far leg
    eye = (5, 4)

    def legs_b(p):
        return p.move((far, 3, 0), (near, -2, 0))

    p = poses(
        base,
        low=base.copy().squash(8),
        blink=base.copy().put('5', eye),
        tail=base.copy().stretch(6, 8, 14),
        step_low=legs_b(base.copy()).squash(8),
        step=legs_b(base.copy()),
        wind=base.copy().stretch(6, 0, 7),
        peck=base.copy().move((head, -2, 0)),
        peckg=base.copy().move((base.box(0, 0, 7, 5), -2, 0), (base.box(0, 6, 7, 6), -1, 0)),
        peck2=base.copy().move((head, -1, 0)),
        hurt=base.copy().move((head, 1, 0)).squash(8).put('5', eye),
    )
    anims = {
        'idle': (4, True, ['stand', 'stand', 'low', 'low', 'stand', 'stand', 'low', 'low', 'blink', 'stand', 'low',
                           'low', 'stand', 'tail', 'low', 'low']),
        'walk': (8, True, ['low', 'stand', 'step_low', 'step']),
        'attack': (10, False, ['wind', 'peck', 'peckg', 'peck2']),
        'hurt': (8, False, ['hurt', 'low']),
    }
    return p, anims


def duck(base, extra):
    head = base.box(0, 0, 7, 5)            # green head and bill
    ring = base.box(0, 6, 7, 6)            # white neck ring
    far_foot = colored(base, base.box(4, 15, 5, 15))
    near_foot = colored(base, base.box(7, 15, 9, 15))
    eye = (5, 2)

    def legs_b(p):
        return p.move((far_foot, 4, 0), (near_foot, -3, 0))

    p = poses(
        base,
        low=base.copy().squash(10),
        blink=base.copy().put('2', eye),
        tail=base.copy().stretch(9, 12, 14),
        step_low=legs_b(base.copy()).squash(10),
        step=legs_b(base.copy()),
        wind=base.copy().stretch(6, 0, 7),
        bite=base.copy().move((head, -2, 0), (ring, -1, 0)),
        bite2=base.copy().move((head | ring, -1, 0)),
        hurt=base.copy().move((head | ring, 1, 0)).squash(10).put('2', eye),
    )
    anims = {
        'idle': (4, True, ['stand', 'stand', 'low', 'low', 'stand', 'stand', 'low', 'low', 'blink', 'stand', 'low',
                           'low', 'stand', 'tail', 'low', 'low']),
        'walk': (8, True, ['low', 'stand', 'step_low', 'step']),
        'attack': (10, False, ['wind', 'bite', 'bite2']),
        'hurt': (8, False, ['hurt', 'low']),
    }
    return p, anims


def bunny(base, extra):
    eye, nose = (4, 8), (2, 9)
    back_ear = base.box(5, 0, 7, 2)
    ears = base.box(1, 0, 7, 3)
    crouch = placed(extra['crouch'], base.ground)
    top = min(y for _, y in crouch.px)
    crouch.put('6', (2, top + 1), (6, top + 1))   # the gray rabbit's ear tips are white
    c_eye = (4, top + 6)
    p = poses(
        base,
        low=base.copy().squash(10),
        blink=base.copy().put('1', eye),
        blink2=base.copy().put('2', eye),
        blink3=base.copy().put('1', eye, (3, 8)),
        ear=base.copy().squash(2, 5, 7),
        sniff=base.copy().put('3', nose).put('4', (2, 8)),
        crouch=crouch,
        hop1=base.copy().lift(-2),
        hop2=base.copy().lift(-1),
        pounce=base.copy().lean((3, 11, -1)).lift(-1),
        hurt=crouch.copy().put('1', c_eye, (c_eye[0] - 1, c_eye[1])),
    )
    anims = {
        'idle': (4, True, ['stand', 'stand', 'low', 'low', 'stand', 'sniff', 'low', 'low', 'blink', 'stand', 'low',
                           'low', 'stand', 'ear', 'ear', 'low', 'low', 'blink2', 'blink3']),
        'walk': (8, True, ['crouch', 'hop1', 'hop2', 'stand']),
        'attack': (10, False, ['crouch', 'pounce', 'stand']),
        'hurt': (8, False, ['hurt', 'low']),
    }
    return p, anims


def ram(base, extra):
    eye = [(6, 5), (6, 6)]
    head = base.box(0, 0, 11, 9)
    fn, bn = base.box(11, 18, 13, 21), base.box(22, 18, 24, 21)   # near legs below the knee
    ff, bf = base.box(8, 18, 10, 19), base.box(19, 18, 21, 19)    # far legs below the knee
    p = poses(
        base,
        low=base.copy().squash(12),
        blink=base.copy().put('3', eye[0]).put('2', eye[1]),
        nod=base.copy().squash(11, 0, 10),
        step_a=base.copy().move((ff, 1, 0), (bf, -1, 0), (fn, -1, 0), (bn, 1, 0)).squash(12),
        step_b=base.copy().move((ff, -1, 0), (bf, 1, 0), (fn, 1, 0), (bn, -1, 0)).squash(12),
        wind=base.copy().stretch(11, 0, 10).lean((-1, 14, 1)),
        butt=base.copy().squash(11, 0, 10).widen(10, 0, 11).lean((0, 14, -1)),
        butt2=base.copy().lean((0, 14, -1)),
        hurt=base.copy().stretch(11, 0, 10).lean((-1, 14, 1)).put('3', (7, 4)).put('2', (7, 5)),
    )
    anims = {
        'idle': (4, True, ['stand', 'stand', 'low', 'low', 'stand', 'stand', 'low', 'low', 'blink', 'stand', 'low',
                           'low', 'stand', 'nod', 'nod', 'low']),
        'walk': (8, True, ['step_a', 'stand', 'step_b', 'stand']),
        'attack': (10, False, ['wind', 'butt', 'butt2']),
        'hurt': (8, False, ['hurt', 'low']),
    }
    return p, anims


def pig(base, extra):
    eye = (5, 7)
    tail = base.box(26, 0, 29, 3)
    fn, bn = base.box(9, 17, 11, 20), base.box(21, 17, 23, 20)
    ff, bf = base.box(6, 17, 7, 19), base.box(17, 17, 19, 19)
    p = poses(
        base,
        low=base.copy().squash(6),
        blink=base.copy().put('d', eye),
        wag=base.copy().move((tail, 0, 1)),
        step_a=base.copy().move((ff, 1, 0), (bf, -1, 0), (fn, -1, 0), (bn, 1, 0)).squash(6),
        step_b=base.copy().move((ff, -1, 0), (bf, 1, 0), (fn, 1, 0), (bn, -1, 0)).squash(6),
        wind=base.copy().lean((0, 14, 1)),
        charge=base.copy().squash(14, 0, 8).lean((0, 6, -2), (7, 14, -1)),
        charge2=base.copy().lean((0, 14, -1)),
        hurt=base.copy().lean((0, 14, 1)).put('d', (6, 7)),
    )
    anims = {
        'idle': (4, True, ['stand', 'stand', 'low', 'low', 'stand', 'wag', 'low', 'low', 'blink', 'stand', 'low',
                           'low', 'stand', 'stand', 'low', 'low']),
        'walk': (8, True, ['step_a', 'stand', 'step_b', 'stand']),
        'attack': (10, False, ['wind', 'charge', 'charge2']),
        'hurt': (8, False, ['hurt', 'low']),
    }
    return p, anims


def cow(base, extra):
    eyes_top, eyes = [(5, 6), (9, 6)], [(5, 7), (9, 7)]
    tail = base.box(28, 16, 30, 18)
    fn, bn = base.box(11, 19, 13, 24), base.box(23, 19, 26, 24)
    ff = base.box(9, 19, 10, 23)
    p = poses(
        base,
        low=base.copy().squash(14),
        blink=base.copy().put('g', *eyes_top),
        swish=base.copy().move((tail, 1, 0)),
        step_a=base.copy().move((ff, 1, 0), (fn, -1, 0), (bn, 1, 0)).squash(14),
        step_b=base.copy().move((ff, -1, 0), (fn, 1, 0), (bn, -1, 0)).squash(14),
        wind=base.copy().lean((0, 16, 1)),
        butt=base.copy().squash(15, 0, 12).lean((0, 16, -1)),
        butt2=base.copy().lean((0, 16, -1)),
        hurt=base.copy().lean((0, 16, 1)).put('g', (6, 6), (10, 6)),
    )
    anims = {
        'idle': (4, True, ['stand', 'stand', 'low', 'low', 'stand', 'swish', 'low', 'low', 'blink', 'stand', 'low',
                           'low', 'stand', 'stand', 'low', 'low']),
        'walk': (8, True, ['step_a', 'stand', 'step_b', 'stand']),
        'attack': (10, False, ['wind', 'butt', 'butt2']),
        'hurt': (8, False, ['hurt', 'low']),
    }
    return p, anims


RECIPES = {'HEN': hen, 'DUCK': duck, 'BUNNY': bunny, 'RAM': ram, 'PIG': pig, 'COW': cow}
