import type { TrackedEntity } from "@sat/shared-types";

export class EntityStore {
  private readonly entities = new Map<string, TrackedEntity>();

  upsert(entity: TrackedEntity): void {
    this.entities.set(entity.id, entity);
  }

  get(id: string): TrackedEntity | undefined {
    return this.entities.get(id);
  }

  list(): TrackedEntity[] {
    return [...this.entities.values()];
  }

  remove(id: string): void {
    this.entities.delete(id);
  }
}
