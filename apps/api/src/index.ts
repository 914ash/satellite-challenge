import http from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import type { FeedStatus, LiveEvent } from "@sat/shared-types";
import { env } from "./config/env.js";
import { createApiApp, type MapDiagnostics, type PublicMapConfig } from "./http/app.js";
import { EntityStore } from "./store/entityStore.js";
import { ReplayBuffer } from "./store/replayBuffer.js";
import { FlightAwareClient } from "./enrichment/flightAwareClient.js";
import { createFlightAwareFetcher } from "./enrichment/flightAwareFetcher.js";
import { AisClient } from "./ingest/aisClient.js";
import { OpenSkyPoller } from "./ingest/openSkyPoller.js";

const entityStore = new EntityStore();
const replayBuffer = new ReplayBuffer<LiveEvent>(env.REPLAY_RETENTION_MS);

const feedHealth: Record<"ais" | "opensky" | "flightaware", FeedStatus> = {
  ais: env.AISSTREAM_API_KEY ? "degraded" : "down",
  opensky: "degraded",
  flightaware: env.FLIGHTAWARE_API_KEY ? "degraded" : "down"
};

const mapConfig: PublicMapConfig = {
  mapStyle: env.MAP_STYLE,
  defaultCenter: env.MAP_DEFAULT_CENTER,
  defaultZoom: env.MAP_DEFAULT_ZOOM,
  satelliteModeDefault: env.MAP_SATELLITE_MODE_DEFAULT
};

const flightAwareClient = new FlightAwareClient(
  createFlightAwareFetcher(env.FLIGHTAWARE_API_KEY),
  env.FLIGHTAWARE_TTL_MS
);

const server = http.createServer();
const wsServer = new WebSocketServer({ server, path: "/ws/live" });

function broadcast(event: LiveEvent): void {
  const payload = JSON.stringify(event);
  for (const client of wsServer.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

function ingestEvent(event: LiveEvent): void {
  if (event.type === "entity.upsert") {
    entityStore.upsert(event.entity);
  }
  if (event.type === "entity.remove") {
    entityStore.remove(event.entityId);
  }
  if (event.type === "feed.status") {
    const feedKey = event.feed;
    feedHealth[feedKey] = event.status;
  }
  replayBuffer.add(event);
  broadcast(event);
}

function summarizeFeedHealth(
  feeds: Record<"ais" | "opensky" | "flightaware", FeedStatus>
): MapDiagnostics["feeds"]["summary"] {
  const summary: MapDiagnostics["feeds"]["summary"] = {
    ok: 0,
    degraded: 0,
    down: 0,
    total: 0
  };
  for (const status of Object.values(feeds)) {
    summary[status] += 1;
    summary.total += 1;
  }
  return summary;
}

const app = createApiApp({
  entityStore,
  replayBuffer,
  getFeedHealth: () => feedHealth,
  getMapboxToken: () => env.MAPBOX_ACCESS_TOKEN,
  getMapConfig: () => mapConfig,
  getMapDiagnostics: () => ({
    now: Date.now(),
    configAvailability: {
      mapboxToken: Boolean(env.MAPBOX_ACCESS_TOKEN),
      mapStyle: Boolean(mapConfig.mapStyle),
      defaultCenter:
        Number.isFinite(mapConfig.defaultCenter[0]) && Number.isFinite(mapConfig.defaultCenter[1]),
      defaultZoom: Number.isFinite(mapConfig.defaultZoom),
      satelliteModeDefault: typeof mapConfig.satelliteModeDefault === "boolean"
    },
    feeds: {
      byFeed: feedHealth,
      summary: summarizeFeedHealth(feedHealth)
    }
  }),
  getFlightDetail: async (icao24) => {
    const detail = await flightAwareClient.getDetails(icao24);
    feedHealth.flightaware = detail ? "ok" : "degraded";
    return detail;
  },
  onLiveEvent: broadcast
});
server.on("request", app);

wsServer.on("connection", (socket: WebSocket) => {
  for (const entity of entityStore.list()) {
    socket.send(
      JSON.stringify({
        type: "entity.upsert",
        ts: Date.now(),
        entity
      } as LiveEvent)
    );
  }
  (Object.entries(feedHealth) as Array<["ais" | "opensky" | "flightaware", FeedStatus]>).forEach(
    ([feed, status]) => {
      socket.send(
        JSON.stringify({
          type: "feed.status",
          ts: Date.now(),
          feed,
          status
        } as LiveEvent)
      );
    }
  );
});

const aisClient = new AisClient({
  apiKey: env.AISSTREAM_API_KEY,
  onEvent: ingestEvent,
  onStatus: ingestEvent
});
const openSkyPoller = new OpenSkyPoller({
  pollIntervalMs: env.OPENSKY_POLL_INTERVAL_MS,
  username: env.OPENSKY_USERNAME,
  password: env.OPENSKY_PASSWORD,
  onEvent: ingestEvent,
  onStatus: ingestEvent
});

aisClient.start();
openSkyPoller.start();

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.PORT}`);
});
