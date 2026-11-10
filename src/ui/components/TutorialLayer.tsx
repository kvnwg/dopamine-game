/**
 * The first-run tutorial (new games only; see BAL.tutorial and dumpster.beginner in core). The first
 * minute decides whether a new player stays, so it has no menu in it: the raccoon is already fighting
 * in World 1 as the title opens, and every step is one tap, paid off with as much fanfare as the game has:
 *  1. Bust the dumpster open: the hand taps the padlock (DumpsterLock), the metal falls off and it
 *     rolls by itself: one quick everyday find, then the Traffic Cone of Destiny with the big reveal.
 *  2. Wear it: the reveal's tap puts it on (TAP TO WEAR IT, RevealLayer): it leaps out of the reveal
 *     and slams onto the raccoon, and his power counts up.
 *  3. Equip best: once a couple more finds are waiting, the hand taps the Bag tab and the button, and
 *     everything better slams on.
 *  4. Beginner's luck: a meter in the bubble fills while the reels roll (and the Roll tab's first
 *     upgrades come up to buy, FirstBuy.tsx: the hand points at Buy for the first one). Full, the
 *     reels chain two luck tokens into a Limited Edition hat (the big reveal calls it beginner's luck);
 *     its tap puts it on and the tutorial ends: a full-screen celebration and a gem gift.
 * A bubble over the bottom of the battle says what to do, with four pips that light up (and chime,
 * a step higher each time) as the steps are done. Everything moves in whole art pixels.
 *
 * Everything else starts locked and opens one feature at a time (core/systems/features.ts): when one
 * opens, a gold NEW bubble says what it is and the hand points at its tab or button until it is
 * tapped (or its moment passes), then the next one gets its turn (ui/features.ts).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { beginnerLuckCharge, bestUpgrades, tutorialOver, type CoreEvent, type Feature, type GameState } from '../../core';
import { BAL } from '../../data';
import { bus } from '../../app/eventBus';
import { getGame, useGame } from '../../app/store';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { slamPoint } from '../../render/equipSlam';
import { itemArt, UI_PX } from '../../render/icons';
import { equipSourceOf } from '../equipSource';
import { introFeature, seeFeature } from '../features';
import { stagePoint } from '../drag';
import { t } from '../i18n';
import { raysUrl } from '../rays';
import { Rays } from './Rays';
import { stageSize, useUi } from '../uiStore';
import { firstBuyName, firstBuyOffer } from './FirstBuy';
import { CloverIcon, GemIcon, HandIcon } from './Icons';
import { PixelArt } from './PixelArt';
import s from './tutorial.module.css';

type Step = 'open' | 'roll' | 'wear' | 'best' | 'fight' | 'lucky';

const snap = (v: number) => Math.round(v / UI_PX) * UI_PX;

/** Where the tutorial is, from the game itself (nothing extra is saved): null when it's over. */
function stepOf(g: GameState): Step | null {
  const b = g.dumpster.beginner;
  if (b.state === 'done') return null;
  // He's already fighting; the first thing to do is the padlocked dumpster.
  if (!g.features.unlocked.includes('roll')) return 'open';
  const worn = g.lifetime.itemsEquipped > 0;
  // The warm-up spin and the tutorial's own find rolling in.
  const findIn = worn || g.inventory.some((x) => x.baseId === BAL.dumpster.tutorialItem.baseId);
  if (!g.dumpster.firstDiveDone || !findIn) return 'roll';
  // Its find goes on from its reveal (TAP TO WEAR IT). Without the reveal (the game was reloaded on
  // it), Equip best puts it on.
  if (!worn) return 'wear';
  // Beginner's luck has landed: it goes on from its reveal too.
  if (b.state === 'rolled' && g.inventory.some((x) => x.uid === b.uid)) return 'lucky';
  // The rest of what has rolled goes on with Equip best (taught once: after a few items are on, no more).
  if (g.lifetime.itemsEquipped < BAL.tutorial.beginnerAfterEquips && bestUpgrades(g).length >= 2) return 'best';
  return 'fight';
}

/** How many of the four steps are done: the dumpster open, the first find on, dressed with Equip best, beginner's luck on. */
function doneCount(g: GameState): number {
  if (g.dumpster.beginner.state === 'done') return STEPS;
  if (!g.features.unlocked.includes('roll')) return 0;
  const n = g.lifetime.itemsEquipped;
  return n === 0 ? 1 : n < BAL.tutorial.beginnerAfterEquips ? 2 : 3;
}
const STEPS = 4;
/** The beginner's luck meter, in art pixels across. */
const METER = 40;
/** How long the hand points at the first-upgrade card's Buy button (time on screen) once its price is in. */
const BUY_POINT_MS = 20_000;

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
  boosts: { target: '[data-intro="boosts"]', fallback: navTab('alley'), ms: 15_000 },
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
      // A full loop, or (with nothing found to point at: a tab still sliding in) a moment's wait.
      if (ms > LOOP || (!from && !tap && ms > 150)) {
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

/**
 * The bubble: what to do now, and four pips for the steps. While beginner's luck is on its way it also
 * shows how close it is (`charge`, 0 to METER): as a meter beside the words when the bubble is about
 * the luck itself (`meter`), else as a thin gold strip along its bottom edge.
 */
function Bubble({ text, done, gold, charge, meter }: { text: string; done: number | null; gold?: boolean; charge?: number | null; meter?: boolean }) {
  return (
    <div className={s.bubbleWrap}>
      <div key={text} className={`${s.bubble} ${gold ? s.bubbleGold : ''}`}>
        {done !== null && (
          <div className={s.pips}>
            {Array.from({ length: STEPS }, (_, i) => (
              <span key={i} className={i < done ? s.pipOn : s.pip} />
            ))}
          </div>
        )}
        {meter && <CloverIcon size="md" />}
        <span className={s.text}>{text}</span>
        {meter && charge != null && (
          <span className={s.meter} aria-hidden>
            <span className={s.meterFill} style={{ ['--fill' as string]: charge } as CSSProperties} />
          </span>
        )}
        {!meter && charge != null && <span className={s.strip} style={{ ['--fill' as string]: charge / METER } as CSSProperties} aria-hidden />}
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
      <Rays className={s.finaleRays} url={raysUrl(['#ffd54f', '#ffffff', '#ffb300'])} />
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
  const step = useGame(stepOf);
  const done = useGame(doneCount);
  const intro = useGame(introFeature);
  const busyUi = useUi(
    (u) => u.celebrate !== null || u.popup !== null || u.drag !== null || u.tab === 'upgrades' || u.powerShow || u.rebirthFx !== null || u.unlocked !== null,
  );
  // The offline-rewards popup shows from game state, not the UI's popup.
  const busy = useGame((g) => g.offline.pending !== null) || busyUi;
  const tab = useUi((u) => u.tab);
  const [finale, setFinale] = useState<number | null>(null);
  // From beginner's luck going on until the finale has closed, nothing else asks for attention.
  const [ending, setEnding] = useState(false);
  // An unfinished tutorial that features no longer wait for (features.ts tutorialOver).
  const past = useGame(tutorialOver);
  // Beginner's luck on its way: how full its meter is (whole art pixels), and whether its spin is rolling now.
  const charging = useGame((g) => g.dumpster.beginner.state !== 'done' && g.lifetime.itemsEquipped > 0);
  const charge = useGame((g) => Math.round(beginnerLuckCharge(g) * METER));
  const incoming = useGame((g) => {
    const b = g.dumpster.beginner;
    return b.state === 'rolled' && !g.inventory.some((x) => x.uid === b.uid);
  });
  // The first-upgrade card's price is in (FirstBuy.tsx): the hand points at its Buy button for a while.
  const offer = useGame((g) => {
    const o = firstBuyOffer(g);
    return o?.afford ? `${o.id}:${o.price}` : '';
  });
  const [buyTired, setBuyTired] = useState('');
  const buyShown = useRef({ key: '', ms: 0 });
  // The very first one only (after that the card's own glow says when the next is affordable; the card
  // itself waits until he's dressed, so Equip best comes first), and never over beginner's luck's own spin.
  const firstBuy = useGame((g) => Object.keys(g.upgrades).length === 0);
  const buying = step === 'fight' && firstBuy && done >= 3 && !incoming && offer !== '' && buyTired !== offer;
  useEffect(() => {
    if (!buying || busy || ending) return;
    if (buyShown.current.key !== offer) buyShown.current = { key: offer, ms: 0 };
    const from = Date.now();
    const id = setTimeout(() => setBuyTired(offer), Math.max(0, BUY_POINT_MS - buyShown.current.ms));
    return () => {
      clearTimeout(id);
      buyShown.current.ms += Date.now() - from;
    };
  }, [buying, busy, ending, offer]);

  // A step done: the pips light up with a chime a step higher each time (the last one is the finale's).
  const lastDone = useRef(done);
  useEffect(() => {
    const before = lastDone.current;
    lastDone.current = done;
    if (done > before && done < STEPS) setTimeout(() => audio.tierPass(4 + done * 2), 400);
  }, [done]);

  // The end: after the equip slam and the power count have had their moment.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = bus.on((events: CoreEvent[]) => {
      const over = events.find((e): e is Extract<CoreEvent, { type: 'tutorialDone' }> => e.type === 'tutorialDone');
      if (!over) return;
      setEnding(true);
      // (A boss that fell just now has its own card up, asking again or next: the finale waits for it.)
      const show = () => {
        if (getGame().battle.phase === 'choice') timer = setTimeout(show, 400);
        else setFinale(over.gems);
      };
      // After the slam (about a second) and the power count (about two more) have had their moment.
      timer = setTimeout(show, 3900);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);

  let bubble: { text: string; gold?: boolean; intro?: boolean; meter?: boolean } | null = null;
  let hand = false;
  let target: { target: string; fallback?: string } | null = null;
  if (step === 'open') {
    // He's fighting already; the player busts the dumpster open (on the Roll tab, where a new game opens).
    hand = true;
    if (tab === 'alley') {
      bubble = { text: t('tut.open') };
      target = { target: '[data-lock-target]' };
    } else {
      bubble = { text: t('tut.goRoll') };
      target = { target: navTab('alley') };
    }
  } else if (step === 'roll') bubble = { text: t('tut.roll') };
  else if (step === 'wear') {
    bubble = { text: t('tut.wear') };
    hand = true;
  } else if (step === 'lucky') {
    bubble = { text: t('tut.lucky'), gold: true };
    hand = true;
  } else if (incoming) {
    // Its spin is rolling (tokens and all): nothing else asks for attention.
    bubble = { text: t('tut.chargeNow'), gold: true };
  } else if (step === 'best') {
    bubble = { text: t('tut.best') };
    hand = true;
  } else if (step === 'fight') bubble = { text: t('tut.charge'), meter: true };
  // The first upgrades, one at a time, as each one's price comes in.
  if (buying) {
    bubble = { text: t('tut.buy', { name: firstBuyName(offer.split(':')[0]) }), gold: true };
    hand = true;
    target = { target: '[data-intro="firstBuy"]', fallback: navTab('alley') };
  }
  // A feature that just opened, once the tutorial is over (or has gone on so long that the features
  // stopped waiting for it): while it runs, its own steps are all there is to follow (its Equip best
  // step taps the Bag tab; Worlds, open once World 1's boss falls, waits for the finale).
  const introducing = intro && (step === null || (step === 'fight' && past && !incoming && !buying)) ? intro : null;
  if (introducing && introducing !== 'roll') {
    bubble = { text: t(`tut.intro.${introducing}`), gold: true, intro: true };
    hand = true;
    target = INTRO[introducing];
  }
  const quiet = busy || ending;
  const showing = !quiet && introducing !== null;
  useEffect(() => {
    if (!showing || !introducing || introducing === 'roll') return;
    // Not tapped in time: the next one gets its turn.
    const id = setTimeout(() => seeFeature(introducing), INTRO[introducing].ms);
    return () => clearTimeout(id);
  }, [showing, introducing]);
  return (
    <div className={s.layer}>
      {!quiet && bubble && (
        <Bubble
          text={bubble.text}
          done={bubble.intro ? null : done}
          gold={bubble.gold}
          meter={bubble.meter}
          charge={charging && !incoming && !bubble.intro ? charge : null}
        />
      )}
      {!quiet && hand && (
        <Hand uid={null} baseId={null} best={step === 'wear' || step === 'best' || step === 'lucky'} target={target?.target} fallback={target?.fallback} />
      )}
      {finale !== null && (
        <Finale
          gems={finale}
          onClose={() => {
            setFinale(null);
            setEnding(false);
          }}
        />
      )}
    </div>
  );
}
