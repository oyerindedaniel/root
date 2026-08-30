export const MAX_CUSTOM_INPUT_CHARS = 16_384;
export const MAX_CUSTOM_INPUT_DEPTH = 24;
export const MAX_CUSTOM_INPUT_NODES = 512;
export const MAX_CUSTOM_SCHEMA_CHARS = 32_768;
export const MAX_CUSTOM_SCHEMA_DEPTH = 24;
export const MAX_CUSTOM_SCHEMA_NODES = 512;

export type JsonBounds =
  | { ok: true; serialized: string }
  | { ok: false; reason: "invalid" | "too_large" };

export function boundJsonValue(
  value: unknown,
  options: { maxChars: number; maxDepth: number; maxNodes: number },
): JsonBounds {
  const stack: Array<{ value: unknown; depth: number }> = [
    { value, depth: 0 },
  ];
  const seen = new Set<object>();
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      break;
    }
    nodes += 1;
    if (nodes > options.maxNodes || current.depth > options.maxDepth) {
      return { ok: false, reason: "too_large" };
    }
    if (current.value === null) {
      continue;
    }
    const kind = typeof current.value;
    if (
      kind === "string" ||
      kind === "boolean" ||
      (kind === "number" && Number.isFinite(current.value))
    ) {
      continue;
    }
    if (kind !== "object") {
      return { ok: false, reason: "invalid" };
    }
    const object = current.value as object;
    if (seen.has(object)) {
      return { ok: false, reason: "invalid" };
    }
    seen.add(object);
    for (const nested of Object.values(object)) {
      stack.push({ value: nested, depth: current.depth + 1 });
    }
  }
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > options.maxChars) {
      return { ok: false, reason: "too_large" };
    }
    return { ok: true, serialized };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
