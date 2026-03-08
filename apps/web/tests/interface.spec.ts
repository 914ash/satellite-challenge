import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { TrackedEntity } from "@sat/shared-types";

const API_BASE = "http://localhost:4000";
const FIXED_TS = 1_739_000_000_000;

const DIAG_AIRCRAFT: TrackedEntity = {
  id: "air:diag-aircraft",
  source: "aircraft",
  icao24: "diag01",
  callsign: "DGN-AIR-01",
  lat: 25.2048,
  lon: 55.2708,
  headingDeg: 180,
  speedKnots: 220,
  altitudeMeters: 10_000,
  updatedAt: FIXED_TS + 10
};

const DIAG_VESSEL: TrackedEntity = {
  id: "vessel:diag-vessel",
  source: "vessel",
  mmsi: "123456789",
  shipName: "DGN-SEA-01",
  lat: 25.1,
  lon: 55.1,
  headingDeg: 45,
  speedKnots: 12,
  updatedAt: FIXED_TS + 20
};

async function postDevEvent(request: APIRequestContext, data: unknown): Promise<void> {
  const response = await request.post(`${API_BASE}/api/dev/events`, { data });
  expect(response.ok()).toBeTruthy();
}

async function upsertEntity(request: APIRequestContext, ts: number, entity: TrackedEntity): Promise<void> {
  await postDevEvent(request, { type: "entity.upsert", ts, entity });
}

async function removeEntity(request: APIRequestContext, ts: number, entityId: string): Promise<void> {
  await postDevEvent(request, { type: "entity.remove", ts, entityId });
}

async function resetDiagnosticEntities(request: APIRequestContext): Promise<void> {
  await removeEntity(request, FIXED_TS, DIAG_AIRCRAFT.id);
  await removeEntity(request, FIXED_TS + 1, DIAG_VESSEL.id);
}

async function mockPublicConfig(page: Page, mapboxToken: string | null): Promise<void> {
  await page.route("**/api/public-config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mapboxToken,
        mapStyle: "mapbox://styles/mapbox/satellite-streets-v12",
        defaultCenter: [45, 24],
        defaultZoom: 4,
        satelliteModeDefault: true
      })
    });
  });
}

async function mockMapboxModule(page: Page, shouldThrowOnConstruct = false): Promise<void> {
  const moduleBody = `
    class MockGeoJSONSource {
      setData(data) {
        this.data = data;
      }
    }

    class MockMap {
      constructor(options) {
        if (${shouldThrowOnConstruct}) {
          throw new Error("WebGL unsupported in diagnostics test");
        }
        this.container = options.container;
        this.handlers = new Map();
        this.sources = new Map();
        this.canvas = document.createElement("canvas");
        this.canvas.className = "mapboxgl-canvas";
        this.container.appendChild(this.canvas);
        queueMicrotask(() => this.#emit("load", {}));
      }

      on(event, layerOrHandler, maybeHandler) {
        const handler = typeof layerOrHandler === "function" ? layerOrHandler : maybeHandler;
        if (!handler) return;
        const existing = this.handlers.get(event) || [];
        existing.push(handler);
        this.handlers.set(event, existing);
      }

      #emit(event, payload) {
        const handlers = this.handlers.get(event) || [];
        for (const handler of handlers) {
          handler(payload);
        }
      }

      addControl() {}

      addSource(id) {
        this.sources.set(id, new MockGeoJSONSource());
      }

      addLayer() {}

      getSource(id) {
        return this.sources.get(id);
      }

      setFilter() {}

      remove() {
        this.canvas?.remove();
      }
    }

    class NavigationControl {}

    const mapbox = {
      accessToken: "",
      supported: () => ${shouldThrowOnConstruct ? "false" : "true"},
      Map: MockMap,
      NavigationControl
    };

    export default mapbox;
  `;

  await page.route("**/node_modules/.vite/deps/mapbox-gl.js*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: moduleBody
    });
  });
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await resetDiagnosticEntities(request);
});

test.afterEach(async ({ request }) => {
  await resetDiagnosticEntities(request);
});

test("map success diagnostics path renders map container/canvas without fallback", async ({ page }) => {
  await mockMapboxModule(page);
  await page.goto("/tests/map-ready-harness.html");

  const mapContainer = page.locator(".map-container");
  const mapCanvas = mapContainer.locator("canvas.mapboxgl-canvas");
  await expect(mapContainer).toBeVisible();
  await expect(mapCanvas).toHaveCount(1);
  await expect(page.getByTestId("map-fallback")).toHaveCount(0);

  await expect(mapContainer).toHaveScreenshot("map-ready.png", {
    animations: "disabled"
  });
});

test("fallback diagnostics path renders fallback markers for both unsupported and mockMap flows", async ({
  page,
  request
}) => {
  await upsertEntity(request, FIXED_TS + 2, DIAG_AIRCRAFT);
  await upsertEntity(request, FIXED_TS + 3, DIAG_VESSEL);

  await mockMapboxModule(page, true);
  await mockPublicConfig(page, "diagnostics-token");

  await page.goto("/");
  await expect(page.getByTestId("map-fallback")).toBeVisible();
  await expect(page.getByRole("button", { name: /^A DGN-AIR-01$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^V DGN-SEA-01$/ })).toBeVisible();

  await page.goto("/?mockMap=1");
  await expect(page.getByTestId("map-fallback")).toBeVisible();
  await expect(page.getByRole("button", { name: /^A DGN-AIR-01$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^V DGN-SEA-01$/ })).toBeVisible();

  const fallbackScreenshot = await page.getByTestId("map-fallback").screenshot({
    animations: "disabled"
  });
  expect(fallbackScreenshot.byteLength).toBeGreaterThan(0);
});

test("entity selection diagnostics never surfaces literal error text", async ({ page, request }) => {
  await upsertEntity(request, FIXED_TS + 4, DIAG_AIRCRAFT);

  await page.goto("/?mockMap=1");
  await page.getByRole("button", { name: /^A DGN-AIR-01$/ }).click();

  await expect(page.locator(".entity-panel")).toContainText("DGN-AIR-01");
  await expect(page.locator(".entity-panel")).toContainText(/flight details currently unavailable/i);
  await expect(page.getByText(/^error$/i)).toHaveCount(0);

  await expect(page.locator(".entity-panel")).toHaveScreenshot("entity-selected.png", {
    animations: "disabled"
  });
});
