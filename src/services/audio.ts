/**
 * Procedural sound and music with the Web Audio API: no audio files, everything is synthesized.
 * Rewards are tuned to the music's key (C major) so wins sound like the song resolving
 * (Dopamine Playbook). Audio starts on the first tap (browsers require a user gesture).
 */

export type Material = 'plastic' | 'metal' | 'glass' | 'ceramic' | 'food' | 'cloth' | 'paper' | 'wood' | 'rubber';
export type Tier =
  | 'junk' | 'decent' | 'shiny' | 'epic' | 'legendary' | 'mythic' | 'vintage' | 'limited' | 'prototype' | 'mint' | 'gemMint' | 'museum' | 'grail';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
/** C major pentatonic ladder used for pitch stacking and reward notes. */
const LADDER = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
const TIERS: Tier[] = ['junk', 'decent', 'shiny', 'epic', 'legendary', 'mythic', 'vintage', 'limited', 'prototype', 'mint', 'gemMint', 'museum', 'grail'];
const MINT = TIERS.indexOf('mint');

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
  private lastPlayed = new Map<string, number>();
  private seed = 0x5eed;

  private rnd(): number {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
  /** Button pop with a slightly random pitch so it never grates. */
  tap(): void {
    const ctx = this.live;
    if (!ctx || !this.gate('tap', 40)) return;
    const at = ctx.currentTime;
    this.tone(this.vary(560), at, 0.07, { gain: 0.09, freqEnd: this.vary(820) });
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

  /** The dumpster lid clunk on a manual dive. */
  lidClunk(): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.tone(100, at, 0.28, { gain: 0.32, freqEnd: 52 });
    this.noise(at, 0.1, { freq: 2300, q: 5, gain: 0.1 });
    this.tone(410, at, 0.12, { type: 'square', gain: 0.025, filter: 1400 });
  }

  /** One rattle beat: each beat shakes louder and higher than the last. */
  rattle(beat: number, beats: number, heartbeat: boolean): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    const k = (beat + 1) / beats;
    this.noise(at, 0.07, { freq: 1900 + beat * 320, q: 6, gain: 0.05 + 0.1 * k });
    this.tone(150 + beat * 28, at, 0.06, { type: 'square', gain: 0.02 + 0.03 * k, filter: 1300 });
    if (heartbeat) this.tone(62, at, 0.2, { gain: 0.28, freqEnd: 40 });
  }

  /** A rising tone under the build-up that seems to keep climbing (Shepard-style pair). */
  riser(seconds: number, tierIndex: number): void {
    const ctx = this.live;
    if (!ctx || seconds <= 0) return;
    const at = ctx.currentTime;
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

  /** A heartbeat in the dark (lub-dub), a little higher and louder each beat. */
  heartbeat(beat: number): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
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
    const lift = Math.min(4, step) * 2 + (x >= 10 ? 5 : x >= 5 ? 3 : x >= 3 ? 1 : 0);
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
  hit(crit: boolean): void {
    const ctx = this.live;
    if (!ctx || !this.gate('hit', 45)) return;
    const at = ctx.currentTime;
    this.noise(at, 0.05, { freq: this.vary(1500, 0.15), q: 1.2, gain: crit ? 0.16 : 0.1 });
    this.tone(this.vary(150), at, 0.09, { gain: crit ? 0.24 : 0.16, freqEnd: 70 });
    if (crit) this.bell(this.vary(1900, 0.04), at + 0.01, 0.25, 0.05);
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

  /** Cartoon pop when an enemy flies off, plus coin tinks that climb the scale. */
  kill(big: boolean): void {
    const ctx = this.live;
    if (!ctx) return;
    const at = ctx.currentTime;
    this.tone(this.vary(320), at, 0.09, { gain: 0.1, freqEnd: 950 });
    this.noise(at, 0.06, { type: 'lowpass', freq: 1400, gain: 0.05 });
    if (big) {
      this.tone(50, at, 0.8, { gain: 0.4, freqEnd: 32 });
      this.noise(at, 0.5, { type: 'lowpass', freq: 900, gain: 0.18 });
      this.coinCascade(at + 0.15, 14);
    } else {
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

  private coinCascade(at: number, n: number) {
    for (let k = 0; k < n; k++) this.bell(midi(LADDER[Math.min(LADDER.length - 1, 4 + k)]) * 2, at + k * 0.045, 0.15, 0.03);
    // ...finished with one big ka-ching.
    const end = at + n * 0.045 + 0.05;
    this.bell(midi(84) * 2, end, 0.5, 0.06);
    this.noise(end, 0.1, { type: 'highpass', freq: 5000, gain: 0.05 });
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
