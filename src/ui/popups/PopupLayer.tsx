import { useGame } from '../../app/store';
import { useUi } from '../uiStore';
import { CodexPopup } from './CodexPopup';
import { ItemDetailPopup } from './ItemDetailPopup';
import { SavePopup } from './SavePopup';
import { AdminPopup } from './AdminPopup';
import { BoostsPopup } from './BoostsPopup';
import { LuckPopup } from './LuckPopup';
import { OfflinePopup } from './OfflinePopup';
import { SettingsPopup } from './SettingsPopup';
import { UpgradePopup } from './UpgradePopup';
import { ScrapAllPopup } from './ScrapAllPopup';
import { WorldPopup } from './WorldPopup';
import { DumpPopup } from './DumpPopup';
import { DailyPopup } from './DailyPopup';

/** One popup at a time: offline rewards first, then whatever menu is open. */
export function PopupLayer() {
  const offline = useGame((g) => g.offline.pending);
  const popup = useUi((u) => u.popup);
  const detailUid = useUi((u) => u.detailUid);
  const close = () => useUi.getState().openPopup(null);

  if (offline) return <OfflinePopup pending={offline} />;
  switch (popup) {
    case 'settings':
      return <SettingsPopup onClose={close} />;
    case 'codex':
      return <CodexPopup onClose={close} />;
    case 'odds':
    case 'luck':
      return <LuckPopup onClose={close} />;
    case 'upgrade':
      return <UpgradePopup onClose={close} />;
    case 'itemDetail':
      return <ItemDetailPopup uid={detailUid ?? -1} onClose={close} />;
    case 'world':
      return <WorldPopup world={detailUid ?? 1} onClose={close} />;
    case 'scrapAll':
      return <ScrapAllPopup onClose={close} />;
    case 'save':
      return <SavePopup onClose={close} />;
    case 'admin':
      return <AdminPopup onClose={close} />;
    case 'dump':
      return <DumpPopup onClose={close} />;
    case 'daily':
      return <DailyPopup onClose={close} />;
    case 'boosts':
      return <BoostsPopup onClose={close} />;
    default:
      return null;
  }
}
