import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TrackedEntity } from "@sat/shared-types";
import { EntityPanel } from "./EntityPanel";

const aircraft: TrackedEntity = {
  id: "air:abc123",
  source: "aircraft",
  icao24: "abc123",
  callsign: "UAE123",
  lat: 25.2048,
  lon: 55.2708,
  headingDeg: 180,
  speedKnots: 210,
  altitudeMeters: 9000,
  updatedAt: Date.now()
};

describe("EntityPanel", () => {
  it("renders base aircraft data when enrichment fails", () => {
    render(
      <EntityPanel
        entity={aircraft}
        detailState="degraded"
        detailMessage="Flight details currently unavailable"
      />
    );

    expect(screen.getByText("UAE123")).toBeInTheDocument();
    expect(screen.getByText(/flight details currently unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/^error$/i)).not.toBeInTheDocument();
  });
});
