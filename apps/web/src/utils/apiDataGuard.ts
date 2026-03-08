export function getSafeFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "Unavailable";
  }
  const asString = String(value).trim();
  if (!asString) {
    return "Unavailable";
  }
  if (/error/i.test(asString)) {
    return "Unavailable";
  }
  return asString;
}
