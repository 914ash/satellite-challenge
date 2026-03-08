import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApiApp } from "../src/http/app.js";
import { EntityStore } from "../src/store/entityStore.js";
import { ReplayBuffer } from "../src/store/replayBuffer.js";
import type { LiveEvent, TrackedEntity } from "@sat/shared-types";

describe("HTTP contracts", () => {
  it("returns public map config including diagnostics-relevant fields", async () => {
    const entityStore = new EntityStore();
    const replayBuffer = new ReplayBuffer<LiveEvent>(60_000);
    const app = createApiApp({
      entityStore,
      replayBuffer,
      getFlightDetail: async () => null,
      getFeedHealth: () => ({
        ais: "ok",
        opensky: "degraded",
        flightaware: "down"
      }),
      getMapboxToken: () => "mapbox-test-token",
      getMapConfig: () => ({
        mapStyle: "mapbox://styles/mapbox/satellite-streets-v12",
        defaultCenter: [45, 24],
        defaultZoom: 4,
        satelliteModeDefault: true
      })
    });

    const res = await request(app).get("/api/public-config");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        mapboxToken: "mapbox-test-token",
        mapStyle: "mapbox://styles/mapbox/satellite-streets-v12",
        defaultCenter: [45, 24],
        defaultZoom: 4,
        satelliteModeDefault: true
      })
    );
  });

  it("returns map diagnostics contract from /api/diagnostics/map", async () => {
    const entityStore = new EntityStore();
    const replayBuffer = new ReplayBuffer<LiveEvent>(60_000);
    const app = createApiApp({
      entityStore,
      replayBuffer,
      getFlightDetail: async () => null,
      getFeedHealth: () => ({
        ais: "ok",
        opensky: "degraded",
        flightaware: "down"
      }),
      getMapDiagnostics: () => ({
        now: 1_739_000_000_000,
        configAvailability: {
          mapboxToken: true,
          mapStyle: true,
          defaultCenter: true,
          defaultZoom: true,
          satelliteModeDefault: true
        },
        feeds: {
          byFeed: {
            ais: "ok",
            opensky: "degraded",
            flightaware: "down"
          },
          summary: {
            ok: 1,
            degraded: 1,
            down: 1,
            total: 3
          }
        }
      })
    });

    const res = await request(app).get("/api/diagnostics/map");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        now: 1_739_000_000_000,
        configAvailability: {
          mapboxToken: true,
          mapStyle: true,
          defaultCenter: true,
          defaultZoom: true,
          satelliteModeDefault: true
        },
        feeds: {
          byFeed: {
            ais: "ok",
            opensky: "degraded",
            flightaware: "down"
          },
          summary: {
            ok: 1,
            degraded: 1,
            down: 1,
            total: 3
          }
        }
      })
    );
  });

  it("returns entity details and avoids raw error placeholders", async () => {
    const entityStore = new EntityStore();
    const replayBuffer = new ReplayBuffer<LiveEvent>(60_000);
    const flightDetails = new Map<string, unknown>();

    const aircraft: TrackedEntity = {
      id: "air:abc123",
      source: "aircraft",
      icao24: "abc123",
      callsign: "TEST1",
      lat: 20,
      lon: 30,
      headingDeg: 90,
      speedKnots: 210,
      altitudeMeters: 1000,
      updatedAt: 1
    };
    entityStore.upsert(aircraft);
    replayBuffer.add({ type: "entity.upsert", ts: 1, entity: aircraft });

    const app = createApiApp({
      entityStore,
      replayBuffer,
      getFlightDetail: async () => null,
      getFeedHealth: () => ({
        ais: "ok",
        opensky: "ok",
        flightaware: "degraded"
      }),
      putFlightDetail: (key, value) => {
        flightDetails.set(key, value);
      }
    });

    const entityRes = await request(app).get("/api/entity/air:abc123");
    expect(entityRes.status).toBe(200);
    expect(entityRes.body.entity.callsign).toBe("TEST1");
    expect(String(entityRes.text).toLowerCase()).not.toContain("\"error\"");

    const flightRes = await request(app).get("/api/flight/abc123/details");
    expect(flightRes.status).toBe(503);
    expect(flightRes.body.state).toBe("degraded");
  });
});
