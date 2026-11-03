/**
 * Item unlocks through rebirths: the Rebirth tab previews what the next rebirth adds to the
 * dumpster, and right after a rebirth a card shows the new items. Art is drawn at the game's one
 * pixel size (PixelArt).
 */
import { useEffect } from 'react';
import { DATA } from '../../data';
import { finalUnlock, unlocksAt } from '../../core';
import { useGame } from '../../app/store';
import { audio } from '../../services/audio';
import { itemArt } from '../../render/icons';
import { PixelArt } from './PixelArt';
import { t } from '../i18n';
import { useUi } from '../uiStore';
import s from './unlocks.module.css';

function Strip({ ids }: { ids: string[] }) {
  return (
    <div className={s.strip}>
      {ids.map((id) => (
        <div key={id} className={s.tile} title={DATA.itemsById.get(id)?.name}>
          <PixelArt art={itemArt(id)} />
        </div>
      ))}
    </div>
  );
}

/** What the next rebirth unlocks (Rebirth tab). */
export function UnlockPreview() {
  const rebirths = useGame((g) => g.rebirths);
  const next = rebirths + 1;
  if (rebirths >= finalUnlock()) return <div className={s.preview}><span className={s.title}>{t('rebirth.allUnlocked')}</span></div>;
  const ids = unlocksAt(next).map((i) => i.id);
  return (
    <div className={s.preview}>
      <span className={s.title}>{t('rebirth.unlocksNext', { n: ids.length })}</span>
      <Strip ids={ids} />
    </div>
  );
}

/** After a rebirth (and its burst), the items it added to the dumpster. Tap or wait to close. */
export function UnlockedFx() {
  const unlocked = useUi((u) => u.unlocked);
  const burst = useUi((u) => u.rebirthFx);
  const show = !!unlocked && burst === null;
  useEffect(() => {
    if (!show) return;
    audio.jingle(5);
    const id = setTimeout(() => useUi.setState({ unlocked: null }), 5200);
    return () => clearTimeout(id);
  }, [show]);
  if (!show || !unlocked) return null;
  return (
    <div className={s.fx} onClick={() => useUi.setState({ unlocked: null })}>
      <div className={s.card}>
        <span className={s.big}>{t('rebirth.unlockedTitle')}</span>
        <span className={s.sub}>{t('toast.unlocked', { n: unlocked.ids.length })}</span>
        <Strip ids={unlocked.ids} />
      </div>
    </div>
  );
}
