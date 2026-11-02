import type { CoreEvent } from '../core';

type Handler = (events: CoreEvent[]) => void;

/** Fan-out of core events to the renderer and UI. Events are never stored in GameState. */
class EventBus {
  private handlers = new Set<Handler>();
  on(h: Handler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  emit(events: CoreEvent[]): void {
    if (events.length === 0) return;
    for (const h of this.handlers) h(events);
  }
}

export const bus = new EventBus();
