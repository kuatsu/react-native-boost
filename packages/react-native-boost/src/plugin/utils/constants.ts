export const RUNTIME_MODULE_NAME = 'react-native-boost/runtime';

/**
 * The set of accessibility properties that need to be normalized.
 */
export const ACCESSIBILITY_PROPERTIES = new Set([
  'accessibilityLabel',
  'aria-label',
  'accessibilityState',
  'aria-busy',
  'aria-checked',
  'aria-disabled',
  'aria-expanded',
  'aria-selected',
  'accessible',
]);

// Maps the `userSelect` values to the corresponding boolean for the `selectable` prop
export const USER_SELECT_STYLE_TO_SELECTABLE_PROP: Record<string, boolean> = {
  auto: true,
  text: true,
  none: false,
  contain: true,
  all: true,
};

// Maps the CSS-like `verticalAlign` values to React Native's `textAlignVertical`. Build-time mirror of
// the runtime `verticalAlignToTextAlignVerticalMap`; the two must stay in sync, as a drift would make
// a build-time-merged static style diverge from the runtime helper's result for the same input.
export const VERTICAL_ALIGN_TO_TEXT_ALIGN_VERTICAL: Record<string, string> = {
  auto: 'auto',
  top: 'top',
  bottom: 'bottom',
  middle: 'center',
};
