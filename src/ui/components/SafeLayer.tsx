import { Component, type ReactNode } from 'react';
import { useUi } from '../uiStore';

/**
 * Keeps an overlay's error from taking the whole game down: if a full-screen moment (reveal, haul,
 * rebirth, popups, the Upgrades screen...) throws while rendering, it is logged and closed (`onError`
 * closes what the store can't), and the game keeps running.
 */
export class SafeLayer extends Component<{ name: string; children: ReactNode; onError?: () => void; retryMs?: number }, { failed: number }> {
  state = { failed: 0 };
  /** Errors in a row (a part that keeps failing waits longer each time before it's tried again). */
  private streak = 0;
  private lastAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): { failed: number } {
    return { failed: Date.now() };
  }

  componentDidCatch(error: unknown): void {
    const now = Date.now();
    this.streak = now - this.lastAt < 15_000 ? this.streak + 1 : 1;
    this.lastAt = now;
    if (this.streak <= 3) console.error(`[${this.props.name}] error, closed it:`, error);
    // Close whatever was showing so it can't throw again on the next render.
    useUi.setState({ haul: null, celebrate: null, charging: null, rebirthFx: null, unlocked: null, popup: null, drag: null });
    this.props.onError?.();
    // Overlays come back at once (closed); a part of the screen that's always there (the battle, a
    // tab's panel) is tried again after `retryMs`, longer each time it fails again (up to 10 s).
    const wait = this.props.retryMs ? Math.min(10_000, this.props.retryMs * 2 ** (this.streak - 1)) : 0;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.setState({ failed: 0 });
    }, wait);
  }

  componentWillUnmount(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
