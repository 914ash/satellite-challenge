import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl, {
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapLayerMouseEvent
} from "mapbox-gl";
import type { TrackedEntity } from "@sat/shared-types";

export const DEFAULT_MAP_STYLE_URL = "mapbox://styles/mapbox/satellite-streets-v12";

export type TacticalMapStatus = "booting" | "ready" | "degraded" | "fallback";

export type TacticalMapFallbackReasonCode =
  | "fallback_test_mode"
  | "fallback_missing_token"
  | "fallback_missing_container"
  | "fallback_unsupported_browser"
  | "fallback_map_init_failed"
  | "fallback_style_load_failed"
  | "fallback_layer_setup_failed"
  | "fallback_webgl_context_lost";

export type TacticalMapDegradedReasonCode =
  | "degraded_runtime_error"
  | "degraded_entity_source_missing"
  | "degraded_entity_data_update_failed";

export type TacticalMapReasonCode =
  | TacticalMapFallbackReasonCode
  | TacticalMapDegradedReasonCode;

export type TacticalMapDiagnostics = {
  status: TacticalMapStatus;
  reason: TacticalMapReasonCode | null;
  detail?: string;
};

type Props = {
  entities: TrackedEntity[];
  selectedId: string | null;
  onSelect: (entity: TrackedEntity) => void;
  mapboxToken?: string | null;
  mapStyleUrl?: string | null;
  initialCenter?: [number, number];
  initialZoom?: number;
  onDiagnosticsChange?: (diagnostics: TacticalMapDiagnostics) => void;
};

function markerLabel(entity: TrackedEntity): string {
  if (entity.source === "aircraft") {
    return entity.callsign || entity.icao24;
  }
  return entity.shipName || String(entity.mmsi);
}

function errorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unknown map error";
}

export function TacticalMap({
  entities,
  selectedId,
  onSelect,
  mapboxToken,
  mapStyleUrl,
  initialCenter = [45, 24],
  initialZoom = 4,
  onDiagnosticsChange
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const mapLoadedRef = useRef(false);
  const entityRef = useRef<Map<string, TrackedEntity>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [diagnostics, setDiagnostics] = useState<TacticalMapDiagnostics>({
    status: "booting",
    reason: null
  });

  const queryParams = new URLSearchParams(window.location.search);
  const testMode =
    import.meta.env.MODE === "test" ||
    import.meta.env.VITE_TEST_MODE === "1" ||
    queryParams.get("mockMap") === "1";

  const setDiagnosticsState = useCallback((next: TacticalMapDiagnostics) => {
    setDiagnostics((prev) => {
      if (
        prev.status === next.status &&
        prev.reason === next.reason &&
        prev.detail === next.detail
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const setFallback = useCallback(
    (reason: TacticalMapFallbackReasonCode, detail?: string) => {
      setMapLoaded(false);
      mapLoadedRef.current = false;
      setDiagnosticsState({
        status: "fallback",
        reason,
        detail
      });
    },
    [setDiagnosticsState]
  );

  const setDegraded = useCallback(
    (reason: TacticalMapDegradedReasonCode, detail?: string) => {
      setDiagnosticsState({
        status: "degraded",
        reason,
        detail
      });
    },
    [setDiagnosticsState]
  );

  const setReady = useCallback(() => {
    setDiagnosticsState({
      status: "ready",
      reason: null
    });
  }, [setDiagnosticsState]);

  useEffect(() => {
    if (onDiagnosticsChange) {
      onDiagnosticsChange(diagnostics);
    }
  }, [diagnostics, onDiagnosticsChange]);

  useEffect(() => {
    setMapLoaded(false);
    mapLoadedRef.current = false;
    setDiagnosticsState({
      status: "booting",
      reason: null
    });

    if (testMode) {
      setFallback("fallback_test_mode", "Map disabled in test mode.");
      return;
    }

    if (!mapboxToken) {
      setFallback("fallback_missing_token", "Mapbox token missing.");
      return;
    }

    const container = containerRef.current;
    if (!container) {
      setFallback("fallback_missing_container", "Map container not available.");
      return;
    }

    if (!mapboxgl.supported()) {
      setFallback("fallback_unsupported_browser", "Browser does not support WebGL map rendering.");
      return;
    }

    mapboxgl.accessToken = mapboxToken;
    let disposed = false;

    try {
      const map = new mapboxgl.Map({
        container,
        style: mapStyleUrl || DEFAULT_MAP_STYLE_URL,
        center: initialCenter,
        zoom: initialZoom
      });
      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl());
      map.on("load", () => {
        if (!mapRef.current || disposed) {
          return;
        }

        try {
          mapRef.current.addSource("entities", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: []
            }
          });

          mapRef.current.addLayer({
            id: "aircraft-layer",
            type: "circle",
            source: "entities",
            filter: ["==", ["get", "source"], "aircraft"],
            paint: {
              "circle-radius": 5,
              "circle-color": "#4ecb71",
              "circle-stroke-width": 1,
              "circle-stroke-color": "#FFFFFF"
            }
          });

          mapRef.current.addLayer({
            id: "vessel-layer",
            type: "circle",
            source: "entities",
            filter: ["==", ["get", "source"], "vessel"],
            paint: {
              "circle-radius": 5,
              "circle-color": "#43b7ff",
              "circle-stroke-width": 1,
              "circle-stroke-color": "#FFFFFF"
            }
          });

          mapRef.current.addLayer({
            id: "selected-layer",
            type: "circle",
            source: "entities",
            filter: ["==", ["get", "id"], ""],
            paint: {
              "circle-radius": 8,
              "circle-color": "#FFFFFF",
              "circle-opacity": 0.4
            }
          });

          const clickHandler = (event: MapLayerMouseEvent) => {
            const feature = event.features?.[0];
            const idValue = feature?.properties?.id;
            if (typeof idValue !== "string") {
              return;
            }
            const entity = entityRef.current.get(idValue);
            if (entity) {
              onSelect(entity);
            }
          };

          mapRef.current.on("click", "aircraft-layer", clickHandler);
          mapRef.current.on("click", "vessel-layer", clickHandler);
          setMapLoaded(true);
          mapLoadedRef.current = true;
          setReady();
        } catch (error) {
          setFallback(
            "fallback_layer_setup_failed",
            `Unable to configure entity layers: ${errorDetail(error)}`
          );
          mapRef.current?.remove();
          mapRef.current = null;
          return;
        }
      });

      map.on("error", (event: { error: unknown }) => {
        const detail = errorDetail(event.error);
        if (!mapLoadedRef.current) {
          setFallback("fallback_style_load_failed", detail);
          mapRef.current?.remove();
          mapRef.current = null;
          return;
        }
        setDegraded("degraded_runtime_error", detail);
      });

      map.on("webglcontextlost", () => {
        setFallback("fallback_webgl_context_lost", "WebGL context lost.");
      });
    } catch (error) {
      setFallback("fallback_map_init_failed", errorDetail(error));
      mapRef.current?.remove();
      mapRef.current = null;
    }

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapLoaded(false);
      mapLoadedRef.current = false;
    };
  }, [
    initialCenter,
    initialZoom,
    mapStyleUrl,
    mapboxToken,
    onSelect,
    setDegraded,
    setDiagnosticsState,
    setFallback,
    setReady,
    testMode
  ]);

  useEffect(() => {
    entityRef.current = new Map(entities.map((entity) => [entity.id, entity]));
  }, [entities]);

  useEffect(() => {
    if (!mapRef.current || diagnostics.status === "fallback" || !mapLoaded) {
      return;
    }

    const source = mapRef.current.getSource("entities") as GeoJSONSource | undefined;
    if (!source) {
      setDegraded("degraded_entity_source_missing", "Entity source missing from map style.");
      return;
    }

    try {
      source.setData({
        type: "FeatureCollection",
        features: entities.map((entity) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [entity.lon, entity.lat]
          },
          properties: {
            id: entity.id,
            source: entity.source,
            label: markerLabel(entity)
          }
        }))
      });

      mapRef.current.setFilter("selected-layer", ["==", ["get", "id"], selectedId || ""]);
      if (diagnostics.status === "degraded") {
        setReady();
      }
    } catch (error) {
      setDegraded("degraded_entity_data_update_failed", errorDetail(error));
    }
  }, [diagnostics.status, entities, mapLoaded, selectedId, setDegraded, setReady]);

  if (diagnostics.status === "fallback") {
    return (
      <div className="map-fallback" data-testid="map-fallback">
        {entities.length === 0 ? (
          <p>No live entities yet.</p>
        ) : (
          entities.map((entity) => (
            <button
              key={entity.id}
              type="button"
              className={`fallback-marker marker-${entity.source} ${
                selectedId === entity.id ? "selected" : ""
              }`}
              onClick={() => onSelect(entity)}
            >
              {entity.source === "aircraft" ? "A" : "V"} {markerLabel(entity)}
            </button>
          ))
        )}
      </div>
    );
  }

  return <div ref={containerRef} className="map-container" />;
}
