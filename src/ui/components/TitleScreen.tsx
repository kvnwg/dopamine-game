import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getGame } from '../../app/store';
import { isHeld, startGame } from '../../app/session';
import { haptics } from '../../services';
import { audio } from '../../services/audio';
import { P } from '../../render/pixel';
import { setTitleShape, TITLE, TitleRenderer, titleLayout } from '../../render/titleScene';
import { useUi } from '../uiStore';
import { t } from '../i18n';
import s from './title.module.css';

/** Starts the game whatever went wrong: the title must never stand between the player and it. */
function startAnyway(err: unknown): void {
  console.error('[title] failed; starting the game:', err);
  startGame();
}

/**
 * The title screen, on every start (main.ts holds the game until PLAY; `?notitle` skips it). The
 * picture and its animation are src/render/titleScene.ts: the street scrolling by while the bare
 * raccoon walks, the logo bobbing, the PLAY button breathing with a glint now and then. A tap anywhere
 * (or Enter / Space) is PLAY: the button flashes and throws sparks, the raccoon hops and cheers, an iris
 * closes on him, the game starts under it, and the iris opens on him in the battle.
 */
function Title({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<TitleRenderer | null>(null);
  const name = t('title.name');
  const label = t('title.play');
  // Tall (phones) or wide (PC): the picture is laid out for the stage it fills.
  const wide = useUi((u) => u.wide);
  const button = useMemo(() => {
    setTitleShape(wide);
    return titleLayout(label).button;
  }, [label, wide]);

  // Before the first paint, so the canvas never shows empty.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { reduceMotion, reduceFlashing } = getGame().settings;
    try {
      setTitleShape(wide);
      titleRef.current = new TitleRenderer(canvas, { label, reduceMotion, reduceFlashing });
    } catch (err) {
      startAnyway(err);
      onClose();
      return;
    }
    return () => {
      titleRef.current?.destroy();
      titleRef.current = null;
    };
  }, [label, onClose, wide]);

  const play = useCallback(() => {
    const title = titleRef.current;
    if (!title || title.started) return;
    // This tap is the one that unlocks audio (soundController does too, on pointerdown).
    audio.unlock();
    audio.titleStart();
    haptics.impact('medium');
    title.play({
      hop: () => audio.titleHop(),
      land: () => haptics.impact('light'),
      close: () => audio.titleIris(false),
      covered: () => {
        try {
          startGame();
        } catch (err) {
          console.error(err);
        }
      },
      open: () => {
        rootRef.current?.setAttribute('data-phase', 'open');
        audio.titleIris(true);
      },
      done: onClose,
    });
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      play();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play]);

  const press = (down: boolean) => titleRef.current?.setPressed(down);

  return (
    <div
      ref={rootRef}
      className={s.title}
      data-title
      onClick={play}
      onPointerDown={() => press(true)}
      onPointerUp={() => press(false)}
      onPointerCancel={() => press(false)}
      onPointerLeave={() => press(false)}
    >
      <canvas ref={canvasRef} className={s.canvas} style={{ width: TITLE.w * P, height: TITLE.h * P }} aria-hidden />
      <h1 className={s.name}>{name}</h1>
      <button
        type="button"
        className={s.play}
        data-no-tap-sound
        aria-label={label}
        style={{ left: button.x * P, top: button.y * P, width: button.w * P, height: button.h * P }}
      >
        {label}
      </button>
    </div>
  );
}

/** If the title throws while rendering, it closes and the game starts. */
class TitleBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    startAnyway(error);
    this.props.onError();
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export function TitleScreen() {
  const [open, setOpen] = useState(isHeld);
  const close = useCallback(() => setOpen(false), []);
  if (!open) return null;
  return (
    <TitleBoundary onError={close}>
      <Title onClose={close} />
    </TitleBoundary>
  );
}
