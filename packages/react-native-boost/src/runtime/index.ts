import { TextProps, TextStyle, StyleSheet } from 'react-native';
import { GenericStyleProp } from './types';
import { userSelectToSelectableMap, verticalAlignToTextAlignVerticalMap } from './utils/constants';

const propsCache = new WeakMap();

/**
 * Normalizes `Text` style values for `NativeText`.
 *
 * @param style - Style prop passed to a text-like component.
 * @returns Native-friendly text props. Returns an empty object when `style` is falsy or cannot be normalized.
 * @remarks
 * - Flattens style arrays via `StyleSheet.flatten`
 * - Converts numeric `fontWeight` values to string values
 * - Maps `userSelect` and `verticalAlign` to native-compatible props
 */
export function processTextStyle(style: GenericStyleProp<TextStyle>): Partial<TextProps> {
  if (!style) return {};

  // Cache the computed props
  let props = propsCache.get(style);
  if (props) return props;

  props = {};
  propsCache.set(style, props);

  style = StyleSheet.flatten(style) as TextStyle;

  if (!style) return {};

  if (typeof style?.fontWeight === 'number') {
    style.fontWeight = style.fontWeight.toString() as TextStyle['fontWeight'];
  }

  if (style?.userSelect != null) {
    props.selectable = userSelectToSelectableMap[style.userSelect];
    delete style.userSelect;
  }

  if (style?.verticalAlign != null) {
    style.textAlignVertical = verticalAlignToTextAlignVerticalMap[
      style.verticalAlign
    ] as TextStyle['textAlignVertical'];
    delete style.verticalAlign;
  }

  props.style = style;
  return props;
}

/**
 * Normalizes accessibility and ARIA props for runtime native components.
 *
 * @param props - Accessibility and ARIA props.
 * @returns Props with normalized accessibility fields.
 * @remarks
 * - Merges `aria-label` with `accessibilityLabel`
 * - Merges ARIA state fields into `accessibilityState`
 * - Defaults `accessible` to `true` when omitted
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processAccessibilityProps(props: Record<string, any>): Record<string, any> {
  const {
    accessibilityLabel,
    ['aria-label']: ariaLabel,
    accessibilityState,
    ['aria-busy']: ariaBusy,
    ['aria-checked']: ariaChecked,
    ['aria-disabled']: ariaDisabled,
    ['aria-expanded']: ariaExpanded,
    ['aria-selected']: ariaSelected,
    accessible,
    ...restProperties
  } = props;

  // Merge label props: prefer the aria-label if defined.
  const normalizedLabel = ariaLabel ?? accessibilityLabel;

  // Merge the accessibilityState with any provided ARIA properties.
  let normalizedState = accessibilityState;
  if (ariaBusy != null || ariaChecked != null || ariaDisabled != null || ariaExpanded != null || ariaSelected != null) {
    normalizedState =
      normalizedState == null
        ? {
            busy: ariaBusy,
            checked: ariaChecked,
            disabled: ariaDisabled,
            expanded: ariaExpanded,
            selected: ariaSelected,
          }
        : {
            busy: ariaBusy ?? normalizedState.busy,
            checked: ariaChecked ?? normalizedState.checked,
            disabled: ariaDisabled ?? normalizedState.disabled,
            expanded: ariaExpanded ?? normalizedState.expanded,
            selected: ariaSelected ?? normalizedState.selected,
          };
  }

  // For the accessible prop, if not provided, default to `true`
  const normalizedAccessible = accessible == null ? true : accessible;

  return {
    ...restProperties,
    accessibilityLabel: normalizedLabel,
    accessibilityState: normalizedState,
    accessible: normalizedAccessible,
  };
}

export * from './types';
export * from './utils/constants';
export * from './components/native-text';
export * from './components/native-view';
