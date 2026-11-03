import { Component, type ReactNode } from 'react';
import { useUi } from '../uiStore';

/**
 * Keeps an overlay's error from taking the whole game down: if a full-screen moment (reveal, haul,
 * rebirth, popups...) throws while rendering, it is logged and closed, and the game keeps running.
 */
export class SafeLayer extends Component<{ name: string; children: ReactNode }, { failed: number }> {
  state = { failed: 0 };

  static getDerivedStateFromError(): { failed: number } {
    return { failed: Date.now() };
  }

  componentDidCatch(error: unknown): void {
    console.error(`[${this.props.name}] overlay error, closed it:`, error);
    // Close whatever was showing so it can't throw again on the next render.
    useUi.setState({ haul: null, celebrate: null, charging: null, rebirthFx: null, unlocked: null, popup: null, drag: null });
    setTimeout(() => this.setState({ failed: 0 }), 0);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
