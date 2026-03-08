import type { FlightDetail, TrackedEntity } from "@sat/shared-types";
import { getSafeFieldValue } from "../utils/apiDataGuard";

type DetailState = "idle" | "loading" | "ready" | "degraded" | "unavailable";

type Props = {
  entity: TrackedEntity | null;
  detailState?: DetailState;
  detail?: FlightDetail | null;
  detailMessage?: string;
};

function field(name: string, value: unknown) {
  return (
    <div className="panel-field">
      <span>{name}</span>
      <strong>{getSafeFieldValue(value)}</strong>
    </div>
  );
}

export function EntityPanel({ entity, detailState = "idle", detail, detailMessage }: Props) {
  if (!entity) {
    return (
      <aside className="entity-panel">
        <h2>Entity</h2>
        <p>Select an aircraft or vessel on the map.</p>
      </aside>
    );
  }

  return (
    <aside className="entity-panel">
      <h2>{entity.source === "aircraft" ? "Aircraft" : "Vessel"} Details</h2>
      {field("ID", entity.id)}
      {entity.source === "aircraft" ? field("Callsign", entity.callsign) : field("Name", entity.shipName)}
      {entity.source === "aircraft" ? field("ICAO24", entity.icao24) : field("MMSI", entity.mmsi)}
      {field("Latitude", entity.lat.toFixed(4))}
      {field("Longitude", entity.lon.toFixed(4))}
      {field("Speed (kt)", entity.speedKnots)}
      {field("Heading", entity.headingDeg)}
      {entity.source === "aircraft" && (
        <>
          <h3>Flight Enrichment</h3>
          {detailState === "loading" && <p>Loading flight details...</p>}
          {detailState === "degraded" && (
            <p className="degraded-text">
              {detailMessage || "Flight details currently unavailable"}
            </p>
          )}
          {detailState === "ready" && detail && (
            <>
              {field("Operator", detail.operatorName)}
              {field("Aircraft", detail.aircraftType)}
              {field("Origin", detail.origin)}
              {field("Destination", detail.destination)}
            </>
          )}
        </>
      )}
    </aside>
  );
}
