import type { LiveEvent, TrackedEntity } from "@sat/shared-types";

export type FeedState = Record<"ais" | "opensky" | "flightaware", "ok" | "degraded" | "down">;

export function applyLiveEvent(
  entities: Map<string, TrackedEntity>,
  feedState: FeedState,
  event: LiveEvent
): { entities: Map<string, TrackedEntity>; feedState: FeedState } {
  const entityCopy = new Map(entities);
  const feedCopy = { ...feedState };
  if (event.type === "entity.upsert") {
    entityCopy.set(event.entity.id, event.entity);
  }
  if (event.type === "entity.remove") {
    entityCopy.delete(event.entityId);
  }
  if (event.type === "feed.status") {
    feedCopy[event.feed] = event.status;
  }
  return { entities: entityCopy, feedState: feedCopy };
}

export function buildEntitySnapshot(events: LiveEvent[]): Map<string, TrackedEntity> {
  const map = new Map<string, TrackedEntity>();
  for (const event of events) {
    if (event.type === "entity.upsert") {
      map.set(event.entity.id, event.entity);
    } else if (event.type === "entity.remove") {
      map.delete(event.entityId);
    }
  }
  return map;
}
