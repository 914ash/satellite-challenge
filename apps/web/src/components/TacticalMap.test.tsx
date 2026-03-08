import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TrackedEntity } from "@sat/shared-types";
import { TacticalMap } from "./TacticalMap";

vi.mock("mapbox-gl", () => ({
  default: {
    accessToken: "",
    Map: class {},
    NavigationControl: class {}
  }
}));

const aircraft: TrackedEntity = {
  id: "air:diag-local",
  source: "aircraft",
  icao24: "diag88",
  callsign: "LOCAL-AIR-88",
  lat: 25.3,
  lon: 55.4,
  headingDeg: 90,
  speedKnots: 230,
  altitudeMeters: 8_000,
  updatedAt: 1
};

const vessel: TrackedEntity = {
  id: "vessel:diag-local",
  source: "vessel",
  mmsi: "998877665",
  shipName: "LOCAL-SEA-77",
  lat: 24.8,
  lon: 54.9,
  headingDeg: 180,
  speedKnots: 15,
  updatedAt: 2
};

describe("TacticalMap diagnostics UI", () => {
  it("shows deterministic fallback container and empty-state message when map is disabled", () => {
    render(
      <TacticalMap entities={[]} selectedId={null} onSelect={() => undefined} mapboxToken="token" />
    );

    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    expect(screen.getByText("No live entities yet.")).toBeInTheDocument();
  });

  it("renders fallback markers with stable source classes and supports entity selection", () => {
    const onSelect = vi.fn();
    render(
      <TacticalMap
        entities={[aircraft, vessel]}
        selectedId={aircraft.id}
        onSelect={onSelect}
        mapboxToken="token"
      />
    );

    const aircraftMarker = screen.getByRole("button", { name: /^A LOCAL-AIR-88$/ });
    const vesselMarker = screen.getByRole("button", { name: /^V LOCAL-SEA-77$/ });

    expect(aircraftMarker).toHaveClass("fallback-marker", "marker-aircraft", "selected");
    expect(vesselMarker).toHaveClass("fallback-marker", "marker-vessel");

    fireEvent.click(vesselMarker);
    expect(onSelect).toHaveBeenCalledWith(vessel);
  });
});
