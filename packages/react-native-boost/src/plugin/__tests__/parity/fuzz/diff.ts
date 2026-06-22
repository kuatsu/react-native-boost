// Order-insensitive comparison of two normalized prop bags. The plugin and the wrapper build prop bags
// (and nested objects like `accessibilityState`) in different key orders, which is irrelevant to
// rendering — so equality must ignore key order, exactly like the fixtures' `toEqual`.

/** Recursively sort object keys so two equal-but-differently-ordered values stringify identically. */
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    );
  }
  return value;
}

/** The sorted set of top-level keys whose (deep, order-insensitive) values differ between the two bags. */
export function divergingKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const ca = canonical(a) as Record<string, unknown>;
  const cb = canonical(b) as Record<string, unknown>;
  const keys = new Set([...Object.keys(ca), ...Object.keys(cb)]);
  const diverging: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(ca[key]) !== JSON.stringify(cb[key])) diverging.push(key);
  }
  return diverging.sort();
}
