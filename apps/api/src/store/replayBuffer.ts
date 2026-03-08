export class ReplayBuffer<T extends { ts: number }> {
  private readonly retentionMs: number;

  private events: T[] = [];

  constructor(retentionMs: number) {
    this.retentionMs = retentionMs;
  }

  add(event: T): void {
    this.events.push(event);
    this.prune(event.ts);
  }

  getRange(from: number, to: number): T[] {
    return this.events
      .filter((event) => event.ts >= from && event.ts <= to)
      .sort((a, b) => a.ts - b.ts);
  }

  private prune(nowTs: number): void {
    const threshold = nowTs - this.retentionMs;
    this.events = this.events.filter((event) => event.ts > threshold);
  }
}
