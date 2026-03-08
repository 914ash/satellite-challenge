import WebSocket from "ws";
import type { LiveEvent } from "@sat/shared-types";
import { normalizeAisMessage } from "../normalize/ais.js";

type AisClientOptions = {
  apiKey?: string;
  onEvent: (event: LiveEvent) => void;
  onStatus: (status: LiveEvent) => void;
};

export class AisClient {
  private ws?: WebSocket;

  private reconnectTimer?: NodeJS.Timeout;

  private reconnectAttempt = 0;

  constructor(private readonly opts: AisClientOptions) {}

  start(): void {
    if (!this.opts.apiKey) {
      this.opts.onStatus({
        type: "feed.status",
        ts: Date.now(),
        feed: "ais",
        status: "degraded",
        detail: "AISSTREAM_API_KEY not configured"
      });
      return;
    }

    this.connect();
  }

  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }

  private connect(): void {
    this.ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    this.ws.on("open", () => {
      this.reconnectAttempt = 0;
      this.opts.onStatus({
        type: "feed.status",
        ts: Date.now(),
        feed: "ais",
        status: "ok"
      });
      this.ws?.send(
        JSON.stringify({
          APIKey: this.opts.apiKey,
          BoundingBoxes: [
            [
              [12, 32],
              [36, 60]
            ]
          ],
          FilterMessageTypes: ["PositionReport"]
        })
      );
    });

    this.ws.on("message", (raw: WebSocket.RawData) => {
      try {
        const payload = JSON.parse(raw.toString()) as Record<string, unknown>;
        const normalized = normalizeAisMessage(payload, Date.now());
        if (!normalized) {
          return;
        }
        this.opts.onEvent({
          type: "entity.upsert",
          ts: Date.now(),
          entity: normalized
        });
      } catch {
        this.opts.onStatus({
          type: "feed.status",
          ts: Date.now(),
          feed: "ais",
          status: "degraded",
          detail: "Invalid AIS payload received"
        });
      }
    });

    this.ws.on("close", () => this.scheduleReconnect());
    this.ws.on("error", () => {
      this.opts.onStatus({
        type: "feed.status",
        ts: Date.now(),
        feed: "ais",
        status: "degraded",
        detail: "AIS websocket error"
      });
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt += 1;
    const backoffMs = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempt);
    this.opts.onStatus({
      type: "feed.status",
      ts: Date.now(),
      feed: "ais",
      status: "degraded",
      detail: `Reconnecting in ${backoffMs}ms`
    });
    this.reconnectTimer = setTimeout(() => this.connect(), backoffMs);
  }
}
