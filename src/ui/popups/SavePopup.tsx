/**
 * Settings → Your save: where the game is kept, a save code to copy out (a backup the player keeps,
 * or the way to another device), a code to paste in, and the rescued save if one ever failed to load.
 */
import { useEffect, useRef, useState } from 'react';
import { readSave, type GameState } from '../../core';
import { getGame } from '../../app/store';
import { saveManager, switchToSave } from '../../app/session';
import { haptics } from '../../services';
import { cloudStatus } from '../../services/cloudSave';
import { codeToSave, saveToCode } from '../../services/saveCode';
import { t } from '../i18n';
import { Modal } from './Modal';
import s from './popups.module.css';

export function SavePopup({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [rescue, setRescue] = useState<GameState | null>(null);
  // Loading a save replaces this game: a second tap confirms.
  const [armed, setArmed] = useState<'code' | 'rescue' | null>(null);
  const out = useRef<HTMLTextAreaElement>(null);
  const status = cloudStatus();

  useEffect(() => {
    let live = true;
    void saveToCode(getGame()).then((c) => live && setCode(c));
    void saveManager.rescued().then((text) => live && setRescue(readSave(text)?.state ?? null));
    return () => {
      live = false;
    };
  }, []);

  const copy = async () => {
    out.current?.select();
    try {
      await navigator.clipboard.writeText(code);
      setMsg(t('save.copied'));
    } catch {
      // (No clipboard in some frames: the code is selected for a long-press copy.)
      setMsg(t('save.copySelect'));
    }
    haptics.impact('light');
  };

  const arm = (which: 'code' | 'rescue') => {
    setArmed(which);
    haptics.impact('medium');
    setTimeout(() => setArmed((a) => (a === which ? null : a)), 4000);
  };

  const loadCode = async () => {
    const got = await codeToSave(paste);
    if (!got) {
      setMsg(t('save.bad'));
      return;
    }
    if (armed !== 'code') return arm('code');
    await switchToSave(got.state);
  };

  const loadRescue = async () => {
    if (!rescue) return;
    if (armed !== 'rescue') return arm('rescue');
    await switchToSave(rescue);
  };

  return (
    <Modal title={t('save.title')} onClose={onClose}>
      <p className={s.note} style={{ marginTop: 0 }}>
        {status === 'on' || status === 'pending' ? t('save.cloudOn') : t('save.cloudOff')}
      </p>
      <div className={s.section}>{t('save.codeTitle')}</div>
      <p className={s.note} style={{ marginTop: 0 }}>{t('save.codeWhat')}</p>
      <textarea ref={out} className={s.code} readOnly value={code} onFocus={(e) => e.currentTarget.select()} aria-label={t('save.codeTitle')} />
      <button className="btn small blue" onClick={() => void copy()} disabled={!code}>
        {t('save.copy')}
      </button>
      <div className={s.section}>{t('save.loadTitle')}</div>
      <textarea
        className={s.code}
        value={paste}
        placeholder="DL1:..."
        onChange={(e) => {
          setPaste(e.target.value);
          setMsg(null);
        }}
        aria-label={t('save.loadTitle')}
      />
      <button className={`btn small ${armed === 'code' ? 'red' : 'green'}`} onClick={() => void loadCode()} disabled={!paste.trim()}>
        {armed === 'code' ? t('save.loadConfirm') : t('save.load')}
      </button>
      {rescue && (
        <>
          <div className={s.section}>{t('save.rescueTitle')}</div>
          <p className={s.note} style={{ marginTop: 0 }}>
            {t('save.rescueWhat', { level: rescue.player.level, world: Math.max(1, rescue.stage.highestCleared) })}
          </p>
          <button className={`btn small ${armed === 'rescue' ? 'red' : 'gold'}`} onClick={() => void loadRescue()}>
            {armed === 'rescue' ? t('save.loadConfirm') : t('save.rescueLoad')}
          </button>
        </>
      )}
      {msg && <p className={s.note}>{msg}</p>}
    </Modal>
  );
}
