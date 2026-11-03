/**
 * The Heist tab during a run (the battle above plays its fights): where the run is (the place, the act,
 * 19 stops as pips that show what each stop was once it's reached), run HP, run level and XP, run coins,
 * perks (tap one for what it does) and curses; under that the run's log, and a big Go button that plays
 * the next stop. A pending decision (a perk pick, a choice, a shop, the wheel, a shrine) takes the place
 * of the log and the button until it's made.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { formatNumber } from '../../core';
import { useGame } from '../../app/store';
import { haptics } from '../../services';
import { t } from '../i18n';
import type { UiIcon } from '../../render/pixel/ui';
import { ArrowRightIcon, CoinIcon, HeartIcon, SkullIcon, SwordIcon } from './Icons';
import {
  ACTS, Ico, NODES_PER_ACT, NodeIcon, PerkChip, RARITY_COLOR, TAG_COLOR, TAG_ICON, TOTAL_NODES, curseInfo, heistDispatch, levelProgress,
  locationInfo, logText, perkInfo, runOf, stopIndex, type HeistNodeKind, type HeistRun,
} from './heistShared';
import { HeistDecision, useWheelSpin } from './heistPick';
import s from './heist.module.css';

/** The pip for stop `i` (0 to 18): what it was, if reached, and how it shows. */
function pipOf(run: HeistRun, i: number): { kind: HeistNodeKind | null; state: 'done' | 'now' | 'next' | 'ahead' } {
  const at = stopIndex(run);
  const act = Math.min(ACTS - 1, Math.floor(i / NODES_PER_ACT));
  const idx = i === TOTAL_NODES - 1 ? NODES_PER_ACT : i % NODES_PER_ACT;
  const kind = run.nodes[act]?.[idx] ?? (i === TOTAL_NODES - 1 ? 'boss' : null);
  // The stop the run is on is being played while it fights or waits on a decision; otherwise Go plays it next.
  const playing = run.status === 'fighting' || run.pending !== null;
  if (i < at) return { kind, state: 'done' };
  if (i === at) return playing ? { kind, state: 'now' } : { kind: i === TOTAL_NODES - 1 ? 'boss' : null, state: 'next' };
  return { kind: i === TOTAL_NODES - 1 ? 'boss' : null, state: 'ahead' };
}

/** 19 pips: three acts of six stops and the boss, each shown once it's reached. */
function Pips({ run }: { run: HeistRun }) {
  const groups = [0, 1, 2].map((a) => Array.from({ length: NODES_PER_ACT }, (_, k) => a * NODES_PER_ACT + k));
  groups.push([TOTAL_NODES - 1]);
  return (
    <div className={s.pips} aria-label={t('heistUi.stop', { n: Math.min(TOTAL_NODES, stopIndex(run) + 1), total: TOTAL_NODES })}>
      {groups.map((g, gi) => (
        <div key={gi} className={s.pipGroup} data-act={gi + 1} data-on={gi === run.act - 1 || undefined}>
          {g.map((i) => {
            const p = pipOf(run, i);
            return (
              <span key={i} className={s.pip} data-state={p.state} data-kind={p.kind ?? undefined}>
                {p.kind ? <NodeIcon kind={p.kind} /> : <span className={s.pipDot} />}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Bar({ value, max, tone, children }: { value: number; max: number; tone: 'hp' | 'xp'; children?: ReactNode }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 100;
  return (
    <div className={s.bar} data-tone={tone} data-low={tone === 'hp' && pct <= 30 ? '' : undefined}>
      <div className={s.barFill} style={{ width: `${pct}%` }} />
      <span className={s.barText}>{children}</span>
    </div>
  );
}

/** What a perk or curse does, under the chips (tap the chip again, or anywhere in it, to close). */
function Detail({ id, curse, onClose }: { id: string; curse: boolean; onClose: () => void }) {
  if (curse) {
    const c = curseInfo(id);
    return (
      <div className={s.detail} data-curse="" onClick={onClose}>
        <span className={s.detailIcon} style={{ ['--tc' as string]: '#6b3a8f' } as CSSProperties}>
          <SkullIcon size="md" />
        </span>
        <div className={s.detailText}>
          <span className={s.detailName}>{c.name}</span>
          <span className={s.detailTags}>
            <i className={s.tagChip} style={{ ['--tc' as string]: '#6b3a8f' } as CSSProperties}>{t('heistUi.curse')}</i>
          </span>
          <span className={s.detailBody}>{c.text}</span>
        </div>
      </div>
    );
  }
  const p = perkInfo(id);
  const rarity = p.evolution ? 'evolution' : p.rarity;
  return (
    <div className={s.detail} onClick={onClose}>
      <span className={s.detailIcon} style={{ ['--tc' as string]: TAG_COLOR[p.tag] } as CSSProperties}>
        <Ico name={TAG_ICON[p.tag]} size="md" />
      </span>
      <div className={s.detailText}>
        <span className={s.detailName}>{p.name}</span>
        <span className={s.detailTags}>
          <i className={s.tagChip} style={{ ['--tc' as string]: TAG_COLOR[p.tag] } as CSSProperties}>{t(`heist.tag.${p.tag}`)}</i>
          <i className={s.tagChip} style={{ ['--tc' as string]: RARITY_COLOR[rarity] } as CSSProperties}>{t(`heist.rarity.${rarity}`)}</i>
        </span>
        <span className={s.detailBody}>{p.text}</span>
      </div>
    </div>
  );
}

function RunHead({ run }: { run: HeistRun }) {
  const info = locationInfo(run.location);
  const [have, need] = levelProgress(run);
  const [open, setOpen] = useState<{ id: string; curse: boolean } | null>(null);
  const [armed, setArmed] = useState(false);
  // A decision coming up closes the note (it would cover it).
  const waitingOn = run.pending?.kind ?? run.status;
  useEffect(() => setOpen(null), [waitingOn]);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);
  const toggle = (id: string, curse: boolean) => {
    haptics.impact('light');
    setOpen((o) => (o && o.id === id && o.curse === curse ? null : { id, curse }));
  };
  const abandon = () => {
    if (!armed) {
      haptics.impact('medium');
      setArmed(true);
      return;
    }
    setArmed(false);
    heistDispatch({ type: 'heistAbandon' });
  };
  return (
    <div className={s.runHead}>
      <div className={s.runTop}>
        <span className={s.runPlace}>{info.name}</span>
        <span className={s.actChip}>{t('heistUi.act', { n: run.act })}</span>
        <span className={s.stopCount}>{t('heistUi.stop', { n: Math.min(TOTAL_NODES, stopIndex(run) + 1), total: TOTAL_NODES })}</span>
        <span className={s.grow} />
        <span className={s.runCoins} data-heist-coins="">
          <CoinIcon size="md" />
          {formatNumber(run.coins)}
        </span>
        <button className={s.abandon} data-armed={armed || undefined} onClick={abandon}>
          {armed ? t('heistUi.abandonSure') : t('heistUi.abandon')}
        </button>
      </div>
      <Pips run={run} />
      <div className={s.runStats}>
        <HeartIcon size="sm" />
        <Bar value={run.hp} max={run.maxHp} tone="hp">
          {formatNumber(Math.max(0, Math.ceil(run.hp)))}/{formatNumber(Math.ceil(run.maxHp))}
        </Bar>
        <span className={s.lv}>{t('heistUi.level', { n: run.level })}</span>
        <Bar value={have} max={need} tone="xp">
          {need > 0 ? `${have}/${need}` : t('heistUi.maxLevel')}
        </Bar>
      </div>
      <div className={s.runPerks}>
        {run.perks.length === 0 && run.curses.length === 0 && <span className={s.noPerks}>{t('heistUi.noPerks')}</span>}
        {run.perks.map((id) => (
          <PerkChip key={id} id={id} active={open?.id === id && !open.curse} onClick={() => toggle(id, false)} />
        ))}
        {run.curses.length > 0 && <span className={s.perkSep} />}
        {run.curses.map((id, i) => (
          <button
            key={`${id}:${i}`}
            className={s.curseChip}
            data-active={(open?.id === id && open.curse) || undefined}
            onClick={() => toggle(id, true)}
            aria-label={curseInfo(id).name}
          >
            <SkullIcon size="sm" />
          </button>
        ))}
      </div>
      {open && <Detail id={open.id} curse={open.curse} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** A small picture for each kind of log line (core's heist.log.* keys). */
const LOG_ICON: Record<string, UiIcon> = {
  start: 'heist', act: 'heist', fight: 'sword', elite: 'sword', boss: 'skull', fightWon: 'check', knockedOut: 'skull',
  secondChance: 'heart', revive: 'heart', lost: 'skull', won: 'star', abandon: 'arrowRight', event: 'choice', chose: 'choice',
  nothing: 'arrowRight', treasureCoins: 'treasure', treasureBags: 'treasure', golden: 'treasure', ring: 'star', bags: 'bag',
  coinsGain: 'coin', coinsPay: 'coin', paid: 'coin', noPerkCoins: 'coin', flipHeads: 'coin', flipTails: 'coin', shop: 'shop',
  leftShop: 'shop', restock: 'shop', reroll: 'dice', shrine: 'shrine', shrineAccept: 'shrine', shrineDecline: 'shrine', trap: 'trap',
  trapDisarmed: 'trap', noTraps: 'trap', wheel: 'wheel', wheelCoins: 'wheel', wheelBags: 'wheel', wheelGems: 'wheel', wheelHeal: 'wheel',
  wheelPerk: 'wheel', perk: 'star', evolved: 'star', perksFull: 'star', levelUp: 'arrowUp', curse: 'skull', curseRemoved: 'check',
  paperCuts: 'drop', damage: 'drop', heal: 'heart', snack: 'heart', savedHeal: 'heart', savedHealSet: 'heart', maxHp: 'heart',
  nineLives: 'heart', truce: 'check', truceSkip: 'check', skipped: 'arrowRight', skipNextSet: 'arrowRight', skipFightSet: 'arrowRight',
};

function logIcon(key: string): UiIcon {
  return LOG_ICON[key.replace(/^heist\.log\./, '')] ?? 'arrowRight';
}

/** The run's log, newest at the bottom, scrolled to it as lines come in. */
function Log({ run }: { run: HeistRun }) {
  const ref = useRef<HTMLDivElement>(null);
  const lines = run.log.slice(-60);
  const first = run.log.length - lines.length;
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [run.log.length]);
  return (
    <div className={s.log} ref={ref}>
      {lines.map((line, i) => (
        <div key={first + i} className={s.logLine} data-new={i === lines.length - 1 || undefined}>
          <Ico name={logIcon(line.key)} size="sm" className={s.logIcon} />
          <span>{logText(line)}</span>
        </div>
      ))}
    </div>
  );
}

export function HeistRunView() {
  const run = useGame(runOf);
  // The wheel's reel keeps spinning after core has paid out (its pending is gone by then).
  const spinning = useWheelSpin((w) => w.spin !== null);
  if (!run) return null;
  const fighting = run.status === 'fighting';
  const go = () => {
    if (fighting || run.pending) return;
    haptics.impact('medium');
    heistDispatch({ type: 'heistGo' });
  };
  return (
    <div className={`${s.panel} ${s.runPanel}`}>
      <RunHead run={run} />
      {run.pending || spinning ? (
        <HeistDecision run={run} />
      ) : (
        <>
          <Log run={run} />
          <button className={`btn ${fighting ? 'gray' : 'breathe'} ${s.goBtn}`} disabled={fighting} onClick={go}>
            {fighting ? (
              <>
                <SwordIcon size="md" className={s.fightBob} />
                {t('heistUi.fighting')}
              </>
            ) : (
              <>
                {stopIndex(run) >= TOTAL_NODES - 1 ? t('heistUi.goBoss') : t('heistUi.go')}
                <ArrowRightIcon size="md" />
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
