import { describe, expect, it, vi } from "vitest";
import { FlightAwareClient } from "../src/enrichment/flightAwareClient.js";

describe("FlightAwareClient", () => {
  it("returns cached value inside TTL", async () => {
    const fetcher = vi.fn(async () => ({
      operatorName: "Test Air",
      aircraftType: "A320",
      origin: "OMDB",
      destination: "OERK"
    }));
    const client = new FlightAwareClient(fetcher, 60_000);

    const first = await client.getDetails("ab12cd");
    const second = await client.getDetails("ab12cd");

    expect(first?.operatorName).toBe("Test Air");
    expect(second?.operatorName).toBe("Test Air");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns null on upstream failures", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("boom");
    });
    const client = new FlightAwareClient(fetcher, 60_000);
    await expect(client.getDetails("ab12cd")).resolves.toBeNull();
  });
});
