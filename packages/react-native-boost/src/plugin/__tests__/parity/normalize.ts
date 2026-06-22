// Shared prop-bag normalization for the differential parity comparison, used by both the fixture suite
// (parity.test.ts) and the property-based suite (fuzz/fuzz.test.ts).

/**
 * Flatten a `style` value the way the native host does (`StyleSheet.flatten`): a top-level array
 * flattens left-to-right with last-key-wins, recursing into nested arrays; non-object entries contribute
 * nothing. A later `{ key: undefined }` entry still wins the merge (it sets the key to `undefined`); the
 * key is dropped downstream by {@link normalize}'s JSON clean.
 */
export const flattenStyle = (style: unknown): unknown => {
  if (!Array.isArray(style)) return style;
  const result: Record<string, unknown> = {};
  for (const entry of style) {
    const flat = flattenStyle(entry);
    if (flat && typeof flat === 'object') Object.assign(result, flat);
  }
  return result;
};

/**
 * Treat `undefined`-valued keys as absent and deep-clean nested objects (also drops function values such
 * as event handlers) so the comparison is a clean structural prop-bag equality. The `style` prop is
 * flattened first so Boost's build-time-merged object compares equal to the wrapper's original array —
 * the property the native host actually sees is the flattened style, not its authored shape. Flattening
 * before the clean matters: a trailing `{ key: undefined }` array entry must apply as a last-wins
 * override (then get dropped here) rather than being dropped inside its own element first.
 */
export const normalize = (props: Record<string, unknown>) =>
  JSON.parse(JSON.stringify('style' in props ? { ...props, style: flattenStyle(props.style) } : props));
