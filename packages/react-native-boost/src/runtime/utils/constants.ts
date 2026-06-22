/**
 * Maps CSS-like `userSelect` values to React Native's `selectable` prop.
 */
export const userSelectToSelectableMap = {
  auto: true,
  text: true,
  none: false,
  contain: true,
  all: true,
};

/**
 * Maps CSS-like `verticalAlign` values to React Native's `textAlignVertical`.
 */
export const verticalAlignToTextAlignVerticalMap = {
  auto: 'auto',
  top: 'top',
  bottom: 'bottom',
  middle: 'center',
};

/**
 * Clamps a `numberOfLines` value exactly as `Text` does at runtime: a negative number (or `NaN`) becomes
 * `0`, while `null`/`undefined` pass through untouched (`!(value >= 0)` is `true` for negatives and `NaN`,
 * `false` otherwise). The plugin emits this only around a non-literal `numberOfLines`; literal negatives
 * are clamped at build time, so it never runs for them.
 */
export const clampNumberOfLines = (value: number | null | undefined): number | null | undefined =>
  value != null && !(value >= 0) ? 0 : value;
