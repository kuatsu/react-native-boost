export const RUNTIME_MODULE_NAME = 'react-native-boost/runtime';

/**
 * The npm package name of Unistyles, used both for the install probe (auto-detecting "Unistyles mode")
 * and for classifying a `StyleSheet.create` call's origin.
 */
export const UNISTYLES_MODULE_NAME = 'react-native-unistyles';

/**
 * Unistyles' own "lean" host components — `createUnistylesElement(RCTText/RCTView)`. Routing a
 * Unistyles-styled element to these keeps Unistyles' shadow-tree registration (so reactivity survives)
 * while still skipping React Native's `Text`/`View` wrapper, which is the optimization Boost provides.
 * `NativeText` is a named export; `NativeView` is the module's default export (it mirrors RN's default
 * `View` export). These subpaths are part of Unistyles' `./components/native/*` exports map.
 */
export const UNISTYLES_NATIVE_TEXT_MODULE = `${UNISTYLES_MODULE_NAME}/components/native/NativeText`;
export const UNISTYLES_NATIVE_VIEW_MODULE = `${UNISTYLES_MODULE_NAME}/components/native/NativeView`;

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
  'aria-hidden',
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
