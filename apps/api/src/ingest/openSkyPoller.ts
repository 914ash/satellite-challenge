import type { LiveEvent } from "@sat/shared-types";
import { normalizeOpenSkyState } from "../normalize/opensky.js";

type OpenSkyPollerOptions = {
  pollIntervalMs: number;
  username?: string;
  password?: string;
  onEvent: (event: LiveEvent) => void;
  onStatus: (status: LiveEvent) => void;
};

type OpenSkyResponse = {
  states: unknown[][];
};

export class OpenSkyPoller {
  private timer?: NodeJS.Timeout;

  constructor(private readonly opts: OpenSkyPollerOptions) {}

  start(): void {
    void this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, this.opts.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async poll(): Promise<void> {
    const url =
      "https://opensky-network.org/api/states/all?lamin=12&lomin=32&lamax=36&lomax=60";

    try {
      const headers: Record<string, string> = {};
      if (this.opts.username && this.opts.password) {
        const token = Buffer.from(`${this.opts.username}:${this.opts.password}`).toString(
          "base64"
        );
        headers.Authorization = `Basic ${token}`;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`OpenSky failed with ${response.status}`);
      }
      const payload = (await response.json()) as OpenSkyResponse;
      const ts = Date.now();

      for (const state of payload.states ?? []) {
        const normalized = normalizeOpenSkyState(state, ts);
        if (!normalized) {
          continue;
        }
        this.opts.onEvent({
          type: "entity.upsert",
          ts,
          entity: normalized
        });
      }

      this.opts.onStatus({
        type: "feed.status",
        ts,
        feed: "opensky",
        status: "ok"
      });
    } catch (error) {
      this.opts.onStatus({
        type: "feed.status",
        ts: Date.now(),
        feed: "opensky",
        status: "degraded",
        detail: error instanceof Error ? error.message : "OpenSky poll failed"
      });
    }
  }
}
