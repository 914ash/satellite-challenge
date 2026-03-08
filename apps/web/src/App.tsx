import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlightDetail, LiveEvent, TrackedEntity } from "@sat/shared-types";
import { FeedStatusBar } from "./components/FeedStatusBar";
import {
  DEFAULT_MAP_STYLE_URL,
  TacticalMap,
  type TacticalMapDiagnostics
} from "./components/TacticalMap";
import { EntityPanel } from "./components/EntityPanel";
import { TimelineScrubber } from "./components/TimelineScrubber";
import { applyLiveEvent, buildEntitySnapshot, type FeedState } from "./state/liveState";

function wsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/live`;
}

type PublicMapConfig = {
  style?: string | null;
  styleUrl?: string | null;
};

type PublicConfigPayload = {
  mapboxToken?: string | null;
  mapStyle?: string | null;
  defaultCenter?: [number, number] | null;
  defaultZoom?: number | null;
  satelliteModeDefault?: boolean | null;
  mapStyleUrl?: string | null;
  map?: PublicMapConfig | null;
};

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function resolveMapStyleUrl(payload: PublicConfigPayload): string {
  return (
    firstNonEmpty([
      payload.map?.styleUrl,
      payload.map?.style,
      payload.mapStyleUrl,
      payload.mapStyle
    ]) || DEFAULT_MAP_STYLE_URL
  );
}

function resolveMapCenter(payload: PublicConfigPayload): [number, number] {
  const fallback: [number, number] = [45, 24];
  const value = payload.defaultCenter;
  if (!Array.isArray(value) || value.length !== 2) {
    return fallback;
  }
  const [lon, lat] = value;
  if (
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    lon < -180 ||
    lon > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return fallback;
  }
  return [lon, lat];
}

function resolveMapZoom(payload: PublicConfigPayload): number {
  const fallback = 4;
  const value = payload.defaultZoom;
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(22, Number(value)));
}

export function App() {
  const [liveEntityMap, setLiveEntityMap] = useState<Map<string, TrackedEntity>>(new Map());
  const [replayEntityMap, setReplayEntityMap] = useState<Map<string, TrackedEntity>>(new Map());
  const [feedStatuses, setFeedStatuses] = useState<FeedState>({
    ais: "degraded",
    opensky: "degraded",
    flightaware: "degraded"
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(true);
  const [minutesAgo, setMinutesAgo] = useState(5);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "ready" | "degraded">("idle");
  const [detailMessage, setDetailMessage] = useState("");
  const [detail, setDetail] = useState<FlightDetail | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [mapStyleUrl, setMapStyleUrl] = useState(DEFAULT_MAP_STYLE_URL);
  const [mapCenter, setMapCenter] = useState<[number, number]>([45, 24]);
  const [mapZoom, setMapZoom] = useState(4);
  const [mapDiagnostics, setMapDiagnostics] = useState<TacticalMapDiagnostics>({
    status: "booting",
    reason: null
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const feedRef = useRef(feedStatuses);

  useEffect(() => {
    feedRef.current = feedStatuses;
  }, [feedStatuses]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl());
    ws.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as LiveEvent;
        setLiveEntityMap((prevMap) => {
          const result = applyLiveEvent(prevMap, feedRef.current, event);
          setFeedStatuses(result.feedState);
          return result.entities;
        });
      } catch {
        setFeedStatuses((prev) => ({ ...prev, ais: "degraded", opensky: "degraded" }));
      }
    };
    ws.onerror = () => {
      setFeedStatuses((prev) => ({ ...prev, ais: "degraded", opensky: "degraded" }));
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    void fetch("/api/public-config")
      .then((res) => res.json())
      .then((payload: PublicConfigPayload) => {
        setMapboxToken(payload.mapboxToken || null);
        setMapStyleUrl(resolveMapStyleUrl(payload));
        setMapCenter(resolveMapCenter(payload));
        setMapZoom(resolveMapZoom(payload));
      })
      .catch(() => {
        setMapboxToken(null);
        setMapStyleUrl(DEFAULT_MAP_STYLE_URL);
        setMapCenter([45, 24]);
        setMapZoom(4);
      });

    void fetch("/api/health")
      .then((res) => res.json())
      .then((payload: { feeds?: FeedState }) => {
        if (payload.feeds) {
          setFeedStatuses(payload.feeds);
        }
      })
      .catch(() => {
        setFeedStatuses((prev) => ({ ...prev, ais: "degraded", opensky: "degraded" }));
      });
  }, []);

  useEffect(() => {
    if (liveMode) {
      return;
    }
    const to = Date.now() - minutesAgo * 60_000;
    const from = to - 60_000;
    void fetch(`/api/replay?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((payload: { events?: LiveEvent[] }) => {
        const events = payload.events || [];
        setReplayEntityMap(buildEntitySnapshot(events));
      })
      .catch(() => {
        setReplayEntityMap(new Map());
      });
  }, [liveMode, minutesAgo]);

  const activeEntityMap = liveMode ? liveEntityMap : replayEntityMap;
  const displayedEntities = useMemo(
    () => [...activeEntityMap.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    [activeEntityMap]
  );
  const selectedEntity = selectedId ? activeEntityMap.get(selectedId) ?? null : null;

  const handleEntitySelect = useCallback((entity: TrackedEntity) => {
    setSelectedId(entity.id);
    setPanelOpen(true);
  }, []);

  useEffect(() => {
    if (!selectedEntity || selectedEntity.source !== "aircraft") {
      setDetailState("idle");
      setDetail(null);
      setDetailMessage("");
      return;
    }

    setDetailState("loading");
    void fetch(`/api/flight/${selectedEntity.icao24}/details`)
      .then(async (res) => {
        const payload = (await res.json()) as {
          detail?: FlightDetail;
          message?: string;
        };
        if (!res.ok || !payload.detail) {
          setDetailState("degraded");
          setDetailMessage(payload.message || "Flight details currently unavailable");
          setDetail(null);
          return;
        }
        setDetailState("ready");
        setDetail(payload.detail);
        setDetailMessage("");
      })
      .catch(() => {
        setDetailState("degraded");
        setDetailMessage("Flight details currently unavailable");
        setDetail(null);
      });
  }, [selectedEntity]);

  return (
    <div className="app-shell">
      <main className={panelOpen ? "map-first-layout panel-open" : "map-first-layout"}>
        <section className="map-stage">
          <TacticalMap
            entities={displayedEntities}
            selectedId={selectedId}
            onSelect={handleEntitySelect}
            mapboxToken={mapboxToken}
            mapStyleUrl={mapStyleUrl}
            initialCenter={mapCenter}
            initialZoom={mapZoom}
            onDiagnosticsChange={setMapDiagnostics}
          />
          <div className="map-top-overlay">
            <header className="app-header">
              <h1>Middle East Maritime & Air Tracking Dashboard</h1>
            </header>
            <FeedStatusBar statuses={feedStatuses} mapDiagnostics={mapDiagnostics} />
            <TimelineScrubber
              liveMode={liveMode}
              minutesAgo={minutesAgo}
              onLiveModeChange={setLiveMode}
              onMinutesAgoChange={setMinutesAgo}
            />
          </div>
          <button
            type="button"
            className={panelOpen ? "entity-panel-toggle open" : "entity-panel-toggle"}
            onClick={() => setPanelOpen((prev) => !prev)}
          >
            {panelOpen ? "Hide details" : "Show details"}
          </button>
        </section>
        <button
          type="button"
          className={panelOpen ? "entity-backdrop open" : "entity-backdrop"}
          aria-label="Close entity panel"
          onClick={() => setPanelOpen(false)}
        />
        <aside className={panelOpen ? "entity-slideout open" : "entity-slideout"} aria-hidden={!panelOpen}>
          <button
            type="button"
            className="entity-close-button"
            onClick={() => setPanelOpen(false)}
          >
            Close
          </button>
          <EntityPanel
            entity={selectedEntity}
            detailState={detailState}
            detail={detail}
            detailMessage={detailMessage}
          />
        </aside>
      </main>
    </div>
  );
}
