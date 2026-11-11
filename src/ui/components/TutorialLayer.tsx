/**
 * The first-run tutorial (new games only; see BAL.tutorial and dumpster.beginner in core). The first
 * minute decides whether a new player stays, so it has no menu in it: the raccoon is already fighting
 * in World 1 as the title opens, and every step is one tap, paid off with as much fanfare as the game has:
 *  1. Bust the dumpster open: the hand taps the padlock (DumpsterLock), the metal falls off and it
 *     rolls by itself: one quick everyday find, then the Traffic Cone of Destiny with the big reveal.
 *  2. Wear it: the reveal's tap puts it on (TAP TO WEAR IT, RevealLayer): it leaps out of the reveal
 *     and slams onto the raccoon, his power counts up, and one line says why that matters.
 *  3. Equip best: once a couple more finds are waiting, the hand taps the Bag tab, then the button,
 *     and everything better slams on.
 *  4. Beginner's luck: a meter in the bubble fills while the reels roll (and the Roll tab's first
 *     upgrades come up to buy, FirstBuy.tsx: the hand points at Buy for the first one). Full, the
 *     reels chain two luck tokens (a line says what they are) into a Limited Edition hat; its
 *     reveal's tap puts it on and the tutorial ends: a full-screen celebration, a gem gift and the
 *     game in one line.
 * A bubble over the bottom of the battle carries it: what to do in big words, and under it one short
 * line of why (Kevin: "explain things a bit more, but don't use too much text"). The top line always
 * names what the hand is pointing at (the story itself is in ../tutorialSteps.ts). Four pips light up
 * (and chime, a step higher each time) as the steps are done. Everything moves in whole art pixels.
 *
 * Everything else starts locked and opens one feature at a time (core/systems/features.ts): when one
 * opens, a gold NEW bubble says what it is and what it is for, and the hand points at its tab or
 * button until it is tapped (or its moment passes), then the next one gets its turn (ui/features.ts).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { beginnerLuckCharge, tutorialOver, type CoreEvent, type Feature } from '../../core';
import { bus } from '../../app/eventBus';
import { getGame, useGame } from '../../app/store';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { UI_PX } from '../../render/icons';
import { introFeature, seeFeature } from '../features';
import { stagePoint } from '../drag';
import { t } from '../i18n';
import { raysUrl } from '../rays';
import {
  AFTER_WEAR, buyPrompt, CHARGE_LINE, doneCount, INCOMING_LINE, luckIncoming, promptFor, stepOf, STEPS, TOKENS_LINE, tokensLanding,
  type Prompt, type Spot,
} from '../tutorialSteps';
import { Rays } from './Rays';
import { stageSize, useUi } from '../uiStore';
import { firstBuyOffer } from './FirstBuy';
import { CloverIcon, GemIcon, HandIcon } from './Icons';
import s from './tutorial.module.css';

const snap = (v: number) => Math.round(v / UI_PX) * UI_PX;

/** The beginner's luck meter, in art pixels across. */
const METER = 40;
/** How long the hand points at the first-upgrade card's Buy button (time on screen) once its price is in. */
const BUY_POINT_MS = 20_000;

/** A nav tab's button. */
const navTab = (tab: string) => `nav button[aria-label="${t(`tab.${tab}`)}"]`;

/** What the hand taps: the first of these on screen (a button on a tab that isn't open falls back to its tab). */
interface Target {
  target: string;
  fallback?: string;
}
const EQUIP_BEST = '[data-equip-best]';
/** How far down its target the fingertip rests: high on a tab (the hand comes from above), lower on a button. */
const restOn = (sel: string) => (sel.startsWith('nav ') ? 0.3 : sel === EQUIP_BEST ? 0.6 : 0.5);
/** Where each of the tutorial's spots (tutorialSteps.ts) is on screen. */
const selectorOf = (spot: Spot): string =>
  spot === 'lock' ? '[data-lock-target]' : spot === 'equipBest' ? EQUIP_BEST : spot === 'buy' ? '[data-intro="firstBuy"]' : navTab(spot.slice(4));

/**
 * Where the hand points to introduce each feature (a button on the Roll tab falls back to the Roll
 * tab while another tab is open), and how long the introduction waits for a tap before moving on.
 * (Luck and the Codex open quietly, features.ts, so theirs only matter for odd old saves.)
 */
const INTRO: Record<Exclude<Feature, 'roll'>, Target & { ms: number }> = {
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
  // (These open quietly, features.ts: their own announcements show instead.)
  daily: { target: '[data-intro="daily"]', ms: 12_000 },
  endless: { target: navTab('worlds'), ms: 12_000 },
  legend: { target: navTab('rebirth'), ms: 12_000 },
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

/** The stage's size (tall or wide, App.tsx), and how far below and right of its fingertip the hand reaches (with its bob and shadow). */
const stageEl = () => document.querySelector('[data-stage]') as HTMLElement | null;
const stageH = () => stageEl()?.offsetHeight || 1920;
const stageW = () => stageEl()?.offsetWidth || 1080;
const HAND_REACH = 30 * UI_PX;
const HAND_RIGHT = 26 * UI_PX;

/**
 * The pointing hand: taps on its target, bobbing. `at` is where the player is (the open tab and the
 * step): when it changes the hand looks again at once, so it never keeps pointing at a tab that is
 * already open while its panel slides in.
 */
function Hand({ target, fallback, at }: Target & { at: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Near the bottom of the screen (the tabs), the hand points down from above, or it would hang off the
  // edge; near the right edge (the Worlds tab) it turns around, its palm to the left of its finger.
  const [flip, setFlip] = useState(false);
  const flipRef = useRef(flip);
  const [mirror, setMirror] = useState(false);
  useEffect(() => {
    let raf = 0;
    let t0 = performance.now();
    let tap: { x: number; y: number } | null = null;
    const plan = () => {
      tap = spot(target, restOn(target)) ?? (fallback ? spot(fallback, restOn(fallback)) : null);
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
      // A full loop, or (with nothing found to point at: a panel still sliding in) a moment's wait.
      if (ms > LOOP || (!tap && ms > 150)) {
        t0 = performance.now();
        ms = 0;
        plan();
      }
      // Taps its target, bobbing two pixels (toward it from above when it points down).
      const x = tap?.x ?? 0;
      const y = tap ? tap.y + (Math.floor(ms / 240) % 2 ? (flipRef.current ? 2 : -2) * UI_PX : 0) : 0;
      el.style.transform = `translate3d(${snap(x)}px, ${snap(y)}px, 0)`;
      el.style.opacity = tap ? '1' : '0';
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, fallback, at]);
  return (
    // (Unseen until its first frame has put it on its target.)
    <div ref={ref} className={s.hand} style={{ opacity: 0 }} data-flip={flip || undefined} data-mirror={mirror || undefined}>
      <HandIcon size="lg" className={s.handIcon} />
    </div>
  );
}

/** What the bubble says: what to do (or what is happening), and one short line of why. */
interface Say {
  text: string;
  why: string;
  gold?: boolean;
  /** A feature's introduction (no pips: it isn't one of the tutorial's steps). */
  intro?: boolean;
  /** Beginner's luck on its way: its meter beside the words. */
  meter?: boolean;
}
const say = (key: string, more?: Pick<Say, 'gold' | 'intro' | 'meter'>): Say => ({ text: t(key), why: t(`${key}.why`), ...more });

/**
 * The bubble: what to do now, one line of why under it, and a pip for each of the tutorial's steps.
 * While beginner's luck is on its way it also shows how close it is (`charge`, 0 to METER): as a meter
 * beside the words when the bubble is about the luck itself (`meter`), else as a thin green strip
 * along its bottom edge.
 */
function Bubble({ text, why, done, gold, charge, meter }: Pick<Say, 'text' | 'why' | 'gold' | 'meter'> & { done: number | null; charge: number | null }) {
  return (
    <div className={s.bubbleWrap}>
      <div key={text + why} className={`${s.bubble} ${gold ? s.bubbleGold : ''}`}>
        {done !== null && (
          <div className={s.pips}>
            {Array.from({ length: STEPS }, (_, i) => (
              <span key={i} className={i < done ? s.pipOn : s.pip} />
            ))}
          </div>
        )}
        {meter && <CloverIcon size="md" />}
        <div className={s.words}>
          <span className={s.text}>{text}</span>
          <span className={s.why}>{why}</span>
        </div>
        {meter && charge !== null && (
          <span className={s.meter} aria-hidden>
            <span className={s.meterFill} style={{ ['--fill' as string]: charge } as CSSProperties} />
          </span>
        )}
        {!meter && charge !== null && <span className={s.strip} style={{ ['--fill' as string]: charge / METER } as CSSProperties} aria-hidden />}
      </div>
    </div>
  );
}

/** How long the finale stays if it isn't tapped away (long enough to read its last line). */
const FINALE_MS = 6500;

/** The end of the tutorial: rays, the title, the gem gift, the game in one line and confetti, over everything. */
function Finale({ gems, onClose }: { gems: number; onClose: () => void }) {
  useEffect(() => {
    audio.jingle(5);
    [0, 180, 360, 540].forEach((ms, i) => setTimeout(() => audio.tierPass(6 + i * 2), 250 + ms));
    setTimeout(() => audio.powerLanded(true), 1000);
    haptics.impact('heavy');
    const close = setTimeout(onClose, FINALE_MS);
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
        <span className={s.finaleTip}>{t('tut.doneTip')}</span>
      </div>
    </div>
  );
}

/**
 * After the first find goes on: one short line on what the gear is for, shown `show` ms (time on
 * screen, not under a full-screen moment). It waits for the equip slam and the power count to finish
 * (`slam` ms at most, should no count play), then a moment more.
 */
const AFTER = { slam: 4500, wait: 500, show: 5500 } as const;

export function TutorialLayer() {
  const step = useGame(stepOf);
  const done = useGame(doneCount);
  const intro = useGame(introFeature);
  const tokens = useGame(tokensLanding);
  const incoming = useGame(luckIncoming);
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
  // Beginner's luck on its way: how full its meter is (whole art pixels).
  const charging = useGame((g) => g.dumpster.beginner.state !== 'done' && g.lifetime.itemsEquipped > 0);
  const charge = useGame((g) => Math.round(beginnerLuckCharge(g) * METER));
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

  /** How long the line after the first find went on has been on screen (ms), or null when it isn't due. */
  const [after, setAfter] = useState<number | null>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  // A step done: the pips light up with a chime a step higher each time (the last one is the finale's).
  const lastDone = useRef(done);
  useEffect(() => {
    const before = lastDone.current;
    lastDone.current = done;
    if (done > before && done < STEPS) setTimeout(() => audio.tierPass(4 + done * 2), 400);
    // The first find just went on.
    if (before === 1 && done === 2) setAfter(0);
  }, [done]);

  // The line after the first find: the equip slam and the power count come first, then its clock
  // runs while it can be seen, and stops for good when it has had its time.
  const afterOn = after !== null;
  useEffect(() => {
    if (!afterOn) return;
    const TICK = 250;
    const t0 = Date.now();
    let counted = false;
    const id = setInterval(() => {
      if (useUi.getState().powerShow) counted = true;
      if (busyRef.current || (!counted && Date.now() - t0 < AFTER.slam)) return;
      setAfter((ms) => (ms === null || ms + TICK > AFTER.wait + AFTER.show ? null : ms + TICK));
    }, TICK);
    return () => clearInterval(id);
  }, [afterOn]);

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

  // Each ask: the top line names what the hand points at (tutorialSteps.ts).
  let bubble: Say | null = null;
  let target: Target | null = null;
  const ask = (p: Prompt, more?: Pick<Say, 'gold' | 'intro'>) => {
    bubble = say(p.key, { gold: p.gold, ...more });
    target = p.spot ? { target: selectorOf(p.spot) } : null;
  };
  const asked = step ? promptFor(step, tab) : null;
  // Beginner's luck is rolling (its tokens, then its find): nothing else asks for attention.
  if (tokens) bubble = say(TOKENS_LINE, { gold: true });
  else if (incoming) bubble = say(INCOMING_LINE, { gold: true });
  else if (asked) ask(asked);
  // The first upgrade, as its price comes in.
  else if (buying) ask(buyPrompt(tab));
  // He's fighting: what the gear he just put on is for (once its slam and power count are over:
  // nothing under them), then the wait for beginner's luck.
  else if (step === 'fight' && after !== null) bubble = after >= AFTER.wait ? say(AFTER_WEAR) : null;
  else if (step === 'fight') bubble = say(CHARGE_LINE, { meter: true });
  // A feature that just opened, once the tutorial is over (or has gone on so long that the features
  // stopped waiting for it): while it runs, its own steps are all there is to follow (its Equip best
  // step taps the Bag tab; Worlds, open once World 1's boss falls, waits for the finale).
  const introducing = intro && (step === null || (step === 'fight' && past && !incoming && !buying)) ? intro : null;
  if (introducing && introducing !== 'roll') {
    bubble = say(`tut.intro.${introducing}`, { gold: true, intro: true });
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
  // (Assigned in a closure above, which narrows them to null here.)
  const b = bubble as Say | null;
  const hand = target as Target | null;
  return (
    <div className={s.layer}>
      {!quiet && b && (
        <Bubble
          text={b.text}
          why={b.why}
          done={b.intro ? null : done}
          gold={b.gold}
          meter={b.meter}
          charge={charging && !incoming && !b.intro ? charge : null}
        />
      )}
      {!quiet && hand && <Hand target={hand.target} fallback={hand.fallback} at={`${tab} ${step} ${buying}`} />}
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
