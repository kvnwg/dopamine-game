/**
 * The Heist tab with no run going: tickets (x/6, with the time to the daily refill), the three places
 * to rob as cards (a slice of their look, the boss, wins; locked ones say what opens them), the picked
 * place's one-liner, and a big Start button that spends a ticket. A rewarded ad gives +1 ticket once a day.
 */
import { useState, type CSSProperties } from 'react';
import { BAL } from '../../data';
import { canStartHeist, formatNumber, heistAdTicketAvailable, heistsOpen } from '../../core';
import { useGame } from '../../app/store';
import { ads, haptics } from '../../services';
import { useAdReady } from '../adReady';
import { useNow } from '../hooks';
import { t } from '../i18n';
import { useWorldThumb } from '../worldThumbs';
import { BagIcon, GemIcon, LockIcon, StarIcon, TvIcon } from './Icons';
import { PixelArt } from './PixelArt';
import {
  LOCATIONS, NodeIcon, TICKETS_MAX, TICKETS_PER_DAY, Ico, clockText, heistDispatch, heistOf, locationInfo, locationOpen, msToMidnight,
  type HeistLocationId,
} from './heistShared';
import s from './heist.module.css';

/** A place's look: the busiest stretch of its backdrop, cropped to the card. */
function LocThumb({ world }: { world: number }) {
  const art = useWorldThumb(world, 'card');
  return art ? <PixelArt art={art} className={s.locImg} /> : <span className={s.locWait} />;
}

function LocationCard({ id, selected, onPick }: { id: HeistLocationId; selected: boolean; onPick: () => void }) {
  const info = locationInfo(id);
  const open = useGame((g) => locationOpen(g, id));
  const heistsLocked = useGame((g) => !heistsOpen(g));
  const wins = useGame((g) => heistOf(g).wins[id] ?? 0);
  return (
    <button
      className={s.loc}
      data-selected={(selected && open) || undefined}
      data-locked={!open || undefined}
      onClick={() => {
        if (!open) return;
        haptics.impact('light');
        onPick();
      }}
      aria-pressed={selected}
    >
      <div className={s.locThumb}>
        <LocThumb world={info.world} />
        {!open && (
          <span className={s.locLock}>
            <LockIcon size="md" />
          </span>
        )}
        {open && wins > 0 && (
          <span className={s.locWins}>
            <StarIcon size="sm" />
            {wins}
          </span>
        )}
        <span className={s.locBoss}>
          <NodeIcon kind="boss" size="xs" />
          {info.boss}
        </span>
      </div>
      <div className={s.locInfo}>
        <span className={s.locName}>{info.name}</span>
        {open ? (
          <span className={s.locLoot}>
            <BagIcon size="sm" />×{formatNumber(info.bags)}
          </span>
        ) : (
          <span className={s.locNeed}>{heistsLocked ? t('heistUi.unlockRebirth') : t('heistUi.unlockWorld', { n: info.unlockWorld })}</span>
        )}
      </div>
    </button>
  );
}

/**
 * Before the first rebirth (BAL.heist.unlockRebirths): what Heists are and when they open, with the
 * three places shown locked. Tickets keep coming meanwhile.
 */
function HeistLocked() {
  const tickets = useGame((g) => heistOf(g).tickets);
  return (
    <div className={s.panel}>
      <div className={s.lobbyHead}>
        <span className={s.title}>{t('heistUi.title')}</span>
      </div>
      <div className={s.lockedBox}>
        <LockIcon size="lg" />
        <div className={s.lockedWords}>
          <span className={s.lockedTitle}>{t('heistUi.lockedTitle')}</span>
          <span className={s.lockedText}>{t('heistUi.lockedText')}</span>
        </div>
      </div>
      <div className={s.locs}>
        {LOCATIONS.map((id) => (
          <LocationCard key={id} id={id} selected={false} onPick={() => {}} />
        ))}
      </div>
      {tickets > 0 && (
        <p className={s.lockedTickets}>
          <Ico name="ticket" size="sm" />
          {t('heistUi.lockedTickets', { n: tickets })}
        </p>
      )}
    </div>
  );
}

/** Gems for the daily bonus ticket (the alternative to its ad). */
const BONUS_TICKET_GEMS = BAL.heist.tickets.bonusGems;

export function HeistLobby() {
  // (Two components, so the hooks below never change in number when Heists open mid-view.)
  const locked = useGame((g) => !heistsOpen(g));
  return locked ? <HeistLocked /> : <HeistLobbyOpen />;
}

function HeistLobbyOpen() {
  const now = useNow(1000);
  const tickets = useGame((g) => heistOf(g).tickets);
  const adOk = useGame((g) => heistAdTicketAvailable(g, now));
  const firstOpen = useGame((g) => LOCATIONS.filter((id) => locationOpen(g, id)).at(-1) ?? 'pizza');
  const [pick, setPick] = useState<HeistLocationId | null>(null);
  const sel = pick ?? firstOpen;
  const full = tickets >= TICKETS_MAX;
  const canStart = useGame((g) => canStartHeist(g, sel));

  const start = () => {
    if (!canStart) return;
    haptics.impact('heavy');
    heistDispatch({ type: 'heistStart', location: sel });
  };
  const adReady = useAdReady('heist_ticket');
  const gems = useGame((g) => g.currencies.gems);
  const adTicket = async () => {
    if (!adOk) return;
    const r = await ads.showRewarded('heist_ticket');
    if (r.rewarded) heistDispatch({ type: 'heistAdTicket' });
  };
  // The Gem price for the same daily bonus ticket (CrazyGames asks every rewarded ad for an alternative).
  const gemTicket = () => {
    if (!adOk || gems < BONUS_TICKET_GEMS) return;
    haptics.impact('medium');
    heistDispatch({ type: 'heistAdTicket', via: 'gems' });
  };

  return (
    <div className={s.panel}>
      <div className={s.lobbyHead}>
        <span className={s.title}>{t('heistUi.title')}</span>
        <div className={s.tickets} style={{ ['--tk' as string]: tickets > 0 ? '#ff8a80' : '#8f95bd' } as CSSProperties}>
          <Ico name="ticket" size="md" />
          <span className={s.ticketNum}>
            {tickets}
            <i>/{TICKETS_MAX}</i>
          </span>
          <span className={s.ticketRefill}>{full ? t('heistUi.ticketsFull') : t('heistUi.refill', { n: TICKETS_PER_DAY, time: clockText(msToMidnight(now)) })}</span>
        </div>
      </div>
      <p className={s.sub}>{t('heistUi.sub')}</p>
      <div className={s.locs}>
        {LOCATIONS.map((id) => (
          <LocationCard key={id} id={id} selected={id === sel} onPick={() => setPick(id)} />
        ))}
      </div>
      <p className={s.blurb}>
        <b>{locationInfo(sel).name}:</b> {locationInfo(sel).blurb}
      </p>
      <div className={s.lobbyActions}>
        {/* The day's bonus ticket, for an ad or Gems; once it's taken (or the tickets are full) both hide. */}
        {adOk && adReady && (
          <button className={`btn blue small ${s.adBtn}`} onClick={adTicket}>
            <TvIcon />
            {t('heistUi.adTicket')}
          </button>
        )}
        {adOk && (
          <button className={`btn gold small ${s.adBtn}`} disabled={gems < BONUS_TICKET_GEMS} onClick={gemTicket}>
            {t('heistUi.adTicket')}
            <span className={s.cost}>
              <GemIcon size="sm" />
              {BONUS_TICKET_GEMS}
            </span>
          </button>
        )}
        <button className={`btn ${canStart ? 'gold breathe' : 'gray'} ${s.startBtn}`} disabled={!canStart} onClick={start}>
          {tickets > 0 ? t('heistUi.start') : t('heistUi.noTickets')}
          {tickets > 0 && (
            <span className={s.cost}>
              <Ico name="ticket" size="sm" />1
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
