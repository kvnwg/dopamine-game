import type { Slot } from '../../data';
import { useGame } from '../../app/store';
import { useUi } from '../uiStore';
import { AutoDiveUnlockPopup } from './AutoDiveUnlockPopup';
import { CodexPopup } from './CodexPopup';
import { CompareCard } from './CompareCard';
import { FiltersPopup } from './FiltersPopup';
import { ItemDetailPopup } from './ItemDetailPopup';
import { OddsPopup } from './OddsPopup';
import { OfflinePopup } from './OfflinePopup';
import { SettingsPopup } from './SettingsPopup';
import { UpgradePopup } from './UpgradePopup';

/** One popup at a time, by priority: offline rewards > system unlock > compare card > menus. */
export function PopupLayer() {
  const offline = useGame((g) => g.offline.pending);
  const autoUnlock = useGame((g) => g.autoDive.unlocked && !g.autoDive.unlockSeen);
  const pending = useGame((g) => g.pendingItem);
  const revealedUid = useUi((u) => u.revealedUid);
  const flip = useUi((u) => u.flip);
  const popup = useUi((u) => u.popup);
  const detailSlot = useUi((u) => u.detailSlot);
  const close = () => useUi.getState().openPopup(null);

  if (offline) return <OfflinePopup pending={offline} />;
  if (pending && revealedUid === pending.uid && !flip) return <CompareCard item={pending} />;
  if (autoUnlock && !flip) return <AutoDiveUnlockPopup />;
  switch (popup) {
    case 'settings':
      return <SettingsPopup onClose={close} />;
    case 'codex':
      return <CodexPopup onClose={close} />;
    case 'odds':
      return <OddsPopup onClose={close} />;
    case 'upgrade':
      return <UpgradePopup onClose={close} />;
    case 'filters':
      return <FiltersPopup onClose={close} />;
    case 'itemDetail':
      return detailSlot ? <ItemDetailPopup slot={detailSlot as Slot} onClose={close} /> : null;
    default:
      return null;
  }
}
