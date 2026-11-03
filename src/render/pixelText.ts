/**
 * Bitmap-font text in the battle (pixel/font.ts) as Phaser images on the art grid. A text is a texture
 * at 1 texel per art pixel drawn at scale P, placed with its top-left corner on a whole art pixel, so
 * its pixels are the same size as everything else and line up with them.
 *
 * Textures are shared by every image showing the same text in the same style and kept a while after
 * the last one goes (numbers repeat a lot), so a busy fight doesn't make and free a texture per hit.
 */
import Phaser from 'phaser';
import { P, toCanvas } from './pixel';
import { renderText, type TextStyle } from './pixel/font';

interface Entry {
  id: string;
  key: string;
  /** Size in art pixels. */
  w: number;
  h: number;
  refs: number;
  /** When it was last let go (for dropping the oldest unused). */
  idle: number;
}

/** Unused text textures kept for reuse. */
const KEEP_IDLE = 80;

const snap = (v: number) => Math.round(v / P) * P;

export class PixelTexts {
  private entries = new Map<string, Entry>();
  private serial = 0;
  private clock = 0;

  constructor(private scene: Phaser.Scene) {}

  /** A texture for `text` in `style`, counted as used until `release`. */
  acquire(text: string, style: TextStyle): Entry {
    const id = [style.face, typeof style.fill === 'string' ? style.fill : style.fill.join(','), style.ink ?? '', style.shadow ? 1 : 0, style.maxW ?? '', style.align ?? '', text].join('|');
    let e = this.entries.get(id);
    if (e && !this.scene.textures.exists(e.key)) {
      this.entries.delete(id);
      e = undefined;
    }
    if (!e) {
      this.trim();
      const buf = renderText(text, style);
      const key = `pxtext_${this.serial++}`;
      this.scene.textures.addCanvas(key, toCanvas(buf, 1));
      e = { id, key, w: buf.w, h: buf.h, refs: 0, idle: 0 };
      this.entries.set(id, e);
    }
    e.refs++;
    return e;
  }

  release(e: Entry): void {
    e.refs = Math.max(0, e.refs - 1);
    if (e.refs === 0) e.idle = ++this.clock;
  }

  /** Frees the longest-unused textures beyond KEEP_IDLE. */
  private trim(): void {
    const idle = [...this.entries.values()].filter((e) => e.refs === 0);
    if (idle.length <= KEEP_IDLE) return;
    idle.sort((a, b) => a.idle - b.idle);
    for (const e of idle.slice(0, idle.length - KEEP_IDLE)) {
      this.entries.delete(e.id);
      if (this.scene.textures.exists(e.key)) this.scene.textures.remove(e.key);
    }
  }

  /** A new text image (top-left at 0, 0 until placed). */
  add(text: string, style: TextStyle): PixelText {
    return new PixelText(this.scene, this, text, style);
  }

  destroy(): void {
    for (const e of this.entries.values()) if (this.scene.textures.exists(e.key)) this.scene.textures.remove(e.key);
    this.entries.clear();
  }
}

/** One line (or a few wrapped lines) of bitmap text; its size is in art pixels. */
export class PixelText extends Phaser.GameObjects.Image {
  private entry: Entry;
  text: string;
  /** Showing the white-filled flash version. */
  private flashing = false;
  private anchor = { x: 0, y: 0, ax: 0, ay: 0, placed: false };

  constructor(scene: Phaser.Scene, private texts: PixelTexts, text: string, public style: TextStyle) {
    const entry = texts.acquire(text, style);
    super(scene, 0, 0, entry.key);
    this.entry = entry;
    this.text = text;
    this.setOrigin(0, 0).setScale(P);
    scene.add.existing(this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.texts.release(this.entry));
  }

  /** Width and height in art pixels. */
  get artW(): number {
    return this.entry.w;
  }
  get artH(): number {
    return this.entry.h;
  }

  private show(text: string, flashing: boolean): this {
    const next = this.texts.acquire(text, flashing ? { ...this.style, fill: '#ffffff' } : this.style);
    this.setTexture(next.key);
    this.setOrigin(0, 0);
    this.texts.release(this.entry);
    this.entry = next;
    this.text = text;
    this.flashing = flashing;
    if (this.anchor.placed) this.place(this.anchor.x, this.anchor.y, this.anchor.ax, this.anchor.ay);
    return this;
  }

  /** Shows other text (same style); keeps its placement anchor. */
  setText(text: string): this {
    return text === this.text ? this : this.show(text, this.flashing);
  }

  /** While `on`, the letters are filled white (the outline stays): a flash in whole pixels. */
  setFlash(on: boolean): this {
    return on === this.flashing ? this : this.show(this.text, on);
  }

  /**
   * Puts point (ax, ay) of its box (0..1 each way) at screen (x, y), its top-left corner on the
   * nearest whole art pixel.
   */
  place(x: number, y: number, ax = 0.5, ay = 0.5): this {
    this.anchor = { x, y, ax, ay, placed: true };
    this.setPosition(snap(x - this.entry.w * P * ax), snap(y - this.entry.h * P * ay));
    return this;
  }
}
