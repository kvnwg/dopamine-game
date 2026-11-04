import type { CoreEvent } from '../core';

type Handler = (events: CoreEvent[]) => void;

/** Fan-out of core events to the renderer and UI. Events are never stored in GameState. */
class EventBus {
  private handlers = new Set<Handler>();
  on(h: Handler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  /**
   * Every listener hears every batch: one that fails (a sound, an effect) is reported and skipped,
   * never taking the others (or the game update that sent the batch) down with it.
   */
  emit(events: CoreEvent[]): void {
    if (events.length === 0) return;
    for (const h of this.handlers) {
      try {
        h(events);
      } catch (e) {
        console.error('event listener failed', e);
      }
    }
  }
}

export const bus = new EventBus();
