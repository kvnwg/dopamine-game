import { useGame } from '../../app/store';
import { useUi } from '../uiStore';
import { CodexPopup } from './CodexPopup';
import { ItemDetailPopup } from './ItemDetailPopup';
import { LuckPopup } from './LuckPopup';
import { OfflinePopup } from './OfflinePopup';
import { SettingsPopup } from './SettingsPopup';
import { UpgradePopup } from './UpgradePopup';
import { WorldPopup } from './WorldPopup';

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
    default:
      return null;
  }
}
