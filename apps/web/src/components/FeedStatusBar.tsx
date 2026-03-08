import type { FeedStatus } from "@sat/shared-types";
import type { TacticalMapDiagnostics } from "./TacticalMap";

type Props = {
  statuses: Record<"ais" | "opensky" | "flightaware", FeedStatus>;
  mapDiagnostics?: TacticalMapDiagnostics;
};

export function FeedStatusBar({ statuses, mapDiagnostics }: Props) {
  return (
    <div className="feed-status-bar">
      {(["ais", "opensky", "flightaware"] as const).map((feed) => (
        <div key={feed} className={`feed-pill feed-pill-${statuses[feed]}`}>
          <strong>{feed.toUpperCase()}</strong> {statuses[feed]}
        </div>
      ))}
      {mapDiagnostics && (
        <div
          className={`feed-pill map-pill map-pill-${mapDiagnostics.status}`}
          title={mapDiagnostics.reason || undefined}
        >
          <strong>MAP</strong> {mapDiagnostics.status}
        </div>
      )}
    </div>
  );
}
