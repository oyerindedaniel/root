export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }

  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(record).sort();
  for (const key of keys) {
    sorted[key] = sortValue(record[key]);
  }
  return sorted;
}
