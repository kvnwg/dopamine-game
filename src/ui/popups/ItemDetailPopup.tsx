import type { CSSProperties } from 'react';
import { DATA, SLOTS, type Rarity } from '../../data';
import { boostBlocked, enchantRarity, formatNumber, formatStatValue, itemFlavor, itemName, itemOddsOneIn, scrapValue, type Item, gearPowerMult, gearScale } from '../../core';
import { dispatch, useGame, useGameWhen } from '../../app/store';
import { rarityColor } from '../../render/art';
import { uiBitArt } from '../../render/icons';
import { haptics } from '../../services';
import { enchantLabel, fmtOdds } from '../components/AlleyPanel';
import { BoostButtons } from '../components/BoostButtons';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, LockIcon, PowerIcon, StarIcon, TrashIcon } from '../components/Icons';
import { enchantColor, ItemIcon } from '../components/ItemIcon';
import { PixelArt } from '../components/PixelArt';
import { enchantDesc } from '../components/RevealLayer';
import { t } from '../i18n';
import { Modal } from './Modal';
import { statLines } from './statRows';
import s from './popups.module.css';

function findItem(equipped: Record<string, Item | null>, bag: Item[], uid: number): { item: Item | null; equipped: boolean } {
  for (const slot of SLOTS) if (equipped[slot]?.uid === uid) return { item: equipped[slot], equipped: true };
  return { item: bag.find((x) => x.uid === uid) ?? null, equipped: false };
}

/** "×4", "×1.4", "×118", "×13.3K": how many times rarer. */
function fmtTimes(x: number): string {
  return x >= 100 ? formatNumber(Math.round(x)) : x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10);
}
/** The least an enchantment adds (one, of the commonest tier). */
const ONE_ENCHANT = enchantRarity([{ tier: 1 }]).total;

/** The detail popup's color per rarity. */
const TONE: Partial<Record<Rarity, 'gold' | 'purple' | 'red' | 'green' | 'blue'>> = {
  decent: 'green', epic: 'purple', legendary: 'gold', mythic: 'red', vintage: 'gold', limited: 'red', prototype: 'blue',
  mint: 'gold', gemMint: 'green', museum: 'purple', grail: 'gold',
  cosmic: 'purple', glitched: 'green', fourthWall: 'red', devsOwn: 'blue', patchNotes: 'gold', sourceCode: 'green', concept: 'purple',
};

export function ItemDetailPopup({ uid, onClose }: { uid: number; onClose: () => void }) {
  // Redrawn when what it shows changes, not with every battle tick.
  const g = useGameWhen((x) => [x.inventory, x.equipped, x.upgrades, x.perks, x.rebirths, x.player.level, x.stage, x.battle.stage]);
  // Polish (a boost) can be taken for this item now (Mythic or better, room to grow, some left today).
  const polishOk = useGame((x) => x.features.unlocked.includes('boosts') && boostBlocked(x, 'polish', Date.now(), { uid }) === null);
  const equippedMap = g.equipped;
  const bag = g.inventory;
  const { item, equipped } = findItem(equippedMap, bag, uid);
  if (!item) {
    return (
      <Modal title={t('item.equipped')} onClose={onClose}>
        <p className={s.subtitle}>{t('item.emptySlot')}</p>
      </Modal>
    );
  }
  const color = rarityColor(item.rarity);
  const cur = equippedMap[item.slot];
  const mult = gearPowerMult(g);
  const worn = (it: { power: number }) => Math.round(it.power * mult);
  const diff = !equipped && cur ? worn(item) - worn(cur) : null;
  const perk = item.mintPerkId ? DATA.mintPerksById.get(item.mintPerkId) : null;
  const scrapGold = scrapValue(g, item).coins;
  // Its "1 in X" is its tier's odds times its enchantments' (Kevin: "make it obvious that enchantments
  // make items more rare when someone clicks into an item").
  const plain = itemOddsOneIn({ rarity: item.rarity, enchants: [] });
  const ench = enchantRarity(item.enchants);
  const enchanted = item.enchants.length > 0;
  return (
    <Modal title={t(`rarity.${item.rarity}`)} tone={TONE[item.rarity] ?? 'blue'} onClose={onClose}>
      <div className={s.bigOdds} data-rarity={item.rarity} style={{ ['--c' as string]: color } as CSSProperties}>
        <i>1 in</i>
        <b>{fmtOdds(itemOddsOneIn(item))}</b>
      </div>
      {enchanted ? (
        <div className={s.oddsMath}>
          <span className={s.oddsTerm}>
            <em>{t(`rarity.${item.rarity}`)}</em>
            <b>{t('item.oneInShort', { odds: fmtOdds(plain) })}</b>
          </span>
          <span className={s.oddsTimes}>×</span>
          <span className={`${s.oddsTerm} ${s.oddsEnchanted}`}>
            <em>
              <PixelArt art={uiBitArt('sparkle')} />
              {t('item.enchanted')}
            </em>
            <b>{t('item.rarer', { x: fmtTimes(ench.total) })}</b>
          </span>
        </div>
      ) : (
        <p className={s.oddsHint}>{t('item.noEnchants', { x: fmtTimes(ONE_ENCHANT) })}</p>
      )}
      <div className={s.itemHead}>
        <ItemIcon item={item} scale={2} equipped={equipped} showPower={false} showOdds={false} />
        <div className={s.itemHeadText}>
          <span className={s.itemName} style={{ color }}>
            {itemName(item)}
          </span>
          <span className={s.meta}>{t(`slot.${item.slot}`)}</span>
          <div className={s.powerBig}>
            <PowerIcon size="md" />
            {formatNumber(worn(item))}
            {diff !== null && (
              <span className={diff > 0 ? s.up : diff < 0 ? s.down : s.same}>
                {diff > 0 && <ArrowUpIcon size="sm" />}
                {diff < 0 && <ArrowDownIcon size="sm" />}
                {diff > 0 ? t('item.better', { n: formatNumber(diff) }) : diff < 0 ? t('item.worse', { n: `-${formatNumber(-diff)}` }) : t('item.same')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className={s.stats}>
        {statLines(item, gearScale(g)).map((l) => (
          <div key={l.key} className={s.statRow}>
            <span className={l.main ? s.statMain : s.statSub}>
              {t(`stat.${l.stat}`)}
              {l.mode === 'pct' ? ' %' : ''}
            </span>
            <span>{formatStatValue(l.stat, l.mode, l.value)}</span>
          </div>
        ))}
        {perk && (
          <div className={s.mintPerk}>
            <PixelArt art={uiBitArt('sparkle')} />
            <span>
              {perk.name}: {perk.text}
            </span>
          </div>
        )}
      </div>
      {enchanted && (
        <div className={s.enchantList}>
          <div className={s.enchantHead}>
            <span>{t(item.enchants.length === 1 ? 'item.enchantOne' : 'item.enchantMany', { n: item.enchants.length })}</span>
            <span className={s.rarerTag}>{t('item.rarer', { x: fmtTimes(ench.count) })}</span>
          </div>
          {item.enchants.map((en, i) => (
            <div key={en.id} className={s.enchantRow}>
              <span className={s.enchantChip} style={{ background: enchantColor(en.id) }}>
                {enchantLabel(en.id, en.tier)}
              </span>
              <span className={s.enchantText}>{enchantDesc(en.id, en.tier)}</span>
              <span className={s.rarerTag}>{t('item.times', { x: fmtTimes(ench.tiers[i]) })}</span>
            </div>
          ))}
        </div>
      )}
      <p className={s.flavor}>“{itemFlavor(item)}”</p>
      {/* Polish (a boost): a Mythic-or-better item gets +1 tier on an enchantment, or a new one. */}
      {polishOk && (
        <div className={s.boostOffer}>
          <StarIcon size="nav" />
          <div className={s.boostOfferText}>
            <b>{t('boosts.polish')}</b>
            <span>{t('boosts.polishText')}</span>
          </div>
          <BoostButtons id="polish" target={{ uid: item.uid }} column />
        </div>
      )}
      <div className={s.actions}>
        {equipped ? (
          <span className={s.equippedTag}>
            <CheckIcon size="md" /> {t('item.equipped')}
          </span>
        ) : (
          <>
            <button
              className="btn blue"
              onClick={() => {
                haptics.impact('light');
                dispatch({ type: 'toggleLock', uid: item.uid });
              }}
            >
              <LockIcon />
              {item.locked ? t('item.unlock') : t('item.lock')}
            </button>
            <button
              className="btn red"
              disabled={item.locked}
              onClick={() => {
                haptics.impact('medium');
                dispatch({ type: 'scrapItem', uid: item.uid });
                onClose();
              }}
            >
              <TrashIcon />
              {t('item.scrap')} {formatNumber(scrapGold)}
            </button>
          </>
        )}
      </div>
      {!equipped && <p className={s.dragHint}>{t('item.dragHint')}</p>}
      {!equipped && <p className={s.note}>{t('item.lockedNote')}</p>}
    </Modal>
  );
}
