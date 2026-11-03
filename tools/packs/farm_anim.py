"""
Moves for the farm animals (used by farm.py). Each animal is drawn once in its pack, standing and
facing left; its other frames are made here from that pose the way a pixel artist would: a whole
part (head, legs, tail, ears) moved by an art pixel or two, the body squashed or stretched by one row
at a seam, an eye closed for a blink. Frames only reuse the sprite's own colors, and every gap a
move opens in the outline is closed with the outline color, so the art stays clean (build() checks
that no frame gains a color, a stray pixel or a loose piece).

Coordinates are pixels of the drawn pose (x right, y down; '0' is the outline, the darkest color of
every animal). A frame may reach outside the drawn box (a peck past the beak, a hop above the
head); farm.py crops all of an animal's frames to one shared box with the feet on its bottom row.
"""
from collections import Counter

LINE = '0'
FAR = 999
SIDES = ((-1, 0), (1, 0), (0, -1), (0, 1))


class Pose:
    """One frame as {(x, y): palette key}; transparent pixels are simply absent."""

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

    def colored(self, sel):
        """The pixels of a selection that are not outline."""
        return {p for p in sel if self.px.get(p, LINE) != LINE}

    def move(self, *parts):
        """Moves parts (pixel sets, each with its dx, dy) together; later parts are drawn over earlier ones."""
        lifted = [{(x + dx, y + dy): self.px[(x, y)] for (x, y) in sel if (x, y) in self.px} for sel, dx, dy in parts]
        gone = set()
        for sel, _, _ in parts:
            for p in sel:
                if self.px.pop(p, None) is not None:
                    gone.add(p)
        placed = set()
        for part in lifted:
            self.px.update(part)
            placed |= part.keys()
        # Outline beside a moved part that borders nothing colored any more (between two legs) goes with it.
        for p in {(x + dx, y) for (x, y) in gone for dx in (-1, 1)} - placed:
            if self.px.get(p) == LINE and not self.touches_color(p):
                del self.px[p]
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

    def lean(self, *bands):
        """Shears the pose: each (y0, y1, dx) band of rows slides sideways while the feet stay planted."""
        return self.move(*[(self.box(-FAR, y0, FAR, y1), dx, 0) for y0, y1, dx in bands])

    def lift(self, dy):
        """The whole pose up (dy < 0) off the ground, mid-hop."""
        self.px = {(x, y + dy): c for (x, y), c in self.px.items()}
        return self

    def put(self, key, *points):
        """Repaints pixels with one of the sprite's own colors (a closed eye, a white ear tip)."""
        for p in points:
            self.px[p] = key
        return self

    def touches_color(self, p):
        x, y = p
        return any(self.px.get((x + dx, y + dy), LINE) != LINE for dx, dy in SIDES)

    def close(self, holes):
        """
        Closes the outline: an empty pixel next to a colored (non-outline) one becomes outline, except
        a hole a move left inside the body, which takes the body color around it. The drawn poses are
        fully outlined, so this never changes them.
        """
        adds = {}
        for (x, y), c in self.px.items():
            if c == LINE:
                continue
            for dx, dy in SIDES:
                n = (x + dx, y + dy)
                if n in self.px or n in adds or n[1] > self.ground:
                    continue
                around = [self.px.get((n[0] + ex, n[1] + ey)) for ex, ey in SIDES]
                if n in holes and all(around):
                    adds[n] = Counter(k for k in around if k != LINE).most_common(1)[0][0]
                else:
                    adds[n] = LINE
        self.px.update(adds)
        return self


def pieces(p):
    """How many 8-connected pieces a pose is drawn in."""
    left, n = set(p.px), 0
    while left:
        n += 1
        stack = [left.pop()]
        while stack:
            x, y = stack.pop()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if q in left:
                        left.remove(q)
                        stack.append(q)
    return n


def build(name, rows, extra=None):
    """The poses and animations of one animal: ({pose name: Pose}, {anim: (fps, loop, [pose names])})."""
    base = Pose.of(rows)
    assert base.copy().close(set()).px == base.px, f'{name}: the drawn pose is not fully outlined'
    poses, anims = RECIPES[name](base, extra or {})
    keys = set(base.px.values())
    for pname, p in poses.items():
        lone = [q for q in p.px if not any((q[0] + dx, q[1] + dy) in p.px for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy)]
        assert not lone, f'{name}.{pname}: stray pixels at {lone}'
        assert pieces(p) <= pieces(base), f'{name}.{pname}: a piece came loose'
        assert set(p.px.values()) <= keys, f'{name}.{pname}: a color the sprite does not have'
        assert max(y for _, y in p.px) <= base.ground, f'{name}.{pname}: below the feet'
    for anim, (_, _, seq) in anims.items():
        for pname in seq:
            assert pname in poses, f'{name}.{anim}: no pose {pname}'
    return poses, anims


def placed(rows, ground):
    """A pose borrowed from the sheet, standing on the same ground row (left edges lined up)."""
    dy = ground - (len(rows) - 1)
    return Pose({(x, y + dy): c for y, r in enumerate(rows) for x, c in enumerate(r) if c != '.'}, ground)


# ------------------------------------------------------------------ the animals
#
# Each recipe names its parts by box (pixels of the drawn pose) and builds poses from 'stand' (the
# drawn pose). Shared beats: idle breathes on a 1 s cycle (2 beats up, 2 down at 4 fps) with a blink
# and a little extra (tail, ear, nod) now and then; walk is 4 frames at 8 fps with the body a pixel
# lower on the contact frames; attack is wind-up, strike, follow-through at 10 fps, which puts the
# strike on the battle's lunge contact (170 ms); hurt is a flinch, then a breath, at 8 fps.

IDLE_FPS, WALK_FPS, ATTACK_FPS, HURT_FPS = 4, 8, 10, 8


def idle(extra1, extra2, extra3=None):
    """16 beats: breathing, with three of the up beats swapped for extra poses (a blink, a flick)."""
    return (IDLE_FPS, True, ['stand', 'stand', 'low', 'low', 'stand', extra1, 'low', 'low',
                             extra2, 'stand', 'low', 'low', 'stand', extra3 or 'stand', 'low', 'low'])


def hen(base, extra):
    """Brown hen: breathes, blinks, lifts her tail; struts on swapping legs; pecks; recoils when hit."""
    head = base.box(0, 0, 7, 5)                          # comb and head
    neck = base.box(0, 6, 7, 6)
    near = base.colored(base.box(7, 13, 8, 14))          # near leg: thigh and foot
    far = base.colored(base.box(5, 14, 5, 14))           # far leg
    shut = lambda: base.copy().put('5', (5, 4))          # eye closed

    def swapped(p):
        return p.move((far, 3, 0), (near, -2, 0))

    poses = {
        'stand': base,
        'low': base.copy().squash(8),                    # breath out: all above the belly down a pixel
        'blink': shut(),
        'tail': base.copy().stretch(6, 8, 14),           # tail feathers up a pixel
        'step': swapped(base.copy()),
        'step_low': swapped(base.copy()).squash(8),
        'wind': base.copy().stretch(6, 0, 7),            # neck up
        'peck': base.copy().move((head, -2, 0), (neck, -1, 0)),
        'peck2': base.copy().move((head | neck, -1, 0)),
        'hurt': shut().move((head | neck, 1, 0)).squash(8),
    }
    return poses, {
        'idle': idle('stand', 'blink', 'tail'),
        'walk': (WALK_FPS, True, ['low', 'stand', 'step_low', 'step']),
        'attack': (ATTACK_FPS, False, ['wind', 'peck', 'peck2']),
        'hurt': (HURT_FPS, False, ['hurt', 'low']),
    }


def duck(base, extra):
    """Mallard: breathes, blinks, flicks his tail; waddles; bites; recoils when hit."""
    head = base.box(0, 0, 7, 5)                          # green head and bill
    ring = base.box(0, 6, 7, 6)                          # white neck ring
    far_foot = base.colored(base.box(4, 15, 5, 15))
    near_foot = base.colored(base.box(7, 15, 9, 15))
    shut = lambda: base.copy().put('2', (5, 2))

    def swapped(p):  # the two legs are drawn alike, so trading feet trades legs
        return p.move((far_foot, 4, 0), (near_foot, -3, 0))

    poses = {
        'stand': base,
        'low': base.copy().squash(10),
        'blink': shut(),
        'tail': base.copy().stretch(9, 12, 14),          # tail tip up a pixel
        'step': swapped(base.copy()),
        'step_low': swapped(base.copy()).squash(10),
        'wind': base.copy().stretch(6, 0, 7),            # neck up
        'bite': base.copy().move((head, -2, 0), (ring, -1, 0)),
        'bite2': base.copy().move((head | ring, -1, 0)),
        'hurt': shut().move((head | ring, 1, 0)).squash(10),
    }
    return poses, {
        'idle': idle('stand', 'blink', 'tail'),
        'walk': (WALK_FPS, True, ['low', 'stand', 'step_low', 'step']),
        'attack': (ATTACK_FPS, False, ['wind', 'bite', 'bite2']),
        'hurt': (HURT_FPS, False, ['hurt', 'low']),
    }


def bunny(base, extra):
    """Gray rabbit: breathes, twitches nose and ear, blinks; hops; pounces; cowers when hit."""
    eye, nose = (4, 8), (2, 9)
    # The sheet's crouching rabbit, recolored gray; the gray rabbit's ear tips are white.
    crouch = placed(extra['crouch'], base.ground)
    top = min(y for _, y in crouch.px)
    crouch.put('6', (2, top + 1), (6, top + 1))
    poses = {
        'stand': base,
        'low': base.copy().squash(10),
        'blink': base.copy().put('2', eye),
        'sniff': base.copy().put('3', nose).put('4', (nose[0], nose[1] - 1)),   # nose up a pixel
        'ear': base.copy().squash(2, 5, 7),              # back ear dips
        'crouch': crouch,
        'hop': base.copy().lift(-2),
        'hop2': base.copy().lift(-1),
        'pounce': base.copy().lean((3, 11, -1)).lift(-1),   # head forward, ears trailing, off the ground
        'lunge': base.copy().lean((3, 11, -1)),
        'hurt': crouch.copy().put('1', (3, top + 6), (4, top + 6)),             # eyes squeezed shut
    }
    return poses, {
        'idle': idle('sniff', 'blink', 'ear'),
        'walk': (WALK_FPS, True, ['crouch', 'hop', 'hop2', 'stand']),
        'attack': (ATTACK_FPS, False, ['crouch', 'pounce', 'lunge']),
        'hurt': (HURT_FPS, False, ['hurt', 'low']),
    }


def ram(base, extra):
    """Black ram: breathes, blinks, nods; trots; rears and headbutts; recoils when hit."""
    fn, bn = base.box(11, 18, 13, 21), base.box(22, 18, 24, 21)   # near legs below the knee
    ff, bf = base.box(8, 18, 10, 19), base.box(19, 18, 21, 19)    # far legs below the knee
    shut = lambda: base.copy().put('3', (6, 5)).put('2', (6, 6))

    # The head moves through seams at column 10 (behind the eye, before the ear), so it never tears
    # away from the wool: rows of the chest give or take the pixel.
    def head_down(p):
        return p.squash(11, 0, 10)

    def head_up(p):
        return p.stretch(11, 0, 10)

    poses = {
        'stand': base,
        'low': base.copy().squash(12),
        'blink': shut(),
        'nod': head_down(base.copy()),
        'step_a': base.copy().move((ff, 1, 0), (bf, -1, 0), (fn, -1, 0), (bn, 1, 0)).squash(12),
        'step_b': base.copy().move((ff, -1, 0), (bf, 1, 0), (fn, 1, 0), (bn, -1, 0)).squash(12),
        'wind': head_up(base.copy()).lean((-FAR, 14, 1)),
        'butt': head_down(base.copy()).widen(10, -FAR, 11).lean((-FAR, 14, -1)),   # horns down and forward
        'butt2': base.copy().lean((-FAR, 14, -1)),
        'hurt': head_up(shut()).lean((-FAR, 14, 1)),
    }
    return poses, {
        'idle': idle('stand', 'blink', 'nod'),
        'walk': (WALK_FPS, True, ['step_a', 'stand', 'step_b', 'stand']),
        'attack': (ATTACK_FPS, False, ['wind', 'butt', 'butt2']),
        'hurt': (HURT_FPS, False, ['hurt', 'low']),
    }


def pig(base, extra):
    """Pig: breathes, blinks, twitches its tail; trots; charges snout first; recoils when hit."""
    tail = base.box(26, 0, 29, 3)                                 # the curl
    fn, bn = base.box(8, 17, 12, 20), base.box(20, 17, 24, 20)   # near legs below the knee, with their outline
    ff, bf = base.box(6, 17, 7, 19), base.box(17, 17, 19, 19)    # far legs below the knee
    shut = lambda: base.copy().put('d', (5, 7))
    poses = {
        'stand': base,
        'low': base.copy().squash(6),                    # the back sinks a pixel
        'blink': shut(),
        'wag': base.copy().move((tail, 0, 1)),
        'step_a': base.copy().move((ff, 1, 0), (bf, -1, 0), (fn, -1, 0), (bn, 1, 0)).squash(6),
        'step_b': base.copy().move((ff, -1, 0), (bf, 1, 0), (fn, 1, 0), (bn, -1, 0)).squash(6),
        'wind': base.copy().lean((-FAR, 14, 1)),
        'charge': base.copy().squash(14, 0, 6).lean((-FAR, 14, -1)),   # face down (seam before the far ear), body forward
        'charge2': base.copy().lean((-FAR, 14, -1)),
        'hurt': shut().lean((-FAR, 14, 1)),
    }
    return poses, {
        'idle': idle('wag', 'blink', 'wag'),
        'walk': (WALK_FPS, True, ['step_a', 'stand', 'step_b', 'stand']),
        'attack': (ATTACK_FPS, False, ['wind', 'charge', 'charge2']),
        'hurt': (HURT_FPS, False, ['hurt', 'low']),
    }


def cow(base, extra):
    """Spotted cow (the boss): breathes, blinks, swishes her tail, nods; walks; headbutts; recoils when hit."""
    tail = base.box(28, 16, 30, 18)                               # tail tip
    fn, bn = base.box(11, 19, 13, 24), base.box(23, 19, 26, 24)   # near legs below the knee
    ff = base.box(9, 19, 10, 23)                                  # far front leg (the far hind leg is hidden)
    shut = lambda: base.copy().put('g', (5, 6), (9, 6))           # the eyes' top halves

    # The head moves through a seam at column 12 (in front of the ear): rows of the chest give or take the pixel.
    def head_down(p):
        return p.squash(15, 0, 12)

    def head_up(p):
        return p.stretch(15, 0, 12)

    poses = {
        'stand': base,
        'low': base.copy().squash(14),
        'blink': shut(),
        'swish': base.copy().move((tail, 1, 0)),
        'nod': head_down(base.copy()),
        'step_a': base.copy().move((ff, 1, 0), (fn, -1, 0), (bn, 1, 0)).squash(14),
        'step_b': base.copy().move((ff, -1, 0), (fn, 1, 0), (bn, -1, 0)).squash(14),
        'wind': head_up(base.copy()).lean((-FAR, 16, 1)),
        'butt': head_down(base.copy()).lean((-FAR, 16, -1)),
        'butt2': base.copy().lean((-FAR, 16, -1)),
        'hurt': head_up(shut()).lean((-FAR, 16, 1)),
    }
    return poses, {
        'idle': idle('swish', 'blink', 'nod'),
        'walk': (WALK_FPS, True, ['step_a', 'stand', 'step_b', 'stand']),
        'attack': (ATTACK_FPS, False, ['wind', 'butt', 'butt2']),
        'hurt': (HURT_FPS, False, ['hurt', 'low']),
    }


RECIPES = {'HEN': hen, 'DUCK': duck, 'BUNNY': bunny, 'RAM': ram, 'PIG': pig, 'COW': cow}
