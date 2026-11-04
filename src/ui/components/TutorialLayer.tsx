/**
 * The first-run tutorial (new games only; see BAL.tutorial and dumpster.beginner in core). Quick
 * steps, each paid off with as much fanfare as the game has:
 *  - The dumpster starts padlocked under steel: the hand taps the padlock (DumpsterLock), the metal
 *    falls off, and it rolls the first item by itself: the Traffic Cone of Destiny, with the big reveal.
 *  1. Put it on: a pointing hand carries a ghost of it from its tile up to the raccoon, over and over,
 *     until you drag it there (then the equip slam and the power count). If it isn't on screen, the
 *     hand points at the Bag tab.
 *  2. Equip best: the hand taps the button (or the Bag tab first) and everything better slams on.
 *  3. Beginner's luck: a little later the reels chain two luck tokens into a Limited Edition hat (the
 *     big reveal calls it beginner's luck). Put it on and the tutorial ends: a full-screen celebration
 *     and a gem gift.
 * A bubble over the bottom of the battle says what to do, with three pips that light up (and chime,
 * a step higher each time) as the steps are done. Everything moves in whole art pixels.
 *
 * Everything else starts locked and opens one feature at a time (core/systems/features.ts): when one
 * opens, a gold NEW bubble says what it is and the hand points at its tab or button until it is
 * tapped (or its moment passes), then the next one gets its turn (ui/features.ts).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { bestUpgrades, type CoreEvent, type Feature, type GameState } from '../../core';
import { BAL } from '../../data';
import { bus } from '../../app/eventBus';
import { useGame } from '../../app/store';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { slamPoint } from '../../render/equipSlam';
import { itemArt, UI_PX } from '../../render/icons';
import { equipSourceOf } from '../equipSource';
import { introFeature, seeFeature } from '../features';
import { stagePoint } from '../drag';
import { t } from '../i18n';
import { raysUrl } from '../rays';
import { stageSize, useUi } from '../uiStore';
import { GemIcon, HandIcon } from './Icons';
import { PixelArt } from './PixelArt';
import s from './tutorial.module.css';

type Step = 'open' | 'roll' | 'best' | 'fight' | 'lucky';

const snap = (v: number) => Math.round(v / UI_PX) * UI_PX;

/** Where the tutorial is, from the game itself (nothing extra is saved): null when it's over. */
function stepOf(g: GameState): { step: Step | null; uid: number | null } {
  const b = g.dumpster.beginner;
  if (b.state === 'done') return { step: null, uid: null };
  if (!g.features.unlocked.includes('roll')) return { step: 'open', uid: null };
  const worn = g.lifetime.itemsEquipped > 0;
  // The warm-up spins and the tutorial's own find rolling in (Kevin: "get them accustomed a bit first").
  const findIn = worn || g.inventory.some((x) => x.baseId === BAL.dumpster.tutorialItem.baseId);
  if (!g.dumpster.firstDiveDone || !findIn) return { step: 'roll', uid: null };
  // Its find (and the warm-up's) go on with Equip best, no dragging (Kevin: "just take them to equip best").
  if (!worn) return { step: 'best', uid: null };
  // Beginner's luck: once its item has landed in the bag, put it on (Equip best again).
  if (b.state === 'rolled' && g.inventory.some((x) => x.uid === b.uid)) return { step: 'lucky', uid: null };
  // Then wear the best of the rest at once (done for good after a few items have gone on).
  if (g.lifetime.itemsEquipped < 3 && bestUpgrades(g).length >= 2) return { step: 'best', uid: null };
  return { step: 'fight', uid: null };
}

/** How many of the three steps are done. */
function doneCount(step: Step): number {
  // Bust the dumpster open, dress him with Equip best, put beginner's luck on.
  return step === 'open' ? 0 : step === 'roll' || step === 'best' ? 1 : 2;
}

/** A nav tab's button. */
const navTab = (tab: string) => `nav button[aria-label="${t(`tab.${tab}`)}"]`;

/**
 * Where the hand points to introduce each feature (a button on the Roll tab falls back to the Roll
 * tab while another tab is open), and how long the introduction waits for a tap before moving on.
 * (Luck and the Codex open quietly, features.ts, so theirs only matter for odd old saves.)
 */
const INTRO: Record<Exclude<Feature, 'roll'>, { target: string; fallback?: string; ms: number }> = {
  bag: { target: navTab('bag'), ms: 30_000 },
  luck: { target: '[data-intro="luck"]', fallback: navTab('alley'), ms: 12_000 },
  upgrades: { target: navTab('upgrades'), ms: 30_000 },
  worlds: { target: navTab('worlds'), ms: 30_000 },
  codex: { target: '[data-intro="codex"]', fallback: navTab('alley'), ms: 12_000 },
  dumpster: { target: '[data-intro="dumpster"]', fallback: navTab('alley'), ms: 15_000 },
  rebirth: { target: navTab('rebirth'), ms: 30_000 },
  heist: { target: navTab('heist'), ms: 30_000 },
  // The Perks page lives on the Upgrades screen: the hand points at its tab, and inside, the Perks
  // switch blinks until it is tapped (UpgradeMap.tsx).
  perks: { target: navTab('upgrades'), ms: 30_000 },
};

/** The middle of the first element matching `sel` that is on screen (stage px), or null. */
function spot(sel: string, yShare = 0.5): { x: number; y: number } | null {
  const el = document.querySelector(sel);
  const r = el?.getBoundingClientRect();
  if (!r || r.width < 2) return null;
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  if (!top || !(el!.contains(top) || top.contains(el!))) return null;
  return stagePoint(r.left + r.width / 2, r.top + r.height * yShare);
}

/** The Bag tab's button (where the hand points when the item isn't on screen). */
function bagButton(): { x: number; y: number } | null {
  return spot(`nav button[aria-label="${t('tab.bag')}"]`, 0.3);
}

/** The stage's size (tall or wide, App.tsx), and how far below and right of its fingertip the hand reaches (with its bob and shadow). */
const stageEl = () => document.querySelector('[data-stage]') as HTMLElement | null;
const stageH = () => stageEl()?.offsetHeight || 1920;
const stageW = () => stageEl()?.offsetWidth || 1080;
const HAND_REACH = 30 * UI_PX;
const HAND_RIGHT = 26 * UI_PX;

/**
 * The pointing hand. With `from`, it carries a ghost of item `uid` from there up onto the raccoon and
 * starts over; without, it taps on `at` (the Bag tab).
 */
function Hand({
  uid, baseId, best, target, fallback,
}: { uid: number | null; baseId: string | null; best?: boolean; target?: string; fallback?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'drag' | 'tap'>('drag');
  const modeRef = useRef(mode);
  // Near the bottom of the screen (the tabs), the hand points down from above, or it would hang off the
  // edge; near the right edge (the Worlds tab) it turns around, its palm to the left of its finger.
  const [flip, setFlip] = useState(false);
  const flipRef = useRef(flip);
  const [mirror, setMirror] = useState(false);
  useEffect(() => {
    let raf = 0;
    let t0 = performance.now();
    let from: { x: number; y: number } | null = null;
    let tap: { x: number; y: number } | null = null;
    const plan = () => {
      from = uid !== null ? equipSourceOf(uid) : null;
      tap = from
        ? null
        : target
          ? (spot(target, 0.5) ?? (fallback ? spot(fallback, 0.3) : null))
          : ((best ? spot('[data-equip-best]', 0.6) : null) ?? bagButton());
      const m = from ? 'drag' : 'tap';
      if (m !== modeRef.current) {
        modeRef.current = m;
        setMode(m);
      }
      const f = !!tap && tap.y > stageH() - HAND_REACH;
      if (f !== flipRef.current) {
        flipRef.current = f;
        setFlip(f);
      }
      setMirror(!!tap && tap.x > stageW() - HAND_RIGHT);
    };
    plan();
    const LOOP = 1900;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const el = ref.current;
      if (!el) return;
      let ms = performance.now() - t0;
      if (ms > LOOP) {
        t0 = performance.now();
        ms = 0;
        plan();
      }
      let x = 0;
      let y = 0;
      let alpha = 1;
      let carry = false;
      if (from) {
        const to = slamPoint('hat');
        if (ms < 300) {
          // Lands on the item and presses it.
          x = from.x;
          y = from.y + (ms > 180 ? UI_PX : 0);
          alpha = Math.min(1, ms / 120);
        } else if (ms < 1300) {
          // Carries it up to the raccoon.
          const k = (ms - 300) / 1000;
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          x = from.x + (to.x - from.x) * e;
          y = from.y + UI_PX + (to.y - from.y - UI_PX) * e;
          carry = true;
        } else {
          // Lets go over him and fades.
          x = to.x;
          y = to.y - (ms > 1400 ? UI_PX : 0);
          alpha = Math.max(0, 1 - (ms - 1450) / 350);
        }
      } else if (tap) {
        // Taps its target, bobbing two pixels (toward it from above when it points down).
        x = tap.x;
        y = tap.y + (Math.floor(ms / 240) % 2 ? (flipRef.current ? 2 : -2) * UI_PX : 0);
      } else {
        alpha = 0;
      }
      el.style.transform = `translate3d(${snap(x)}px, ${snap(y)}px, 0)`;
      el.style.opacity = String(Math.round(alpha * 4) / 4);
      if (ghost.current) ghost.current.style.visibility = carry ? 'visible' : 'hidden';
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [uid, best, target, fallback]);
  return (
    <div ref={ref} className={s.hand} data-mode={mode} data-flip={flip || undefined} data-mirror={mirror || undefined}>
      {baseId && mode === 'drag' && (
        <div ref={ghost} className={s.ghost}>
          <PixelArt art={itemArt(baseId, 1)} />
        </div>
      )}
      <HandIcon size="lg" className={s.handIcon} />
    </div>
  );
}

/** The bubble: what to do now, and three pips for the steps. */
function Bubble({ text, done, gold }: { text: string; done: number | null; gold?: boolean }) {
  return (
    <div className={s.bubbleWrap}>
      <div key={text} className={`${s.bubble} ${gold ? s.bubbleGold : ''}`}>
        {done !== null && (
          <div className={s.pips}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < done ? s.pipOn : s.pip} />
            ))}
          </div>
        )}
        <span className={s.text}>{text}</span>
      </div>
    </div>
  );
}

/** The end of the tutorial: rays, the title, the gem gift and confetti, over everything. */
function Finale({ gems, onClose }: { gems: number; onClose: () => void }) {
  useEffect(() => {
    audio.jingle(5);
    [0, 180, 360, 540].forEach((ms, i) => setTimeout(() => audio.tierPass(6 + i * 2), 250 + ms));
    setTimeout(() => audio.powerLanded(true), 1000);
    haptics.impact('heavy');
    const close = setTimeout(onClose, 4200);
    return () => clearTimeout(close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const across = stageSize().w;
  const confetti = Array.from({ length: Math.round(36 * (across / 1080)) }, (_, i) => ({
    x: (i * 149) % across,
    d: 1400 + ((i * 97) % 900),
    delay: (i * 53) % 700,
    c: ['#ff5a7a', '#ffd54f', '#5bd23a', '#4fc3f7', '#c48bff', '#ffffff'][i % 6],
  }));
  return (
    <div className={s.finale} onPointerDown={onClose}>
      <div className={s.finaleRays} style={{ backgroundImage: `url(${raysUrl(['#ffd54f', '#ffffff', '#ffb300'])})` }} />
      {confetti.map((c, i) => (
        <span
          key={i}
          className={s.confetti}
          style={{ left: c.x, background: c.c, animationDuration: `${c.d}ms`, animationDelay: `${c.delay}ms` } as CSSProperties}
        />
      ))}
      <div className={s.finaleCard}>
        <span className={s.finaleSmall}>{t('tut.doneSub')}</span>
        <span className={s.finaleTitle}>{t('tut.done')}</span>
        {gems > 0 && (
          <span className={s.gift}>
            <GemIcon size="lg" />+{gems}
          </span>
        )}
      </div>
    </div>
  );
}

export function TutorialLayer() {
  const step = useGame((g) => stepOf(g).step);
  const intro = useGame(introFeature);
  const uid = useGame((g) => stepOf(g).uid);
  const baseId = useGame((g) => (uid !== null ? g.inventory.find((x) => x.uid === uid)?.baseId ?? null : null));
  const busyUi = useUi(
    (u) => u.celebrate !== null || u.popup !== null || u.drag !== null || u.tab === 'upgrades' || u.powerShow || u.rebirthFx !== null || u.unlocked !== null,
  );
  // The offline-rewards popup shows from game state, not the UI's popup.
  const busy = useGame((g) => g.offline.pending !== null) || busyUi;
  const worldsOpen = useGame((g) => g.features.unlocked.includes('worlds'));
  const chosen = useGame((g) => g.stage.chosen);
  const tab = useUi((u) => u.tab);
  const [finale, setFinale] = useState<number | null>(null);
  /** The "keep rolling" bubble after the first equip shows for a few seconds only. */
  const [fightUntil, setFightUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const last = useRef<Step | null>(step);

  // A step done: the pips light up with a chime a step higher each time.
  useEffect(() => {
    const before = last.current;
    last.current = step;
    if (!before || !step || before === step) return;
    const n = doneCount(step);
    if (n > doneCount(before)) setTimeout(() => audio.tierPass(4 + n * 2), 400);
    if (step === 'fight' && before === 'best') setFightUntil(Date.now() + 5200);
  }, [step]);

  useEffect(() => {
    if (!fightUntil) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [fightUntil]);

  // The end: after the equip slam and the power count have had their moment.
  useEffect(
    () =>
      bus.on((events: CoreEvent[]) => {
        const done = events.find((e): e is Extract<CoreEvent, { type: 'tutorialDone' }> => e.type === 'tutorialDone');
        // After the slam (about a second) and the power count (about two more) have had their moment.
        if (done) setTimeout(() => setFinale(done.gems), 3900);
      }),
    [],
  );

  let bubble: { text: string; gold?: boolean; intro?: boolean } | null = null;
  let hand = false;
  let target: { target: string; fallback?: string } | null = null;
  if (step === 'open') {
    bubble = { text: t('tut.open') };
    hand = true;
    target = { target: '[data-lock-target]' };
  } else if (step === 'roll') bubble = { text: t('tut.roll') };
  else if (step === 'best') {
    bubble = { text: t('tut.best') };
    hand = true;
  } else if (step === 'fight' && now < fightUntil) bubble = { text: t('tut.fight') };
  else if (step === 'lucky') {
    bubble = { text: t('tut.lucky'), gold: true };
    hand = true;
  }
  // A feature that just opened, once the tutorial's own steps leave room (the Bag also opens during
  // the Equip best step, whose hand taps the Bag tab anyway).
  const introducing = intro && (step === null || step === 'fight') ? intro : null;
  if (introducing && introducing !== 'roll') {
    bubble = { text: t(`tut.intro.${introducing}`), gold: true, intro: true };
    hand = true;
    target = INTRO[introducing];
  }
  // A new game's first world: the raccoon waits until one is picked (stage.chosen). Worlds' own
  // introduction points at its tab; once it's met, the hand stays on the tab (or World 1's card, on
  // the Worlds tab) until he's fighting. It comes after the Bag, and anything introduced after it
  // (Upgrades, say) waits until he's fighting.
  const before = introducing === 'bag';
  const picking = !before && (step === null || step === 'fight') && worldsOpen && !chosen;
  if (picking) {
    bubble = { text: tab === 'worlds' ? t('tut.pickWorld') : t('tut.intro.worlds'), gold: true, intro: true };
    hand = true;
    target = { target: '[data-intro="world1"]', fallback: navTab('worlds') };
  }
  const showing = !busy && introducing !== null && !picking;
  useEffect(() => {
    if (!showing || !introducing || introducing === 'roll') return;
    // Not tapped in time: the next one gets its turn.
    const id = setTimeout(() => seeFeature(introducing), INTRO[introducing].ms);
    return () => clearTimeout(id);
  }, [showing, introducing]);
  return (
    <div className={s.layer}>
      {!busy && bubble && <Bubble text={bubble.text} done={bubble.intro ? null : step ? doneCount(step) : 3} gold={bubble.gold} />}
      {!busy && hand && (
        <Hand uid={target ? null : uid} baseId={target ? null : baseId} best={step === 'best' || step === 'lucky'} target={target?.target} fallback={target?.fallback} />
      )}
      {finale !== null && <Finale gems={finale} onClose={() => setFinale(null)} />}
    </div>
  );
}
