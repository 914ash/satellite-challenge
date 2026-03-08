import type { FlightAwareFetcher } from "./flightAwareClient.js";

export function createFlightAwareFetcher(apiKey?: string): FlightAwareFetcher {
  return async (icao24) => {
    if (!apiKey) {
      return null;
    }

    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${icao24}`;
    const response = await fetch(url, {
      headers: {
        "x-apikey": apiKey
      }
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      flights?: Array<{
        operator?: string;
        aircraft_type?: string;
        origin?: { code_iata?: string };
        destination?: { code_iata?: string };
      }>;
    };
    const first = payload.flights?.[0];
    if (!first) {
      return null;
    }
    return {
      operatorName: first.operator ?? null,
      aircraftType: first.aircraft_type ?? null,
      origin: first.origin?.code_iata ?? null,
      destination: first.destination?.code_iata ?? null
    };
  };
}
