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
