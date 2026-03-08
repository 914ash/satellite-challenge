import type { AircraftEntity } from "@sat/shared-types";

const MS_TO_KNOTS = 1.943844;

export function normalizeOpenSkyState(state: unknown[], ts: number): AircraftEntity | null {
  const icao24 = typeof state[0] === "string" ? state[0].toLowerCase() : null;
  const callsign = typeof state[1] === "string" ? state[1].trim() : null;
  const lon = typeof state[5] === "number" ? state[5] : null;
  const lat = typeof state[6] === "number" ? state[6] : null;
  const altitudeMeters = typeof state[7] === "number" ? state[7] : null;
  const speedMs = typeof state[9] === "number" ? state[9] : null;
  const headingDeg = typeof state[10] === "number" ? state[10] : null;

  if (!icao24 || lon === null || lat === null) {
    return null;
  }

  return {
    id: `air:${icao24}`,
    source: "aircraft",
    icao24,
    callsign: callsign || null,
    lon,
    lat,
    altitudeMeters,
    headingDeg,
    speedKnots: speedMs === null ? null : Number((speedMs * MS_TO_KNOTS).toFixed(2)),
    updatedAt: ts
  };
}
