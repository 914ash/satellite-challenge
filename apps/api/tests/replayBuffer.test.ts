import { describe, expect, it } from "vitest";
import { ReplayBuffer } from "../src/store/replayBuffer.js";

describe("ReplayBuffer", () => {
  it("returns ordered events in the requested range", () => {
    const buffer = new ReplayBuffer<{ ts: number; id: string }>(60_000);
    buffer.add({ ts: 10, id: "a" });
    buffer.add({ ts: 20, id: "b" });
    buffer.add({ ts: 30, id: "c" });

    expect(buffer.getRange(15, 30).map((x) => x.id)).toEqual(["b", "c"]);
  });

  it("prunes events older than retention window", () => {
    const buffer = new ReplayBuffer<{ ts: number; id: string }>(10);
    buffer.add({ ts: 100, id: "old" });
    buffer.add({ ts: 110, id: "new" });

    expect(buffer.getRange(0, 200).map((x) => x.id)).toEqual(["new"]);
  });
});
