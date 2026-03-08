export type FeedName = "ais" | "opensky" | "flightaware";
export type FeedStatus = "ok" | "degraded" | "down";

export interface BaseEntity {
  id: string;
  source: "aircraft" | "vessel";
  lat: number;
  lon: number;
  headingDeg: number | null;
  speedKnots: number | null;
  updatedAt: number;
}

export interface AircraftEntity extends BaseEntity {
  source: "aircraft";
  icao24: string;
  callsign: string | null;
  altitudeMeters: number | null;
}

export interface VesselEntity extends BaseEntity {
  source: "vessel";
  mmsi: number;
  shipName: string | null;
}

export type TrackedEntity = AircraftEntity | VesselEntity;

export interface FlightDetail {
  icao24: string;
  operatorName: string | null;
  aircraftType: string | null;
  origin: string | null;
  destination: string | null;
  fetchedAt: number;
}

export type LiveEvent =
  | { type: "entity.upsert"; ts: number; entity: TrackedEntity }
  | { type: "entity.remove"; ts: number; entityId: string }
  | {
      type: "feed.status";
      ts: number;
      feed: FeedName;
      status: FeedStatus;
      detail?: string;
    };

export type EntityPanelState = "loading" | "ready" | "degraded" | "unavailable";

export interface ReplayQuery {
  from: number;
  to: number;
  bbox?: [number, number, number, number];
}
