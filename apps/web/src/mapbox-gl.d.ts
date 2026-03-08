declare module "mapbox-gl" {
  export type MapboxGeoJSONFeature = {
    properties?: Record<string, unknown>;
  };

  export type MapLayerMouseEvent = {
    features?: MapboxGeoJSONFeature[];
  };

  export type GeoJSONSource = {
    setData(data: unknown): void;
  };

  export class NavigationControl {}

  export type MapOptions = {
    container: HTMLElement;
    style: string;
    center: [number, number];
    zoom: number;
  };

  export class Map {
    constructor(options: MapOptions);
    addControl(control: NavigationControl): void;
    addSource(id: string, source: unknown): void;
    addLayer(layer: unknown): void;
    on(event: "load", listener: () => void): void;
    on(event: "error", listener: (event: { error: unknown }) => void): void;
    on(event: "webglcontextlost", listener: () => void): void;
    on(event: "click", layerId: string, listener: (event: MapLayerMouseEvent) => void): void;
    getSource(id: string): GeoJSONSource | undefined;
    setFilter(layerId: string, filter: unknown[]): void;
    remove(): void;
  }

  const mapboxgl: {
    accessToken: string;
    supported(): boolean;
    Map: typeof Map;
    NavigationControl: typeof NavigationControl;
  };

  export default mapboxgl;
}
