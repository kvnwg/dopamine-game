import { Component, type ReactNode } from 'react';
import { useUi, type UiState } from '../uiStore';

/**
 * Keeps a part of the screen's error from taking the whole game down: if it throws while rendering,
 * it is logged, what it was showing is closed (`reset`, the UI state it shows; `onError` for what the
 * store can't close), and it is tried again a moment later (`retryMs`, doubling each time it fails
 * again, up to 10 s). Only its own state is closed: a glitch in one part no longer closes a running
 * reveal or an open popup elsewhere.
 */
export class SafeLayer extends Component<
  { name: string; children: ReactNode; onError?: () => void; retryMs?: number; reset?: Partial<UiState> },
  { failed: number }
> {
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
    // Close what it was showing so it can't throw again on the next render.
    if (this.props.reset) useUi.setState(this.props.reset);
    this.props.onError?.();
    const wait = Math.min(10_000, (this.props.retryMs ?? 250) * 2 ** (this.streak - 1));
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
