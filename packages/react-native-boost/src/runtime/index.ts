import { TextStyle } from 'react-native';
import { flattenStyle } from 'react-native/Libraries/StyleSheet/flattenStyle';
import { GenericStyleProp } from './types';

const propsCache = new WeakMap();

export function flattenTextStyle(style: GenericStyleProp<TextStyle>) {
  if (!style) return {};

  // Cache the computed props
  let props = propsCache.get(style);
  if (props) return props;

  props = {};
  propsCache.set(style, props);

  style = flattenStyle(style);

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

// Maps the `userSelect` prop to the native `selectable` prop
export const userSelectToSelectableMap = {
  auto: true,
  text: true,
  none: false,
  contain: true,
  all: true,
};

// Maps the `verticalAlign` prop to the native `textAlignVertical` prop
export const verticalAlignToTextAlignVerticalMap = {
  auto: 'auto',
  top: 'top',
  bottom: 'bottom',
  middle: 'center',
};

export * from './types';
