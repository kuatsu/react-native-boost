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

export const normalizeImage = (props: Record<string, unknown>) => {
  const normalized = normalize(props);

  for (const key of [
    'alt',
    'aria-busy',
    'aria-checked',
    'aria-disabled',
    'aria-expanded',
    'aria-hidden',
    'aria-label',
    'aria-labelledby',
    'aria-selected',
    'crossOrigin',
    'referrerPolicy',
    'width',
    'height',
  ]) {
    delete normalized[key];
  }

  for (const key of ['defaultSource', 'internal_analyticTag', 'loadingIndicatorSrc']) {
    if (normalized[key] === null) delete normalized[key];
  }

  if (normalized.shouldNotifyLoadEvents === false) delete normalized.shouldNotifyLoadEvents;
  if (normalized.headers && typeof normalized.headers === 'object' && Object.keys(normalized.headers).length === 0) {
    delete normalized.headers;
  }
  if (
    normalized.accessibilityState &&
    typeof normalized.accessibilityState === 'object' &&
    Object.keys(normalized.accessibilityState).length === 0
  ) {
    delete normalized.accessibilityState;
  }

  return normalized;
};
