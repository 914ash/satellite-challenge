import type { FlightDetail } from "@sat/shared-types";

export type FlightAwareFetcher = (
  icao24: string
) => Promise<Omit<FlightDetail, "icao24" | "fetchedAt"> | null>;

type CacheItem = {
  detail: FlightDetail;
  expiresAt: number;
};

export class FlightAwareClient {
  private readonly cache = new Map<string, CacheItem>();

  constructor(
    private readonly fetcher: FlightAwareFetcher,
    private readonly ttlMs: number
  ) {}

  async getDetails(icao24: string): Promise<FlightDetail | null> {
    const key = icao24.toLowerCase();
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.detail;
    }

    try {
      const result = await this.fetcher(key);
      if (!result) {
        return null;
      }
      const detail: FlightDetail = {
        icao24: key,
        fetchedAt: now,
        operatorName: result.operatorName ?? null,
        aircraftType: result.aircraftType ?? null,
        origin: result.origin ?? null,
        destination: result.destination ?? null
      };
      this.cache.set(key, { detail, expiresAt: now + this.ttlMs });
      return detail;
    } catch {
      return null;
    }
  }
}
