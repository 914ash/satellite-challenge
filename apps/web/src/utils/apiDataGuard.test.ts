import { describe, expect, it } from "vitest";
import { getSafeFieldValue } from "./apiDataGuard";

describe("getSafeFieldValue", () => {
  it("normalizes null-like and error-like values", () => {
    expect(getSafeFieldValue("error")).toBe("Unavailable");
    expect(getSafeFieldValue("ERROR: timeout")).toBe("Unavailable");
    expect(getSafeFieldValue(null)).toBe("Unavailable");
    expect(getSafeFieldValue("")).toBe("Unavailable");
  });

  it("returns safe display values for non-error data", () => {
    expect(getSafeFieldValue("UAE123")).toBe("UAE123");
    expect(getSafeFieldValue(123)).toBe("123");
  });
});
