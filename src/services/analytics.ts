/** Analytics wrapper. Milestone 6 wires Firebase/GameAnalytics behind this; for now it logs in dev. */
export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

export interface AnalyticsSink {
  track(event: string, params?: AnalyticsParams): void;
}

class ConsoleSink implements AnalyticsSink {
  track(event: string, params?: AnalyticsParams) {
    if (import.meta.env.DEV) console.debug('[analytics]', event, params ?? {});
  }
}

let sink: AnalyticsSink = new ConsoleSink();

export const analytics = {
  setSink(s: AnalyticsSink) {
    sink = s;
  },
  track(event: string, params?: AnalyticsParams) {
    try {
      sink.track(event, params);
    } catch {
      /* analytics must never break the game */
    }
  },
};
