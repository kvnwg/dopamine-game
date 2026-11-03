/**
 * Procedural sound and music with the Web Audio API. Every sound is synthesized unless it has a
 * recording (src/assets/sounds, soundFiles.ts), which then plays in its place at the synthesized
 * sound's loudness. Rewards are tuned to the music's key (C major) so wins sound like the song
 * resolving (Dopamine Playbook). Audio starts on the first tap (browsers require a user gesture);
 * recordings are decoded before that, at startup (preload).
 */
import { SOUND_FILES, SOUND_LEVELS } from './soundFiles';

export type Material = 'plastic' | 'metal' | 'glass' | 'ceramic' | 'food' | 'cloth' | 'paper' | 'wood' | 'rubber';
export type Tier =
  | 'junk' | 'decent' | 'shiny' | 'epic' | 'legendary' | 'mythic' | 'vintage' | 'limited' | 'prototype' | 'mint' | 'gemMint' | 'museum' | 'grail';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
/** C major pentatonic ladder used for pitch stacking and reward notes. */
const LADDER = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
const TIERS: Tier[] = ['junk', 'decent', 'shiny', 'epic', 'legendary', 'mythic', 'vintage', 'limited', 'prototype', 'mint', 'gemMint', 'museum', 'grail'];
const MINT = TIERS.indexOf('mint');
/** Semitones a recording climbs by, step by step: up the major scale (do, re, mi...) to an octave, in key. */
const CLIMB = [0, 2, 4, 5, 7, 9, 11, 12];
const climb = (step: number) => CLIMB[Math.max(0, Math.min(CLIMB.length - 1, step))];

// Lo-fi loop: Fmaj7 - Em7 - Dm7 - Cmaj7 at 78 BPM, swung eighths.
const BPM = 78;
const CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const ROOTS = [41, 40, 38, 36];

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  freqEnd?: number;
  detune?: number;
  filter?: number;
  q?: number;
  vibrato?: number;
  bus?: AudioNode;
}
interface NoiseOpts {
  gain?: number;
  type?: BiquadFilterType;
  freq?: number;
  q?: number;
  freqEnd?: number;
  attack?: number;
  bus?: AudioNode;
}

interface Recording {
  buf: AudioBuffer;
  /** Where the sound starts (s), past the silence an MP3 encoder puts in front. */
  from: number;
}

/** A file's bytes. The artifact build inlines files as data: URLs, read here (its page may not fetch them). */
async function bytesOf(url: string): Promise<ArrayBuffer> {
  if (!url.startsWith('data:')) return (await fetch(url)).arrayBuffer();
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** decodeAudioData in its promise form, or its callback form (older Safari). */
function decode(ctx: BaseAudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(bytes, resolve, reject) as Promise<AudioBuffer> | undefined;
    p?.then(resolve, reject);
  });
}

/** Seconds of near-silence at the start of a decoded recording (up to 0.1 s). */
function leadIn(buf: AudioBuffer): number {
  const max = Math.min(buf.length, Math.round(buf.sampleRate * 0.1));
  let first = max;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < first; i++) {
      if (Math.abs(d[i]) > 1e-3) {
        first = i;
        break;
      }
    }
  }
  return first === max ? 0 : first / buf.sampleRate;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private duck!: GainNode;
  private noiseBuf!: AudioBuffer;
  private soundOn = true;
  private musicOn = true;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextStep = 0;
  private step = 0;
  private coinStack = 0;
  private lastCoinAt = 0;
  private landStack = 0;
  private lastLandAt = 0;
  private lastPlayed = new Map<string, number>();
  private seed = 0x5eed;
  private recs = new Map<string, Recording>();
  private loading: Promise<void> | null = null;
  private loaded = false;

  private rnd(): number {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Decodes the recordings, so they are ready by the first tap (decoding needs none): call at startup.
   * A sound whose recording fails to load stays synthesized.
   */
  preload(): Promise<void> {
    this.loading ??= this.load()
      .catch(() => {})
      .then(() => {
        this.loaded = true;
      });
    return this.loading;
  }

  private async load(): Promise<void> {
    const names = Object.keys(SOUND_FILES);
    const OAC = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!OAC || names.length === 0) return;
    // Decoded at 48 kHz, the rate most devices play at (any other is resampled as it plays).
    const dec = new OAC(2, 1, 48000);
    await Promise.all(
      names.map(async (name) => {
        try {
          const buf = await decode(dec, await bytesOf(SOUND_FILES[name]));
          this.recs.set(name, { buf, from: leadIn(buf) });
        } catch {
          /* stays synthesized */
        }
      }),
    );
  }

  /**
   * Plays the recording of `name` if there is one (true when it did: the caller skips its synthesized
   * sound), at its matched level times `gain`, `semis` semitones up (as the synthesized sound would
   * climb). `fit` (seconds) makes it end then, for a riser whose top must land on a moment: a longer
   * one starts partway in (faded in), a shorter one waits.
   */
  private rec(name: string, at: number, o: { semis?: number; gain?: number; fit?: number } = {}): boolean {
    const r = this.recs.get(name);
    const ctx = this.ctx;
    if (!r || !ctx) return false;
    const rate = Math.pow(2, (o.semis ?? 0) / 12);
    const level = (SOUND_LEVELS[name] ?? 1) * (o.gain ?? 1);
    let start = at;
    let from = r.from;
    const src = ctx.createBufferSource();
    src.buffer = r.buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = level;
    if (o.fit !== undefined) {
      const len = (r.buf.duration - r.from) / rate;
      if (len > o.fit) {
        from += (len - Math.max(0, o.fit)) * rate;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(level, start + 0.04);
      } else start += o.fit - len;
    }
    src.connect(g);
    g.connect(this.sfx);
    src.start(start, from);
    return true;
  }

  /** Call from a user gesture. Creates and resumes the audio context and starts the music. */
  unlock(): void {
    try {
      if (!this.ctx) this.build();
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().then(() => this.syncMusic());
      this.syncMusic();
    } catch {
      /* no audio available */
    }
  }

  private build() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.soundOn ? 1 : 0;
    this.sfx.connect(this.master);
    this.duck = ctx.createGain();
    this.duck.connect(this.master);
    // Lo-fi: the music sits behind a warm low-pass.
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 2600;
    warm.connect(this.duck);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.5 : 0;
    this.musicBus.connect(warm);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = this.rnd() * 2 - 1;
  }

  setSound(on: boolean): void {
    this.soundOn = on;
    if (this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.1);
    this.syncMusic();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ------------------------------------------------------------------ primitives
  private get live(): AudioContext | null {
    return this.ctx && this.ctx.state === 'running' ? this.ctx : null;
  }

  /** Simple per-key rate limit so rapid events never turn into noise. */
  private gate(key: string, gapMs: number): boolean {
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? -1e9) < gapMs) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  private tone(freq: number, at: number, dur: number, o: ToneOpts = {}) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), at + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const peak = Math.max(0.0002, o.gain ?? 0.2);
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(a + 0.01, dur));
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.filter;
      f.Q.value = o.q ?? 0.7;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.bus ?? this.sfx);
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const lg = ctx.createGain();
      lg.gain.value = o.vibrato;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + dur + 0.05);
    }
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  private noise(at: number, dur: number, o: NoiseOpts = {}) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq ?? 1000, at);
    f.Q.value = o.q ?? 1;
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, at + dur);
    const g = ctx.createGain();
    const peak = Math.max(0.0002, o.gain ?? 0.2);
    const a = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(a + 0.01, dur));
    src.connect(f);
    f.connect(g);
    g.connect(o.bus ?? this.sfx);
    src.start(at, this.rnd() * 1.5);
    src.stop(at + dur + 0.05);
  }

  private bell(freq: number, at: number, dur: number, gain = 0.1, bus?: AudioNode) {
    this.tone(freq, at, dur, { gain, attack: 0.002, bus });
    this.tone(freq * 2.76, at, dur * 0.45, { gain: gain * 0.3, attack: 0.002, bus });
    this.tone(freq * 5.4, at, dur * 0.2, { gain: gain * 0.12, attack: 0.001, bus });
  }

  private vary(f: number, pct = 0.05) {
    return f * (1 + (this.rnd() * 2 - 1) * pct);
  }

  private duckMusic(depth = 0.35, holdSec = 0.6) {
    const ctx = this.ctx!;
    const g = this.duck.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(depth, now, 0.03);
    g.setTargetAtTime(1.15, now + holdSec, 0.25);
    g.setTargetAtTime(1, now + holdSec + 1.2, 0.4);
  }

  // ------------------------------------------------------------------ UI and dumpster
  /**
   * Button pop with a slightly random pitch so it never grates; `streak` (taps in quick succession,
   * from 0) raises it a semitone each, up to an octave.
   */
  tap(streak = 0): void {
    const ctx = this.live;
    if (!ctx || !this.gate('tap', 40)) return;
    const at = ctx.currentTime;
    const semis = Math.min(12, Math.max(0, streak));
    // (A hair of random pitch, so a run of taps never sounds stamped out.)
    if (this.rec('tap', at, { semis: semis + (this.rnd() * 2 - 1) * 0.3 })) return;
    const up = Math.pow(2, semis / 12);
    this.tone(this.vary(560) * up, at, 0.07, { gain: 0.09, freqEnd: this.vary(820) * up });
    this.noise(at, 0.02, { freq: 3000, q: 2, gain: 0.03 });
  }

  /** An item clicking past the reel's win line: brighter while fast, a fuller clack as it slows. */
  wheelTick(speed01: number): void {
    const ctx = this.live;
    if (!ctx || !this.gate('wheelTick', 28)) return;
    const at = ctx.currentTime;
    const slow = 1 - Math.max(0, Math.min(1, speed01));
    this.tone(this.vary(1300 + 1100 * speed01, 0.03), at, 0.03, { type: 'square', gain: 0.025 + 0.04 * slow, filter: 3400 });
    this.noise(at, 0.014, { freq: 4200 - 1600 * slow, q: 4, gain: 0.02 + 0.03 * slow });
  }

  /** A reel clunks to a stop on its result. */
  wheelStop(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('wheelStop', 120)) return;
    const at = ctx.currentTime;
    this.tone(220, at, 0.09, { gain: 0.12, freqEnd: 140 });
    this.noise(at, 0.04, { freq: 2600, q: 3, gain: 0.06 });
  }

  /** The Roll tab's reels launch: a lever clack and a short whirr (quiet: it plays every spin). */
  reelStart(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('reelStart', 250)) return;
    const at = ctx.currentTime;
    this.noise(at, 0.035, { freq: 1800, q: 3, gain: 0.04 });
    this.tone(150, at, 0.07, { type: 'square', gain: 0.025, filter: 900, freqEnd: 95 });
    this.noise(at + 0.04, 0.22, { type: 'bandpass', freq: 500, freqEnd: 1500, q: 1.2, gain: 0.025, attack: 0.05 });
  }

  /**
   * An item clicking past a reel's win line. `rise` (0 to 1) climbs as the reel slows, so a stop
   * winds up in pitch; `loud` (0 to 1) for the ticks that matter (the last reel's).
   */
  reelTick(rise: number, loud = 0): void {
    const ctx = this.live;
    if (!ctx || !this.gate('reelTick', 30)) return;
    const at = ctx.currentTime;
    const r = Math.max(0, Math.min(1, rise));
    // (Kevin: "reel tick is good, make it a bit louder": 1.4x, about 3 dB.)
    const v = 1.4;
    this.tone(this.vary(1000 * Math.pow(2, r * 1.25), 0.02), at, 0.03, { type: 'square', gain: (0.018 + 0.03 * r * (0.5 + loud)) * v, filter: 3800 });
    this.noise(at, 0.012, { freq: 3800, q: 4, gain: (0.015 + 0.02 * r) * v });
  }

  /**
   * A notch of a result's crawl toward the line: each one a step higher on the ladder (`step` from 0).
   * A rare result's crawl (`rare`: a build-up, not a small hopeful glow) with a recording plays it
   * once, from the first notch, over the whole crawl.
   */
  reelCreep(step: number, rare = true): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    if (rare && this.recs.has('reel_creep')) {
      if (step === 0) this.rec('reel_creep', at);
      return;
    }
    if (!this.gate('reelCreep', 60)) return;
    const n = LADDER[Math.min(LADDER.length - 1, 3 + step)];
    this.tone(midi(n), at, 0.06, { type: 'square', gain: 0.03 + Math.min(0.03, step * 0.004), filter: 3200 });
    this.noise(at, 0.02, { freq: 2600, q: 5, gain: 0.04 });
  }

  /**
   * A reel lands on its result: a thud whose weight and pitch rise with the rarity (`tier` 0 Junk to
   * 12 Holy Grail); `last` for the spin's final stop. Shiny and up ring on top.
   */
  reelLand(tier: number, last: boolean): void {
    const ctx = this.live;
    if (!ctx || !this.gate('reelLand', 50)) return;
    const at = ctx.currentTime;
    const k = Math.max(0, Math.min(12, tier));
    const w = last ? 1.25 : 1;
    if (this.rec('reel_land', at, { gain: w })) return;
    this.tone(150 + k * 8, at, 0.12 + k * 0.012, { gain: (0.13 + k * 0.018) * w, freqEnd: 60 + k * 3 });
    this.noise(at, 0.045, { freq: 2200 + k * 220, q: 3, gain: 0.06 + k * 0.006 });
    if (k >= 2) this.bell(midi(LADDER[Math.min(LADDER.length - 1, 2 + k)]), at + 0.01, 0.3 + k * 0.03, 0.03 + k * 0.004);
    if (k >= 4) this.noise(at + 0.02, 0.35, { type: 'highpass', freq: 5500, gain: 0.04, attack: 0.01 });
  }

  /**
   * The build-up glow climbs a tier: a quick upward flick, higher for rarer tiers (`tier` 1 to 12). A
   * recording climbs a step for each of the glow's steps (`step`, from 0) instead.
   */
  glowUp(tier: number, step = 0): void {
    const ctx = this.live;
    if (!ctx || !this.gate('glowUp', 60)) return;
    const at = ctx.currentTime;
    if (this.rec('glow_up', at, { semis: climb(step) })) return;
    const n = LADDER[Math.min(LADDER.length - 2, 3 + tier)];
    this.tone(midi(n - 5), at, 0.08, { type: 'triangle', gain: 0.04, freqEnd: midi(n) });
    this.bell(midi(n), at + 0.05, 0.35, 0.045);
    this.bell(midi(LADDER[Math.min(LADDER.length - 1, 4 + tier)]), at + 0.1, 0.3, 0.03);
    this.noise(at, 0.12, { type: 'highpass', freq: 6000, gain: 0.025, attack: 0.02 });
  }

  /** The dumpster lid clunk on a manual dive. */
  lidClunk(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.tone(100, at, 0.28, { gain: 0.32, freqEnd: 52 });
    this.noise(at, 0.1, { freq: 2300, q: 5, gain: 0.1 });
    this.tone(410, at, 0.12, { type: 'square', gain: 0.025, filter: 1400 });
  }

  /** A tap on the padlock a new game's dumpster starts under: a heavy metal clank. */
  lockHit(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    if (this.rec('lock_tap', at)) return;
    this.tone(150, at, 0.22, { gain: 0.3, freqEnd: 70 });
    this.noise(at, 0.09, { freq: 2600, q: 4, gain: 0.14 });
    for (const p of [1, 2.41, 3.9]) this.tone(this.vary(610) * p, at, 0.3 / p, { gain: 0.05 / p, attack: 0.001 });
  }

  /** The padlock pops and the metal falls off the dumpster: a ping, a crash, then clatter. */
  lockBreak(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    if (this.rec('lock_break', at)) {
      // (The recording's rubble runs on: the music stays down a little longer.)
      this.duckMusic(0.4, 0.9);
      return;
    }
    this.bell(1480, at, 0.5, 0.09);
    this.tone(70, at + 0.12, 0.6, { gain: 0.5, freqEnd: 38 });
    this.noise(at + 0.12, 0.3, { type: 'lowpass', freq: 3000, freqEnd: 600, gain: 0.32 });
    for (let i = 0; i < 6; i++) {
      const t = at + 0.25 + i * (0.07 + this.rnd() * 0.06);
      for (const p of [1, 2.63]) this.tone(this.vary(440 + i * 60) * p, t, 0.18 / p, { gain: (0.05 / p) * (1 - i / 7), attack: 0.001 });
    }
    this.duckMusic(0.4, 0.5);
  }

  /** Something new opens up (a tab or a button): a rising sparkle of three notes. */
  featureOpen(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('featureOpen', 300)) return;
    const at = ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) => this.bell(midi(n), at + i * 0.07, 0.35, 0.07));
  }

  /**
   * One rattle beat: each beat shakes louder and higher than the last. A recording plays once instead,
   * from the first beat, ending as the find lands (`landIn` seconds from now).
   */
  rattle(beat: number, beats: number, heartbeat: boolean, landIn = 1): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    if (this.recs.has('rattle')) {
      if (beat === 0) this.rec('rattle', at, { fit: Math.max(0.3, landIn) });
      return;
    }
    const k = (beat + 1) / beats;
    this.noise(at, 0.07, { freq: 1900 + beat * 320, q: 6, gain: 0.05 + 0.1 * k });
    this.tone(150 + beat * 28, at, 0.06, { type: 'square', gain: 0.02 + 0.03 * k, filter: 1300 });
    if (heartbeat) this.tone(62, at, 0.2, { gain: 0.28, freqEnd: 40 });
  }

  /**
   * A rising tone under the build-up that seems to keep climbing (Shepard-style pair), `seconds` long.
   * A recording plays its last `seconds` instead: the long one before a full-screen reveal (`long`),
   * the short one before a smaller rare find.
   */
  riser(seconds: number, tierIndex: number, long = false): void {
    const ctx = this.live;
    if (!ctx || seconds <= 0) return;
    const at = ctx.currentTime;
    if (this.rec(long ? 'riser_long' : 'riser_short', at, { fit: seconds })) return;
    const top = 2 + tierIndex * 0.25;
    for (const [base, g] of [[180, 0.05], [360, 0.035]] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(base, at);
      osc.frequency.exponentialRampToValueAtTime(base * top, at + seconds);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(600, at);
      f.frequency.exponentialRampToValueAtTime(2600, at + seconds);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(g * (0.6 + tierIndex * 0.12), at + seconds * 0.9);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds + 0.05);
      osc.connect(f);
      f.connect(gain);
      gain.connect(this.sfx);
      osc.start(at);
      osc.stop(at + seconds + 0.1);
    }
  }

  /** Silence drop: cut everything for a beat right before a big reveal. */
  silenceDrop(seconds = 0.2): void {
    const ctx = this.live;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0.03, now, 0.015);
    this.master.gain.setTargetAtTime(0.9, now + seconds, 0.01);
  }

  // ------------------------------------------------------------------ the big rare-roll reveal
  /** The screen goes black for a big roll: the music drops out under a deep boom. */
  blackout(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.duckMusic(0.04, 3);
    this.tone(48, at, 1.4, { gain: 0.5, freqEnd: 28 });
    this.noise(at, 0.9, { type: 'lowpass', freq: 500, freqEnd: 120, gain: 0.16, attack: 0.01 });
  }

  /**
   * A heartbeat in the dark (lub-dub), a little higher and louder each beat. A recording also plays a
   * little faster each beat (Kevin: "feel free to speed up"), its lub-dub closing up as the dark goes on.
   */
  heartbeat(beat: number): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    if (this.rec('heartbeat', at, { semis: 2 + Math.min(4, beat), gain: 1 + 0.12 * Math.min(4, beat) })) return;
    const up = 1 + beat * 0.06;
    this.tone(62 * up, at, 0.14, { gain: Math.min(0.62, 0.42 + beat * 0.04), freqEnd: 40 });
    this.tone(56 * up, at + 0.17, 0.12, { gain: 0.3, freqEnd: 38 });
  }

  /** The item rising out of the dark: a shimmering swell. */
  emerge(seconds: number): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    for (const [n, det] of [[72, -6], [76, 6], [79, 0], [84, 4]] as const) {
      this.tone(midi(n), at, seconds, { type: 'triangle', gain: 0.035, attack: seconds * 0.8, detune: det, vibrato: 4 });
    }
    this.noise(at, seconds, { type: 'highpass', freq: 5000, gain: 0.05, attack: seconds * 0.9 });
  }

  /** One tick of the "1 in X" counter; `progress` (0 to 1) raises the pitch. */
  countTick(progress: number): void {
    const ctx = this.live;
    if (!ctx || !this.gate('count', 40)) return;
    this.tone(midi(64 + Math.round(progress * 30)), ctx.currentTime, 0.05, { type: 'square', gain: 0.025, filter: 3200 });
  }

  /** The counter climbs past a rarity tier's odds: a bright chime, higher for rarer tiers. */
  tierPass(tierIndex: number): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    const n = LADDER[Math.min(LADDER.length - 1, 3 + tierIndex)];
    this.bell(midi(n), at, 0.5, 0.065);
    this.bell(midi(n) * 2, at + 0.04, 0.3, 0.03);
  }

  /**
   * A reel lands on a luck token: a leafy shimmer and a chime that climbs with each token in the
   * chain (`step` from 0), brighter for bigger multipliers (`x` = 2, 3, 5, 10).
   */
  token(step: number, x: number): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    // (Kevin: "increase pitch each time it goes up": a recording climbs a step per token in the chain.)
    if (this.rec('token', at, { semis: climb(step) })) return;
    const lift =Math.min(4, step) * 2 + (x >= 10 ? 5 : x >= 5 ? 3 : x >= 3 ? 1 : 0);
    const base = [72, 76, 79, 84].map((n) => n + lift);
    base.forEach((n, k) => this.bell(midi(n), at + k * 0.045, 0.45, 0.06 + step * 0.01));
    this.tone(midi(base[0] - 12), at, 0.35, { type: 'triangle', gain: 0.05 });
    this.noise(at, 0.35, { type: 'highpass', freq: 6000, gain: 0.04, attack: 0.01 });
    if (x >= 5) this.bell(midi(base[3] + 12), at + 0.2, 0.6, 0.045);
  }

  /** The reel spins up again after a token: a quick upward whoosh. */
  respin(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('respin', 120)) return;
    const at = ctx.currentTime;
    this.noise(at, 0.22, { type: 'bandpass', freq: 900, q: 0.8, gain: 0.09, attack: 0.03 });
    this.tone(260, at, 0.2, { type: 'triangle', gain: 0.04, freqEnd: 720 });
  }

  /** The counter lands: a slam, a crash and a chord stab. `level` 0, 1, 2 = big, huge, insane. */
  slam(level: number): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    // (A recording: the same slam, 1.5 dB louder for each size up.)
    if (this.rec('slam', at, { gain: [1, 1.19, 1.41][Math.max(0, Math.min(2, level))] })) return;
    this.tone(52, at, 0.9, { gain: 0.55, freqEnd: 32 });
    this.noise(at, 0.12, { type: 'lowpass', freq: 2400, gain: 0.3 });
    this.noise(at + 0.01, 1.4 + level * 0.5, { type: 'highpass', freq: 4500, gain: 0.07 + level * 0.02, attack: 0.005 });
    for (const n of [60, 67, 72, 76, 79]) this.tone(midi(n), at, 0.6, { type: 'sawtooth', gain: 0.03, filter: 2800, attack: 0.005 });
  }

  /** A big Scrap All haul: a cash-register ka-ching, then coins pouring in (longer for bigger hauls). */
  haul(level: number): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.duckMusic(0.4, 1 + level * 0.6);
    // (A recording: the same haul, 1.5 dB louder for each size up.)
    if (this.rec('haul', at, { gain: [1, 1.19, 1.41][Math.max(0, Math.min(2, level))] })) return;
    this.noise(at, 0.06, { type: 'highpass', freq: 3000, gain: 0.12 });
    this.bell(midi(88), at + 0.05, 0.6, 0.08);
    this.bell(midi(93), at + 0.12, 0.8, 0.07);
    this.coinCascade(at + 0.35, 10 + level * 4);
    if (level >= 1) [72, 76, 79, 84].forEach((n, k) => this.bell(midi(n), at + 0.95 + k * 0.08, 0.5, 0.06));
    if (level >= 2) {
      this.noise(at + 0.3, 1.8, { freq: 1100, q: 0.6, gain: 0.07, attack: 0.4 });
      this.coinCascade(at + 1.4, 12);
    }
  }

  /** Material texture when an item comes out of the bin (variants so repeats differ). */
  material(m: Material, quiet = false): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    const v = quiet ? 0.45 : 1;
    switch (m) {
      case 'plastic':
      case 'paper':
        for (let i = 0; i < 4; i++) {
          this.noise(at + i * (0.02 + this.rnd() * 0.03), 0.03, { type: 'highpass', freq: m === 'paper' ? 2200 : 3200, gain: 0.05 * v });
        }
        break;
      case 'metal':
        for (const p of [1, 2.63, 4.25]) this.tone(this.vary(520) * p, at, 0.35 / p, { gain: (0.06 / p) * v, attack: 0.001 });
        break;
      case 'glass':
        this.bell(this.vary(2600, 0.08), at, 0.3, 0.05 * v);
        this.bell(this.vary(3900, 0.08), at + 0.05, 0.2, 0.03 * v);
        break;
      case 'ceramic':
        this.bell(this.vary(1700, 0.08), at, 0.25, 0.05 * v);
        break;
      case 'food':
        this.noise(at, 0.18, { type: 'lowpass', freq: 900, freqEnd: 250, gain: 0.08 * v, attack: 0.02 });
        this.tone(this.vary(160), at, 0.16, { gain: 0.06 * v, freqEnd: 90, vibrato: 18 });
        break;
      case 'cloth':
        this.noise(at, 0.16, { freq: 800, q: 0.8, gain: 0.05 * v, attack: 0.04 });
        break;
      case 'wood':
        this.tone(this.vary(230), at, 0.1, { gain: 0.12 * v, freqEnd: 180 });
        this.noise(at, 0.05, { freq: 650, q: 3, gain: 0.06 * v });
        break;
      case 'rubber':
        this.tone(this.vary(900), at, 0.14, { gain: 0.05 * v, freqEnd: 1400, vibrato: 25 });
        break;
    }
  }

  /** The reveal sting: each rarity tier gets its own, one step more epic than the last. */
  reveal(tier: Tier): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    const i = TIERS.indexOf(tier);
    if (i >= 3) this.duckMusic(0.35, 0.4 + i * 0.35);
    switch (tier) {
      case 'junk':
        this.noise(at, 0.14, { type: 'lowpass', freq: 1100, gain: 0.08 });
        this.tone(230, at, 0.14, { gain: 0.06, freqEnd: 150 });
        break;
      case 'decent':
        this.bell(midi(76), at, 0.45, 0.08);
        break;
      case 'shiny':
        this.bell(midi(72), at, 0.45, 0.08);
        this.bell(midi(79), at + 0.1, 0.55, 0.08);
        break;
      case 'epic':
        [72, 76, 79, 84].forEach((n, k) => this.bell(midi(n), at + k * 0.07, 0.6, 0.075));
        this.tone(65, at, 0.45, { gain: 0.32, freqEnd: 45 });
        break;
      default: {
        // Legendary and up: orchestral hit, choir pad, sparkles and a coin cascade. Each tier past
        // Legendary adds a step (`lvl`), so the rarest tiers stay big without dragging on forever.
        const lvl = Math.min(6, i - 4);
        this.tone(55, at, 0.7, { gain: 0.42, freqEnd: 38 });
        this.noise(at, 0.35, { type: 'lowpass', freq: 1800, gain: 0.2 });
        for (const n of [60, 64, 67, 72]) this.tone(midi(n), at, 0.4, { type: 'sawtooth', gain: 0.035, filter: 2400 });
        const padLen = 1.6 + lvl * 0.5;
        for (const n of [60, 64, 67, 72, 76]) {
          for (const det of [-8, 8]) {
            this.tone(midi(n), at + 0.05, padLen, { type: 'sawtooth', gain: 0.018, attack: 0.2, filter: 1600, detune: det, vibrato: 3 });
          }
        }
        for (let k = 0; k < 10 + lvl * 4; k++) {
          this.bell(midi(LADDER[6 + Math.floor(this.rnd() * 9)]), at + 0.15 + k * 0.08, 0.4, 0.04);
        }
        this.coinCascade(at + 0.3, Math.min(15, 8 + lvl * 2));
        if (lvl >= 1) {
          // Mythic and up: a crowd cheer swell and a longer rising run.
          this.noise(at + 0.2, 1.8, { freq: 1100, q: 0.6, gain: 0.08, attack: 0.5 });
          [72, 74, 76, 79, 81, 84, 86, 88, 91, 96].forEach((n, k) => this.bell(midi(n), at + 0.4 + k * 0.06, 0.5, 0.05));
        }
        if (i >= MINT) {
          // Mint in Box and up: a fanfare in rhythm.
          [67, 72, 76, 79].forEach((n, k) =>
            this.tone(midi(n), at + 0.9 + k * 0.16, 0.22, { type: 'sawtooth', gain: 0.06, filter: 2200, attack: 0.02 }),
          );
          for (const n of [72, 76, 79, 84]) this.tone(midi(n), at + 1.6, 1.3, { type: 'sawtooth', gain: 0.045, filter: 2600, attack: 0.03, vibrato: 4 });
          this.noise(at + 1.6, 1.2, { type: 'highpass', freq: 6000, gain: 0.05 });
        }
      }
    }
  }

  /** Compressed reveal for auto-dives: a quick pop in the item's rarity. */
  autoPop(tier: Tier): void {
    const ctx = this.live;
    if (!ctx || !this.gate('autopop', 120)) return;
    const at = ctx.currentTime;
    const i = TIERS.indexOf(tier);
    this.tone(320 + i * 60, at, 0.06, { gain: 0.06, freqEnd: 520 + i * 90 });
    if (i >= 1) this.bell(midi(LADDER[3 + i]), at + 0.03, 0.25, 0.035 + i * 0.008);
  }

  // ------------------------------------------------------------------ combat
  /**
   * A blow lands. `combo` (blows in a row, from 0) raises it a semitone a blow, up to an octave, so a
   * flurry climbs (pitch stacking).
   */
  hit(crit: boolean, combo = 0): void {
    const ctx = this.live;
    if (!ctx || !this.gate('hit', 45)) return;
    const at = ctx.currentTime;
    const c = Math.min(12, Math.max(0, combo));
    const up = Math.pow(2, c / 12);
    // A recording climbs half as far (6 semitones at most), so a solid whack stays solid, with a hair of
    // random pitch; a crit is the same whack, harder, with the ring on top.
    if (this.rec('hit', at, { semis: c / 2 + (this.rnd() * 2 - 1) * 0.3, gain: crit ? 1.4 : 1 })) {
      if (crit) this.bell(this.vary(1900, 0.04) * up, at + 0.01, 0.25, 0.05);
      return;
    }
    this.noise(at, 0.05, { freq: this.vary(1500, 0.15) * up, q: 1.2, gain: crit ? 0.16 : 0.1 });
    this.tone(this.vary(150) * up, at, 0.09, { gain: crit ? 0.24 : 0.16, freqEnd: 70 * up });
    if (crit) this.bell(this.vary(1900, 0.04) * up, at + 0.01, 0.25, 0.05);
  }

  hurt(heavy: boolean): void {
    const ctx = this.live;
    if (!ctx || !this.gate('hurt', 60)) return;
    const at = ctx.currentTime;
    this.tone(this.vary(115), at, heavy ? 0.3 : 0.14, { gain: heavy ? 0.32 : 0.16, freqEnd: 55 });
    this.noise(at, heavy ? 0.2 : 0.07, { type: 'lowpass', freq: 500, gain: heavy ? 0.16 : 0.07 });
  }

  dodge(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('dodge', 80)) return;
    this.noise(ctx.currentTime, 0.16, { freq: 500, freqEnd: 3200, q: 1.5, gain: 0.07, attack: 0.03 });
  }

  /**
   * Cartoon pop when an enemy flies off, plus coin tinks that climb the scale. `streak` (kills so far
   * in the wave, from 0) lifts the pop up the scale and rings a note one step higher each kill, so a
   * wave's kills climb. `coins` false leaves the tinks out (the battle plays one per coin as it lands
   * on the counter).
   */
  kill(big: boolean, streak = 0, coins = true): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    const s = Math.min(7, Math.max(0, streak));
    // Several at once (a blast) pop once.
    if (this.gate('kill', 40)) {
      const up = Math.pow(2, (LADDER[Math.min(5, s)] - LADDER[0]) / 12);
      this.tone(this.vary(320) * up, at, 0.09, { gain: 0.1, freqEnd: 950 * up });
      this.noise(at, 0.06, { type: 'lowpass', freq: 1400, gain: 0.05 });
      if (streak > 0) this.bell(midi(LADDER[3 + s]), at + 0.03, 0.3, 0.04);
    }
    if (big) {
      this.tone(50, at, 0.8, { gain: 0.4, freqEnd: 32 });
      this.noise(at, 0.5, { type: 'lowpass', freq: 900, gain: 0.18 });
      if (coins) this.coinCascade(at + 0.15, 14);
    } else if (coins) {
      this.coin();
    }
  }

  /** Pitch stacking: each coin in a chain plays one step higher, then resets after a pause. */
  coin(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('coin', 50)) return;
    const now = performance.now();
    if (now - this.lastCoinAt > 1400) this.coinStack = 0;
    this.lastCoinAt = now;
    const note = LADDER[Math.min(LADDER.length - 1, 5 + this.coinStack)];
    this.coinStack = Math.min(this.coinStack + 1, 10);
    this.bell(midi(note) * 2, ctx.currentTime + 0.02, 0.18, 0.035);
  }

  /**
   * A coin from the battle lands on the gold counter: a tink a step up the scale from the last one, so a
   * burst climbs (coin 1, coin 2, coin 3...) and the next kill's coins start over after a short pause.
   * `kaching` rings the big ka-ching after it (the last coin of a boss's burst).
   */
  coinLand(kaching = false): void {
    const ctx = this.live;
    if (!ctx) return;
    if (kaching) this.kaChing(ctx.currentTime + 0.07);
    const now = performance.now();
    if (now - this.lastLandAt > 600) this.landStack = 0;
    this.lastLandAt = now;
    const step = this.landStack;
    this.landStack = Math.min(this.landStack + 1, 7);
    if (!this.gate('coinLand', 40)) return;
    this.bell(midi(LADDER[5 + step]) * 2, ctx.currentTime + 0.01, 0.16, 0.032);
  }

  /** XP reaches the XP bar: a soft upward blip. */
  xpTick(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('xp', 80)) return;
    this.tone(midi(79), ctx.currentTime, 0.09, { type: 'triangle', gain: 0.035, freqEnd: midi(91) });
  }

  private coinCascade(at: number, n: number) {
    for (let k = 0; k < n; k++) this.bell(midi(LADDER[Math.min(LADDER.length - 1, 4 + k)]) * 2, at + k * 0.045, 0.15, 0.03);
    // ...finished with one big ka-ching.
    this.kaChing(at + n * 0.045 + 0.05);
  }

  private kaChing(at: number) {
    this.bell(midi(84) * 2, at, 0.5, 0.06);
    this.noise(at, 0.1, { type: 'highpass', freq: 5000, gain: 0.05 });
  }

  bag(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('bag', 120)) return;
    const at = ctx.currentTime;
    this.tone(170, at, 0.12, { gain: 0.12, freqEnd: 95 });
    for (let i = 0; i < 3; i++) this.noise(at + 0.02 + i * 0.03, 0.03, { type: 'highpass', freq: 3000, gain: 0.03 });
  }

  /** The signature 3-note motif; longer versions for bigger wins. */
  jingle(len: 3 | 5 = 3): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    if (this.rec(len === 3 ? 'jingle' : 'jingle_long', at)) return;
    const notes = len === 3 ? [67, 72, 76] : [67, 72, 76, 79, 84];
    notes.forEach((n, k) => {
      this.bell(midi(n), at + k * 0.09, 0.5, 0.07);
      this.tone(midi(n), at + k * 0.09, 0.3, { type: 'triangle', gain: 0.04 });
    });
  }

  levelUp(level: number): void {
    if (!this.live) return;
    this.duckMusic(0.5, 0.5);
    this.jingle(level % 10 === 0 ? 5 : 3);
  }

  bossWarn(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('warn', 300)) return;
    const at = ctx.currentTime;
    this.tone(220, at, 0.14, { type: 'square', gain: 0.05, filter: 1200 });
    this.tone(220, at + 0.18, 0.14, { type: 'square', gain: 0.05, filter: 1200 });
  }

  bossIntro(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.tone(48, at, 0.9, { gain: 0.4, freqEnd: 36 });
    this.noise(at, 0.6, { type: 'lowpass', freq: 700, gain: 0.15 });
    this.tone(midi(45), at + 0.05, 0.8, { type: 'sawtooth', gain: 0.04, filter: 900 });
  }

  death(): void {
    const ctx = this.live;
    if (!ctx) return;
    this.tone(440, ctx.currentTime, 0.7, { type: 'triangle', gain: 0.08, freqEnd: 110 });
  }

  stageClear(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    [72, 76, 79].forEach((n, k) => this.bell(midi(n), at + k * 0.06, 0.35, 0.045));
  }

  bossWin(): void {
    if (!this.live) return;
    this.duckMusic(0.4, 1);
    this.jingle(5);
  }

  /** A bright ding when a timer finishes. */
  ding(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.bell(midi(84), at, 0.8, 0.07);
    this.bell(midi(88), at + 0.08, 0.8, 0.06);
  }

  /**
   * Gear leaps out of its tile to fly to the raccoon: a pop, then a rising whoosh and a glissando that
   * climbs higher for rarer gear (`tier`: 0 Junk to 12 Holy Grail).
   */
  equipLift(tier: number): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.tone(520, at, 0.07, { type: 'square', gain: 0.06, freqEnd: 900, filter: 3000 });
    this.noise(at + 0.03, 0.3, { type: 'bandpass', freq: 500, freqEnd: 2600 + tier * 200, q: 1.1, gain: 0.05 + tier * 0.004, attack: 0.12 });
    this.tone(midi(60 + Math.min(12, tier)), at + 0.05, 0.32, { type: 'triangle', gain: 0.03, freqEnd: midi(72 + Math.min(12, tier)), attack: 0.06 });
  }

  /**
   * The power count after an equip, one tick per step (`progress` 0 to 1 climbs the pitch; `up` false
   * falls instead, for a worse item).
   */
  powerTick(progress: number, up: boolean): void {
    const ctx = this.live;
    if (!ctx || !this.gate('powerTick', 45)) return;
    const n = up ? 67 + Math.round(progress * 24) : 72 - Math.round(progress * 12);
    this.tone(midi(n), ctx.currentTime, 0.05, { type: 'square', gain: 0.03, filter: 3600 });
  }

  /** The power count lands: a bright rising arpeggio and a sparkle (up), or a short sag (down). */
  powerLanded(up: boolean): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    if (!up) {
      this.tone(330, at, 0.22, { type: 'triangle', gain: 0.06, freqEnd: 196 });
      return;
    }
    [72, 76, 79, 84, 88].forEach((n, k) => this.bell(midi(n), at + k * 0.055, 0.5, 0.06));
    this.noise(at + 0.1, 0.5, { type: 'highpass', freq: 6500, gain: 0.03, attack: 0.04 });
  }

  /** Gear starts dropping onto the raccoon: a falling whoosh, longer and brighter for rarer gear. */
  equipDrop(tier: number): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.noise(at, 0.24, { type: 'bandpass', freq: 700 + tier * 120, freqEnd: 2400 + tier * 300, q: 0.9, gain: 0.06 + tier * 0.006, attack: 0.05 });
    if (tier >= 4) this.tone(midi(84 + Math.min(12, tier)), at, 0.25, { type: 'triangle', gain: 0.03, freqEnd: midi(72) });
  }

  /**
   * Gear slams onto the raccoon: a thump and a clank, then a chime that climbs with rarity (`tier` is
   * the rarity index, 0 Junk to 12 Holy Grail). Legendary and up add a chord and a shimmer.
   */
  equipImpact(tier: number): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.tone(110, at, 0.22, { gain: 0.32 + Math.min(0.2, tier * 0.02), freqEnd: 42 });
    this.noise(at, 0.07, { type: 'highpass', freq: 2200, gain: 0.12 + tier * 0.006 });
    this.noise(at, 0.12, { freq: 900, q: 1.4, gain: 0.08 });
    const notes = Math.min(6, 1 + Math.floor(tier / 2));
    for (let k = 0; k < notes; k++) this.bell(midi(LADDER[Math.min(LADDER.length - 1, 2 + tier + k)]), at + 0.04 + k * 0.06, 0.45, 0.05 + tier * 0.004);
    if (tier >= 4) {
      this.duckMusic(0.5, 0.6);
      for (const n of [60, 64, 67, 72]) this.tone(midi(n + Math.min(7, tier - 4)), at + 0.05, 0.7, { type: 'sawtooth', gain: 0.022, filter: 2600, attack: 0.01 });
      this.noise(at + 0.08, 0.9, { type: 'highpass', freq: 6000, gain: 0.035, attack: 0.05 });
    }
    if (tier >= 7) this.slam(Math.min(2, tier - 7));
  }

  equip(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.noise(at, 0.04, { freq: 2600, q: 3, gain: 0.08 });
    this.tone(330, at, 0.1, { gain: 0.1, freqEnd: 660 });
  }

  recycle(auto: boolean): void {
    const ctx = this.live;
    if (!ctx || !this.gate('recycle', auto ? 200 : 60)) return;
    this.noise(ctx.currentTime, 0.14, { freq: 1200, freqEnd: 300, q: 1, gain: auto ? 0.025 : 0.06, attack: 0.02 });
  }

  collect(): void {
    if (!this.live) return;
    this.coinCascade(this.ctx!.currentTime, 12);
  }

  // ------------------------------------------------------------------ title screen
  /**
   * PLAY on the title screen: a punchy press, a run up the chord with sparkles on top, and the music
   * held back under it so it swells in as the game appears. The press is also the tap that unlocks
   * audio, so this plays as soon as the audio it starts is running.
   */
  titleStart(): void {
    this.whenRunning((ctx) => {
      const at = ctx.currentTime;
      this.duckMusic(0.2, 1.4);
      if (this.rec('title_start', at)) return;
      this.tone(150, at, 0.16, { gain: 0.34, freqEnd: 58 });
      this.noise(at, 0.035, { freq: 2800, q: 2, gain: 0.09 });
      this.tone(midi(48), at + 0.03, 0.55, { type: 'triangle', gain: 0.09 });
      [72, 76, 79, 84].forEach((n, k) => this.bell(midi(n), at + 0.04 + k * 0.055, 0.6, 0.075));
      this.noise(at + 0.06, 0.5, { type: 'highpass', freq: 6500, gain: 0.045, attack: 0.02 });
      [88, 91, 96].forEach((n, k) => this.bell(midi(n), at + 0.3 + k * 0.05, 0.35, 0.03));
    });
  }

  /** The raccoon hops on the title screen: a cartoon boing. */
  titleHop(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.tone(280, at, 0.18, { gain: 0.09, freqEnd: 760 });
    this.tone(140, at, 0.16, { type: 'square', gain: 0.025, freqEnd: 380, filter: 1800 });
  }

  /** The title's iris closing on the raccoon (a whoosh down) or opening on the game (a lighter one up). */
  titleIris(open: boolean): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    if (open) {
      this.noise(at, 0.4, { type: 'bandpass', freq: 400, freqEnd: 2600, q: 0.9, gain: 0.05, attack: 0.06 });
      return;
    }
    this.noise(at, 0.6, { type: 'bandpass', freq: 2600, freqEnd: 240, q: 0.9, gain: 0.08, attack: 0.1 });
    this.tone(220, at + 0.1, 0.5, { type: 'triangle', gain: 0.04, freqEnd: 70 });
  }

  /**
   * Runs `play` once audio is running: now, or when the context this same tap is starting comes up
   * (and the recordings, if still decoding, are ready or a moment has passed).
   */
  private whenRunning(play: (ctx: AudioContext) => void): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'running' && (this.loaded || !this.loading)) {
      play(ctx);
      return;
    }
    const asked = performance.now();
    const ready = Promise.race([this.loading, new Promise((r) => setTimeout(r, 250))]);
    Promise.all([ctx.resume(), ready]).then(
      () => {
        // Much later it would no longer go with what it was for.
        if (ctx.state === 'running' && performance.now() - asked < 400) play(ctx);
      },
      () => {},
    );
  }

  // ------------------------------------------------------------------ heists
  /** A heist starts: four plucks creeping up on tiptoe, then a bright arpeggio (let's go). */
  heistStart(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.duckMusic(0.35, 1.4);
    [52, 53, 54, 55].forEach((n, k) => {
      const t0 = at + k * 0.15 + (k % 2) * 0.03;
      this.tone(midi(n), t0, 0.12, { type: 'triangle', gain: 0.13, filter: 900 });
      this.noise(t0, 0.02, { type: 'highpass', freq: 5000, gain: 0.02 });
    });
    this.tone(midi(48), at + 0.68, 0.5, { type: 'sawtooth', gain: 0.04, filter: 1200 });
    [72, 76, 79, 84].forEach((n, k) => this.bell(midi(n), at + 0.68 + k * 0.07, 0.6, 0.06));
  }

  /** A stop is revealed: a card flip, then a short motif for what it is. */
  heistNode(kind: string): void {
    const ctx = this.live;
    if (!ctx || !this.gate('heistNode', 120)) return;
    const at = ctx.currentTime;
    this.noise(at, 0.05, { type: 'bandpass', freq: 2400, freqEnd: 900, q: 1.2, gain: 0.06 });
    const t1 = at + 0.06;
    switch (kind) {
      case 'fight':
      case 'elite': {
        // Two low stabs; an elite's second one is a half step up.
        const low = kind === 'elite' ? 45 : 50;
        this.tone(midi(low), t1, 0.16, { type: 'square', gain: 0.05, filter: 1100 });
        this.tone(midi(low + (kind === 'elite' ? 1 : 0)), t1 + 0.13, 0.2, { type: 'square', gain: 0.05, filter: 1100 });
        break;
      }
      case 'choice':
        // "Hmm?"
        this.tone(midi(67), t1, 0.14, { type: 'triangle', gain: 0.07 });
        this.tone(midi(71), t1 + 0.12, 0.24, { type: 'triangle', gain: 0.07, freqEnd: midi(72) });
        break;
      case 'treasure':
      case 'golden':
        [76, 79, 84, 88].forEach((n, k) => this.bell(midi(n), t1 + k * 0.05, 0.4, kind === 'golden' ? 0.07 : 0.05));
        if (kind === 'golden') this.coinCascade(t1 + 0.25, 8);
        break;
      case 'shop':
        // Ka-ching.
        this.noise(t1, 0.05, { type: 'highpass', freq: 3000, gain: 0.08 });
        this.bell(midi(88), t1 + 0.04, 0.5, 0.06);
        this.bell(midi(93), t1 + 0.1, 0.6, 0.05);
        break;
      case 'shrine':
        // A hum with a shimmer on top.
        this.tone(midi(60), t1, 0.9, { gain: 0.06, attack: 0.15, vibrato: 4 });
        this.tone(midi(67), t1, 0.9, { gain: 0.04, attack: 0.2, vibrato: 3 });
        this.noise(t1 + 0.1, 0.7, { type: 'highpass', freq: 6000, gain: 0.025, attack: 0.2 });
        break;
      case 'trap':
        // Uh-oh.
        this.tone(midi(64), t1, 0.14, { type: 'square', gain: 0.05, filter: 1400 });
        this.tone(midi(58), t1 + 0.15, 0.3, { type: 'square', gain: 0.05, filter: 1400, freqEnd: midi(55) });
        break;
      case 'wheel':
        // A ratchet, then a bell.
        for (let k = 0; k < 6; k++) this.noise(t1 + k * 0.045, 0.02, { freq: 3200, q: 4, gain: 0.04 });
        this.bell(midi(84), t1 + 0.3, 0.4, 0.05);
        break;
      case 'boss':
        this.bossIntro();
        break;
    }
  }

  /** A perk picked: a sweep up into a chord; an evolution adds a shimmer and a run of bells. */
  heistPerk(evolution: boolean): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.tone(midi(60), at, 0.25, { type: 'triangle', gain: 0.05, freqEnd: midi(84) });
    for (const n of [72, 76, 79]) this.tone(midi(n), at + 0.12, 0.45, { type: 'sawtooth', gain: 0.025, filter: 2400, attack: 0.01 });
    this.bell(midi(84), at + 0.14, 0.5, 0.06);
    if (evolution) {
      this.duckMusic(0.4, 1);
      this.noise(at + 0.1, 1, { type: 'highpass', freq: 6000, gain: 0.04, attack: 0.1 });
      [79, 84, 88, 91].forEach((n, k) => this.bell(midi(n), at + 0.3 + k * 0.08, 0.6, 0.05));
    }
  }

  /** A curse lands (a low wobble) or washes off (a light ding). */
  heistCurse(removed: boolean): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    if (removed) {
      this.bell(midi(79), at, 0.4, 0.05);
      this.bell(midi(84), at + 0.07, 0.5, 0.05);
      return;
    }
    this.tone(midi(47), at, 0.6, { type: 'sawtooth', gain: 0.05, filter: 700, vibrato: 7, freqEnd: midi(44) });
  }

  /** A hit blocked by Lid Shield or Fortress of Junk: a trash-can-lid clang. */
  heistBlock(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('heistBlock', 90)) return;
    const at = ctx.currentTime;
    this.noise(at, 0.08, { freq: 3400, q: 6, gain: 0.09 });
    this.tone(1180, at, 0.25, { type: 'square', gain: 0.025, filter: 4000, freqEnd: 1100 });
    this.tone(1720, at, 0.2, { gain: 0.03 });
  }

  /** A crew helper's peck or bottle: a small tick. */
  heistHelper(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('heistHelper', 70)) return;
    const at = ctx.currentTime;
    this.tone(this.vary(1500, 0.08), at, 0.04, { type: 'square', gain: 0.03, filter: 3000 });
  }

  /** A clean getaway: two pickup notes, the chord, bells and a coin shower. */
  heistWin(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.duckMusic(0.3, 2);
    this.tone(midi(67), at, 0.12, { type: 'square', gain: 0.05, filter: 2200 });
    this.tone(midi(67), at + 0.13, 0.12, { type: 'square', gain: 0.05, filter: 2200 });
    for (const n of [72, 76, 79, 84]) this.tone(midi(n), at + 0.28, 0.9, { type: 'sawtooth', gain: 0.03, filter: 2600, attack: 0.01 });
    this.tone(midi(48), at + 0.28, 0.9, { type: 'triangle', gain: 0.1 });
    [72, 76, 79, 84, 88].forEach((n, k) => this.bell(midi(n), at + 0.3 + k * 0.08, 0.6, 0.06));
    this.coinCascade(at + 0.8, 12);
  }

  /** Busted: a sad trombone, four notes sliding down, the last one wobbling. */
  heistLose(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.duckMusic(0.3, 2);
    [55, 54, 53, 52].forEach((n, k) => {
      const last = k === 3;
      this.tone(midi(n), at + k * 0.32, last ? 0.9 : 0.3, {
        type: 'sawtooth', gain: 0.06, filter: 900, attack: 0.03, vibrato: last ? 6 : undefined, freqEnd: last ? midi(n - 1) : undefined,
      });
    });
  }

  /** A heist ticket comes in: a paper tear and a ding. */
  heistTicket(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('heistTicket', 200)) return;
    const at = ctx.currentTime;
    this.noise(at, 0.09, { type: 'bandpass', freq: 3800, freqEnd: 1800, q: 0.8, gain: 0.06 });
    this.bell(midi(84), at + 0.08, 0.4, 0.05);
  }

  // ------------------------------------------------------------------ music
  private syncMusic() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.musicOn && ctx.state === 'running') {
      if (!this.musicTimer) {
        this.nextStep = ctx.currentTime + 0.1;
        this.step = 0;
        this.musicTimer = setInterval(() => this.schedule(), 25);
      }
    } else if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const eighth = 60 / BPM / 2;
    while (this.nextStep < ctx.currentTime + 0.15) {
      const swing = this.step % 2 === 1 ? eighth * 0.16 : 0;
      this.playStep(this.step, this.nextStep + swing);
      this.nextStep += eighth;
      this.step = (this.step + 1) % 32;
    }
  }

  private playStep(s: number, at: number) {
    const bus = this.musicBus;
    const bar = Math.floor(s / 8);
    const pos = s % 8;
    const chord = CHORDS[bar];
    // Electric-piano chords: on the one, a lazy push on the "and" of two.
    if (pos === 0 || pos === 3) {
      const vel = pos === 0 ? 0.03 : 0.018;
      for (const n of chord) {
        const det = (this.rnd() * 2 - 1) * 6;
        this.tone(midi(n + 12), at, 1.5, { type: 'triangle', gain: vel, attack: 0.012, filter: 1700, detune: det, bus });
        this.tone(midi(n + 24), at, 0.6, { type: 'sine', gain: vel * 0.25, attack: 0.008, bus });
      }
    }
    // Bass.
    if (pos === 0 || pos === 4) this.tone(midi(ROOTS[bar] + (pos === 4 ? 7 : 0) + 12), at, 0.7, { type: 'sine', gain: 0.11, attack: 0.01, bus });
    // Kick, snare, hats.
    if (pos === 0 || pos === 5) this.tone(115, at, 0.22, { gain: 0.22, freqEnd: 42, bus });
    if (pos === 2 || pos === 6) {
      this.noise(at + 0.01, 0.16, { freq: 1700, q: 0.8, gain: 0.05, bus });
      this.noise(at + 0.01, 0.05, { type: 'lowpass', freq: 600, gain: 0.03, bus });
    }
    this.noise(at, 0.03, { type: 'highpass', freq: 7500, gain: pos % 2 === 0 ? 0.018 : 0.011, bus });
    // A sparse pentatonic melody, different each loop.
    if ((pos === 1 || pos === 3 || pos === 5) && this.rnd() < 0.3) {
      this.bell(midi(LADDER[5 + Math.floor(this.rnd() * 6)]), at, 0.6, 0.02, bus);
    }
    // Vinyl crackle.
    for (let i = 0; i < 2; i++) {
      if (this.rnd() < 0.5) this.noise(at + this.rnd() * 0.3, 0.004, { type: 'highpass', freq: 3000, gain: 0.02 + this.rnd() * 0.02, bus });
    }
  }
}

export const audio = new AudioEngine();
