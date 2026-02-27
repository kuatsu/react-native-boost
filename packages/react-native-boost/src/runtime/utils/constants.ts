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
