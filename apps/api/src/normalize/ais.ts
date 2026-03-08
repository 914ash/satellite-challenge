import type { VesselEntity } from "@sat/shared-types";

type AisPayload = {
  MessageType?: string;
  Message?: Record<string, unknown>;
};

function readPositionReport(message: Record<string, unknown> | undefined): {
  mmsi: number;
  lon: number;
  lat: number;
  cog: number | null;
  sog: number | null;
} | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const report = message.PositionReport as Record<string, unknown> | undefined;
  if (!report) {
    return null;
  }

  const mmsi = typeof report.UserID === "number" ? report.UserID : null;
  const lon = typeof report.Longitude === "number" ? report.Longitude : null;
  const lat = typeof report.Latitude === "number" ? report.Latitude : null;
  const cog = typeof report.Cog === "number" ? report.Cog : null;
  const sog = typeof report.Sog === "number" ? report.Sog : null;

  if (mmsi === null || lon === null || lat === null) {
    return null;
  }

  return { mmsi, lon, lat, cog, sog };
}

export function normalizeAisMessage(payload: AisPayload, ts: number): VesselEntity | null {
  const message = payload.Message as Record<string, unknown> | undefined;
  const pos = readPositionReport(message);
  if (!pos) {
    return null;
  }

  const shipStaticData = message?.ShipStaticData as Record<string, unknown> | undefined;
  const shipName = typeof shipStaticData?.Name === "string" ? shipStaticData.Name.trim() : null;

  return {
    id: `sea:${pos.mmsi}`,
    source: "vessel",
    mmsi: pos.mmsi,
    shipName: shipName || null,
    lon: pos.lon,
    lat: pos.lat,
    headingDeg: pos.cog,
    speedKnots: pos.sog,
    updatedAt: ts
  };
}
