import express from "express";
import cors from "cors";
import type { FeedStatus, FlightDetail, LiveEvent } from "@sat/shared-types";
import { z } from "zod";
import { EntityStore } from "../store/entityStore.js";
import { ReplayBuffer } from "../store/replayBuffer.js";

export type PublicMapConfig = {
  mapStyle: string;
  defaultCenter: [number, number];
  defaultZoom: number;
  satelliteModeDefault: boolean;
};

export type MapDiagnostics = {
  now: number;
  configAvailability: {
    mapboxToken: boolean;
    mapStyle: boolean;
    defaultCenter: boolean;
    defaultZoom: boolean;
    satelliteModeDefault: boolean;
  };
  feeds: {
    byFeed: Record<"ais" | "opensky" | "flightaware", FeedStatus>;
    summary: {
      ok: number;
      degraded: number;
      down: number;
      total: number;
    };
  };
};

export type ApiAppDeps = {
  entityStore: EntityStore;
  replayBuffer: ReplayBuffer<LiveEvent>;
  getFlightDetail: (icao24: string) => Promise<FlightDetail | null>;
  getFeedHealth: () => Record<"ais" | "opensky" | "flightaware", FeedStatus>;
  getMapboxToken?: () => string | undefined;
  getMapConfig?: () => PublicMapConfig;
  getMapDiagnostics?: () => MapDiagnostics;
  putFlightDetail?: (icao24: string, detail: FlightDetail) => void;
  onLiveEvent?: (event: LiveEvent) => void;
};

const replayQuerySchema = z.object({
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional()
});

const devEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("entity.upsert"),
    ts: z.number(),
    entity: z.any()
  }),
  z.object({
    type: z.literal("entity.remove"),
    ts: z.number(),
    entityId: z.string()
  })
]);

const DEFAULT_PUBLIC_MAP_CONFIG: PublicMapConfig = {
  mapStyle: "mapbox://styles/mapbox/satellite-streets-v12",
  defaultCenter: [45, 24],
  defaultZoom: 4,
  satelliteModeDefault: true
};

export function createApiApp(deps: ApiAppDeps) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({
      now: Date.now(),
      feeds: deps.getFeedHealth()
    });
  });

  app.get("/api/public-config", (_req, res) => {
    const mapConfig = deps.getMapConfig?.() ?? DEFAULT_PUBLIC_MAP_CONFIG;
    res.json({
      mapboxToken: deps.getMapboxToken?.() || null,
      mapStyle: mapConfig.mapStyle,
      defaultCenter: [mapConfig.defaultCenter[0], mapConfig.defaultCenter[1]],
      defaultZoom: mapConfig.defaultZoom,
      satelliteModeDefault: mapConfig.satelliteModeDefault
    });
  });

  const getMapDiagnostics = deps.getMapDiagnostics;
  if (getMapDiagnostics) {
    app.get("/api/diagnostics/map", (_req, res) => {
      res.json(getMapDiagnostics());
    });
  }

  app.get("/api/replay", (req, res) => {
    const parsed = replayQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ state: "unavailable", message: "Invalid replay query" });
      return;
    }
    const now = Date.now();
    const from = parsed.data.from ?? now - 60 * 60 * 1000;
    const to = parsed.data.to ?? now;
    const events = deps.replayBuffer.getRange(from, to);
    res.json({ state: "ready", from, to, events });
  });

  app.get("/api/entity/:id", (req, res) => {
    const entity = deps.entityStore.get(req.params.id);
    if (!entity) {
      res.status(404).json({ state: "unavailable", message: "Entity not found" });
      return;
    }
    res.json({ state: "ready", entity });
  });

  app.get("/api/flight/:icao24/details", async (req, res) => {
    const detail = await deps.getFlightDetail(req.params.icao24);
    if (!detail) {
      res
        .status(503)
        .json({ state: "degraded", message: "Flight details currently unavailable" });
      return;
    }
    deps.putFlightDetail?.(req.params.icao24, detail);
    res.json({ state: "ready", detail });
  });

  app.post("/api/dev/events", (req, res) => {
    const parsed = devEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ state: "unavailable", message: "Invalid event payload" });
      return;
    }

    const event = parsed.data as LiveEvent;
    if (event.type === "entity.upsert") {
      deps.entityStore.upsert(event.entity);
    }
    if (event.type === "entity.remove") {
      deps.entityStore.remove(event.entityId);
    }

    deps.replayBuffer.add(event);
    deps.onLiveEvent?.(event);
    res.status(201).json({ state: "ready" });
  });

  return app;
}
