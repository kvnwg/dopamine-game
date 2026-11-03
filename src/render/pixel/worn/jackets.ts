/**
 * Jackets, sweaters, vests and coats: painted pixel by pixel over his torso and arms in every frame
 * (dress.ts `garment`), so they wrap him in every pose. Each garment says what it covers (`cut`) and
 * how each pixel is colored: its shade (lit from the top left, as drawn), and trims by position:
 * collar at the neck, cuffs at the paws, hem at the bottom, details at torso coordinates (u columns
 * right of the neck's middle, v rows down from it). On frame 0 the neck is v 0 (u -1 to 1), the
 * shoulders v 1 (u -4 to 5), the chest and belly v 2 and 3 (u -3 to 4, his light belly fur u -2 to
 * 2), the hem v 4, the hips v 5; the sleeves are a pixel or two at u -5 and u 5 to 6.
 * An open front leaves his belly fur showing (paint returns '').
 */
import type { GarmentPixel, JacketArt, Piece } from './types';

/** dark, mid, light keys */
type Tones = readonly [string, string, string];
const shade = (t: Tones, g: GarmentPixel) => t[g.tone];
const sleeve = (g: GarmentPixel) => g.part === 'f' || g.part === 'k';
const odd = (n: number) => ((n % 2) + 2) % 2 === 1;
const piece = (at: [number, number], rows: string[]): Piece => ({ at: { x: at[0], y: at[1] }, rows });

export const JACKETS: Readonly<Record<string, JacketArt>> = {
  // Black garbage bag poncho: glossy streaks, a yellow twist tie at the neck, a torn hem.
  jacket_garbage_bag: {
    pal: { x: 'x', a: '1', b: '2', h: '4', y: 'y' },
    cut: 'jacket',
    paint: (g) => {
      if (g.part === 'n') return g.u === 0 ? 'y' : 'a';
      if (g.hem && odd(g.u)) return '';
      if (!sleeve(g) && g.tone > 0 && (g.u - g.v === -3 || g.u - g.v === 1)) return 'h';
      return shade(['x', 'a', 'b'], g);
    },
  },
  // Lawn chair webbing woven green and white, an aluminum rim. No sleeves.
  jacket_lawn_chair: {
    pal: { G: 'G', g: 'g', W: 'W', w: 'w', a: '5', b: '4' },
    cut: 'vest',
    paint: (g) => {
      if (g.part === 'n' || g.hem) return g.tone === 0 ? 'b' : 'a';
      const green = odd(g.u + g.v);
      if (g.tone === 0) return green ? 'g' : 'b';
      return green ? 'G' : g.tone === 2 ? 'w' : 'W';
    },
  },
  // Bubble wrap armor: pale blue, white bubbles, a strip of packing tape.
  jacket_bubble_wrap: {
    pal: { C: 'C', c: 'c', w: 'w', T: 'T', t: 't' },
    cut: 'jacket',
    paint: (g) => {
      if (!sleeve(g) && g.v === 3) return g.tone === 0 ? 't' : 'T';
      if (!odd(g.u) && !odd(g.v) && g.tone > 0) return 'w';
      return g.tone === 0 ? 'c' : 'C';
    },
  },
  // Red holiday sweater: a white zigzag band, a little tree with a star, green ribbing.
  jacket_ugly_sweater: {
    pal: { r: 'r', R: 'R', e: 'e', g: 'g', G: 'G', W: 'W', y: 'y' },
    cut: 'jacket',
    paint: (g) => {
      if (g.collar || g.cuff || g.hem) return g.tone === 0 ? 'g' : 'G';
      if (sleeve(g)) return shade(['r', 'R', 'e'], g);
      if (g.v === 1) return odd(g.u) ? 'W' : 'R';
      if (g.v === 2 && g.u === 0) return 'y';
      if (g.v === 3 && Math.abs(g.u) <= 1) return 'G';
      return shade(['r', 'R', 'e'], g);
    },
  },
  // Blue tarp cape knotted at the neck with rope, grommets at its corners; it hangs behind him.
  jacket_blue_tarp: {
    pal: { U: 'U', u: 'u', c: 'c', T: 'T', t: 't', g: '5' },
    cut: 'jacket',
    paint: (g) => {
      // Curled up asleep, he's tucked under it like a blanket.
      if (g.curled) return g.hem ? 'g' : shade(['u', 'U', 'c'], g);
      if (g.part === 'n') return g.u === 0 ? 'T' : 't';
      // Over the shoulders and down his sides; his chest stays bare.
      if (g.v === 1 && Math.abs(g.u) >= 2) return g.u < 0 ? 'c' : 'U';
      if (sleeve(g)) return g.tone === 0 ? 'u' : 'U';
      return '';
    },
    back: piece([6, 0], [
      '...ccUUUUUu..',
      '..cUUUUUUUUu.',
      '.cUUUUUUUUUuu',
      '.cUUUUUUUUUuu',
      'cUUUUUUUUUUuu',
      'cUUUUUUUUUUUu',
      'gUUuUUUUuUUug',
    ]),
  },
  // Tiny pink dog raincoat: yellow toggles, white trim, its hood down behind his neck.
  jacket_dog_raincoat: {
    pal: { q: 'q', r: 'r', P: 'P', W: 'W', y: 'y', O: 'O' },
    cut: 'coat',
    paint: (g) => {
      if (g.part === 'n') return 'P';
      if (g.cuff || g.hem) return 'W';
      if (!sleeve(g) && g.u === -1 && (g.v === 2 || g.v === 4)) return 'y';
      if (!sleeve(g) && g.u === 0 && g.v >= 1) return 'r';
      return shade(['r', 'q', 'P'], g);
    },
  },
  // The HOA president's safety vest: blaze orange, silver reflective stripes, a gold pin. No sleeves.
  jacket_unique_hoa_vest: {
    pal: { O: 'O', o: 'o', y: 'y', Y: 'Y', w: 'w', a: '5' },
    cut: 'vest',
    paint: (g) => {
      if (g.part === 'n') return '';
      if (g.v === 3) return g.tone === 0 ? 'a' : 'w';
      if ((g.u === -2 || g.u === 2) && g.v <= 2) return g.tone === 0 ? 'a' : 'w';
      if (g.u === -1 && g.v === 2) return 'Y';
      return g.tone === 0 ? 'o' : g.tone === 2 ? 'y' : 'O';
    },
  },
  // Dark brown trench coat: popped collar, wide lapels, belted with a buckle, gray buttons, knee length.
  jacket_trench_coat: {
    pal: { x: 'x', b: 'b', n: 'n', N: 'N', g: '4', w: '5' },
    cut: 'coat',
    paint: (g) => {
      if (g.part === 'n') return g.u === 0 ? '' : 'n';
      if (!sleeve(g) && g.v === 1 && Math.abs(g.u) <= 2) return g.u === 0 ? '' : g.u < 0 ? 'N' : 'n';
      if (!sleeve(g) && g.v === 3) return g.u === 0 ? 'w' : 'x';
      if (!sleeve(g) && g.v === 2 && Math.abs(g.u) === 1) return 'g';
      if (!sleeve(g) && g.v >= 4 && g.u === 0) return 'x';
      return shade(['x', 'b', 'n'], g);
    },
  },
  // Red puffer: quilted into puffy bands, a high collar, a zip.
  jacket_puffer: {
    pal: { r: 'r', R: 'R', e: 'e', P: 'P', v: 'v' },
    cut: 'jacket',
    paint: (g) => {
      if (g.part === 'n') return 'R';
      if (!sleeve(g) && g.u === 0) return 'r';
      // Each puff is lit along its top and pinched along its bottom seam.
      if (!odd(g.v)) return g.tone === 2 ? 'R' : 'r';
      return g.tone === 0 ? 'R' : g.tone === 2 ? 'P' : 'e';
    },
  },
  // Moth-eaten fur coat: shaggy near-black fur, a fluffy cream collar and cuffs, moth holes showing his fur.
  jacket_fur_coat: {
    pal: { x: 'x', b: 'b', n: 'n', s: 's', T: 'T', W: 'W' },
    cut: 'coat',
    paint: (g) => {
      if (g.part === 'n' || g.cuff) return g.tone === 0 ? 's' : 'T';
      if (!sleeve(g) && g.v === 1 && Math.abs(g.u) <= 2) return g.u === -1 ? 'W' : g.tone === 0 ? 's' : 'T';
      if (!sleeve(g) && ((g.u === -2 && g.v === 3) || (g.u === 2 && g.v === 4))) return '';
      // Shaggy: streaks of lighter fur.
      if (g.tone > 0 && odd(g.u * 3 + g.v)) return 'n';
      return shade(['x', 'b', 'n'], g);
    },
  },
  // Black leather jacket worn open: wide gray lapels, silver zip and snaps.
  jacket_leather: {
    pal: { x: 'x', a: '1', b: '2', c: '3', w: '5' },
    cut: 'jacket',
    paint: (g) => {
      if (g.part === 'n') return g.u === 0 ? '' : 'a';
      if (!sleeve(g) && Math.abs(g.u) <= 1 && g.v >= 1) return '';
      if (!sleeve(g) && g.v === 1 && Math.abs(g.u) === 2) return 'c';
      if (!sleeve(g) && g.u === 2 && g.v >= 2) return 'w';
      if (g.cuff) return 'x';
      return shade(['x', 'a', 'b'], g);
    },
  },
  // Red hooded parka, zipped, the hood down with a fur trim around his neck.
  jacket_hooded_parka: {
    pal: { r: 'r', R: 'R', P: 'P', e: 'e', b: 'b', n: 'n', g: '4', w: '5' },
    cut: 'coat',
    paint: (g) => {
      if (g.part === 'n') return g.u === 0 ? 'w' : 'g';
      if (!sleeve(g) && g.v === 1 && Math.abs(g.u) <= 2) return odd(g.u) ? 'w' : 'g';
      if (!sleeve(g) && g.u === 0) return 'r';
      if (g.cuff || g.hem) return 'r';
      return shade(['r', 'R', 'e'], g);
    },
  },

  // ---------------------------------------------------------------- more clothes (itemsClothes.json)

  // Cardboard box armor: kraft board, its lit top edge and dark bottom edge, a red FRAGILE stamp. No sleeves.
  jacket_cardboard_box: {
    pal: { N: 'N', t: 't', T: 'T', R: 'R' },
    cut: 'vest',
    paint: (g) => {
      if (g.part === 'n' && !g.curled) return '';
      if (g.curled) return shade(['N', 't', 'T'], g);
      if (g.hem) return 'N';
      if (g.v === 1) return g.tone === 0 ? 't' : 'T';
      if (g.v === 2 && Math.abs(g.u) <= 1) return 'R';
      return shade(['N', 't', 'T'], g);
    },
  },
  // Duct tape jacket: silver strips, each one's top edge catching the light, a red tape X on the chest.
  jacket_duct_tape: {
    pal: { a: '2', b: '3', c: '4', d: '5', w: 'w', R: 'R' },
    cut: 'jacket',
    paint: (g) => {
      if (g.part === 'n') return 'c';
      if (!sleeve(g) && !g.curled && (g.v === 2 ? g.u === 2 || g.u === 3 : (g.v === 1 || g.v === 3) && (g.u === 1 || g.u === 4))) return 'R';
      if (g.hem || g.cuff) return g.tone === 0 ? 'a' : 'b';
      if (odd(g.v)) return g.tone === 0 ? 'b' : g.tone === 2 ? 'w' : 'd';
      return g.tone === 0 ? 'a' : 'c';
    },
  },
  // Newspaper suit: cream newsprint, folded lapels round a V, a line of print across the chest.
  jacket_newspaper: {
    pal: { d: '5', W: 'W', w: 'w', g: '4', t: '3' },
    cut: 'jacket',
    paint: (g) => {
      if (g.part === 'n') return g.u === 0 ? '' : 'w';
      if (!sleeve(g) && !g.curled && g.v === 1 && Math.abs(g.u) <= 1) return g.u === 0 ? 'g' : 'w';
      if (!sleeve(g) && !g.curled && g.u === 0) return 'g';
      if (g.v === 2 && g.tone > 0 && ((g.u % 3) + 3) % 3 !== 2) return 't';
      return shade(['d', 'W', 'w'], g);
    },
  },
  // Hawaiian shirt: sky blue, pink hibiscus with yellow hearts, an open collar.
  jacket_hawaiian_shirt: {
    pal: { U: 'U', c: 'c', C: 'C', q: 'q', y: 'y', G: 'G' },
    cut: 'jacket',
    paint: (g) => {
      if (g.part === 'n') return '';
      if (!sleeve(g) && !g.curled && g.v === 1 && Math.abs(g.u) <= 1) return g.u === 0 ? '' : 'C';
      const k = (((g.u + 2 * g.v) % 4) + 4) % 4;
      if (k === 0) return odd(g.v) ? 'y' : 'q';
      if (k === 2 && odd(g.u)) return 'G';
      return shade(['U', 'c', 'C'], g);
    },
  },
  // Hotel bathrobe: white terry, the shawl collar round his neck, a blue belt knotted at the waist, a gold monogram.
  jacket_bathrobe: {
    pal: { d: '5', W: 'W', w: 'w', C: 'C', c: 'c', y: 'y' },
    cut: 'coat',
    paint: (g) => {
      if (g.curled) return shade(['d', 'W', 'w'], g);
      if (g.part === 'n') return 'w';
      if (!sleeve(g) && g.v === 1 && Math.abs(g.u) <= 1) return g.u === 0 ? '' : 'w';
      if (!sleeve(g) && g.v === 3) return g.u === 0 ? 'c' : 'C';
      if (!sleeve(g) && g.v === 4 && g.u === -1) return 'C';
      if (!sleeve(g) && g.v === 2 && g.u === 2) return 'y';
      if (g.cuff) return 'w';
      return shade(['d', 'W', 'w'], g);
    },
  },
  // Tuxedo T-shirt: black, a printed white shirt front with a bow tie and a stud; short sleeves.
  jacket_tuxedo_tee: {
    pal: { x: 'x', a: '1', b: '2', w: 'w', g: '5' },
    cut: 'jacket',
    paint: (g) => {
      if (g.part === 'n') return 'a';
      if (!sleeve(g) && !g.curled && !g.hem && Math.abs(g.u) <= 1) {
        if (g.v === 1) return g.u === 0 ? 'a' : 'x';
        if (g.v === 3 && g.u === 0) return 'x';
        return g.tone === 0 ? 'g' : 'w';
      }
      if (g.cuff) return '';
      return shade(['x', 'a', 'b'], g);
    },
  },
  // Donut pool float round his belly: pink frosting with sprinkles over golden dough; it sticks out past his paws.
  jacket_pool_float: {
    pal: { P: 'P', q: 'q', w: 'w', t: 't', N: 'N', T: 'T', y: 'y', c: 'c', l: 'l' },
    cut: 'jacket',
    paint: (g) => {
      if (g.part !== 'b') return '';
      if (g.v === 3) return g.u === -2 ? 'y' : g.u === 1 ? 'c' : g.u === 3 ? 'l' : g.tone === 2 ? 'w' : g.tone === 0 ? 'q' : 'P';
      if (g.v === 4) return g.tone === 0 ? 'N' : 't';
      return '';
    },
    back: piece([8, -2], [
      '.################.',
      '#wPPPPPPPPPPPPPPq#',
      '#tttttttttttttttN#',
      '.################.',
    ]),
  },
  // Velour track jacket: purple, zipped to the chin, a silver zip, white piping at the cuffs.
  jacket_velour_tracksuit: {
    pal: { v: 'v', V: 'V', m: 'm', w: 'w', g: '5', d: '4' },
    cut: 'jacket',
    paint: (g) => {
      if (g.part === 'n') return g.u === 0 ? 'w' : 'V';
      if (!sleeve(g) && !g.curled && g.u === 0) return g.tone === 0 ? 'd' : 'g';
      if (g.cuff) return 'w';
      if (g.hem) return 'v';
      return shade(['v', 'V', 'm'], g);
    },
  },
  // Letterman jacket: blue wool body, cream leather sleeves, a gold letter, a gold-striped ribbed hem and collar.
  jacket_letterman: {
    pal: { u: 'u', U: 'U', c: 'c', g: '5', W: 'W', w: 'w', y: 'y' },
    cut: 'jacket',
    paint: (g) => {
      if (g.part === 'n') return g.u === 0 ? 'y' : 'u';
      if (sleeve(g)) return shade(['g', 'W', 'w'], g);
      if (g.hem) return 'y';
      if (!g.curled && g.u === -2 && (g.v === 2 || g.v === 3)) return 'y';
      return shade(['u', 'U', 'c'], g);
    },
  },
  // Sandwich board hung from a rope round his neck: a cream sign with red lettering, its edges in shadow.
  jacket_sandwich_board: {
    pal: { t: 't', N: 'N', W: 'W', g: '5', R: 'R' },
    cut: 'vest',
    paint: (g) => {
      if (g.curled) return g.hem ? 'N' : 'W';
      if (g.part === 'n') return g.u === 0 ? '' : 't';
      if (g.v === 1) return g.u === -2 || g.u === 3 ? 't' : '';
      if (g.hem) return 'N';
      if (g.v === 3 && g.u >= -2 && g.u <= 3 && g.u !== 0) return 'R';
      return g.tone === 0 ? 'g' : 'W';
    },
  },
  // Sequin blazer: gold sequins glinting here and there, black satin lapels round a white shirt, a black button.
  jacket_sequin_blazer: {
    pal: { O: 'O', y: 'y', Y: 'Y', w: 'w', x: 'x', a: '1' },
    cut: 'jacket',
    paint: (g) => {
      if (g.part === 'n') return 'w';
      if (!sleeve(g) && !g.curled) {
        if (g.v === 1 && g.u === 0) return 'w';
        if (g.v === 1 && Math.abs(g.u) === 1) return 'x';
        if (g.v === 2 && g.u === 0) return 'x';
        if (g.v === 3 && g.u === 0) return 'a';
      }
      if (g.tone > 0 && (((g.u + 2 * g.v) % 3) + 3) % 3 === 0) return g.tone === 2 ? 'w' : 'Y';
      return shade(['O', 'y', 'Y'], g);
    },
  },
  // Hot dog costume: the sausage down his front with a mustard zigzag, the bun round his sides and arms; the
  // sausage's tip pokes up between his ears (never above row 2 in his idle loop, under his HP bar) and the bun
  // rises behind his shoulders.
  jacket_hot_dog: {
    pal: { r: 'r', R: 'R', e: 'e', N: 'N', t: 't', T: 'T', y: 'y' },
    cut: 'coat',
    paint: (g) => {
      if (g.part === 'n') return 'R';
      if (!sleeve(g) && !g.curled && Math.abs(g.u) <= 1) {
        if (g.v >= 1 && g.u === [-1, 0, 1, 0][(g.v - 1) % 4]) return 'y';
        return shade(['r', 'R', 'e'], g);
      }
      return shade(['N', 't', 'T'], g);
    },
    back: piece([7, 10], [
      '.......##.......',
      '......#eR#......',
      '.....#eRRr#.....',
      '.##..#RRRr#..##.',
      '#Tt#.#RRRr#.#tN#',
      '#Tt#.#RRRr#.#tN#',
      '#Tt#.#RRRr#.#tN#',
      '#Tt#.#RRRr#.#tN#',
      '#Tt#.#RRRr#.#tN#',
      '#Tt#.#RRRr#.#tN#',
      '#Tt#.#RRRr#.#tN#',
      '.##..........##.',
    ]),
  },
};
