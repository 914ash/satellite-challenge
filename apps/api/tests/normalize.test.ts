import { describe, expect, it } from "vitest";
import { normalizeOpenSkyState } from "../src/normalize/opensky.js";
import { normalizeAisMessage } from "../src/normalize/ais.js";

describe("normalizeOpenSkyState", () => {
  it("maps opensky state vector into aircraft entity", () => {
    const state = [
      "a1b2c3",
      "TEST123 ",
      "US",
      0,
      0,
      -77.04,
      38.9,
      1200,
      false,
      150,
      90,
      0,
      null,
      1000,
      "1234",
      false,
      0
    ];

    const entity = normalizeOpenSkyState(state, 123_000);
    expect(entity?.id).toBe("air:a1b2c3");
    expect(entity?.callsign).toBe("TEST123");
    expect(entity?.lat).toBe(38.9);
    expect(entity?.lon).toBe(-77.04);
  });

  it("returns null for invalid coordinates", () => {
    const state = new Array(17).fill(null);
    state[0] = "abc";
    expect(normalizeOpenSkyState(state, 123)).toBeNull();
  });
});

describe("normalizeAisMessage", () => {
  it("maps AIS position report into vessel entity", () => {
    const entity = normalizeAisMessage(
      {
        MessageType: "PositionReport",
        Message: {
          PositionReport: {
            UserID: 111_222_333,
            Longitude: 55.1,
            Latitude: 25.2,
            Cog: 180,
            Sog: 12.5
          }
        }
      },
      500
    );

    expect(entity?.id).toBe("sea:111222333");
    expect(entity?.mmsi).toBe(111_222_333);
    expect(entity?.lat).toBe(25.2);
    expect(entity?.lon).toBe(55.1);
  });

  it("returns null when no valid position exists", () => {
    expect(normalizeAisMessage({ Message: {} }, 1)).toBeNull();
  });
});
