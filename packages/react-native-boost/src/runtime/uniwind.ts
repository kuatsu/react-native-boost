import { jsx } from 'react/jsx-runtime';
import type { ActivityIndicatorProps, ImageProps, TextProps, ViewProps } from 'react-native';
import { Platform } from 'react-native';
import { useStyle } from 'react-native-boost/uniwind/useStyle';
import { useAccentColor } from 'react-native-boost/uniwind/useAccentColor';
import {
  NativeView as ViewHost,
  NativeViewWithContext as ContextViewHost,
  NativeText as TextHost,
  NativeImage as ImageHost,
  NativeActivityIndicator as ActivityHost,
  processViewAccessibilityProps,
  processTextAccessibilityProps,
  processTextStyle,
  processSelectionColor,
  processImageAccessibilityProps,
  processImageSourceProps,
  processActivityIndicatorStyle,
  processActivityIndicatorSize,
} from './index';

export { useAnimatedValue } from 'react-native';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore These exports require RN 0.85; the optimizer checks the target version before using them.
export { useAnimatedValueXY, useAnimatedColor } from 'react-native';

type ClassProps = { className?: string };

export function NativeView(props: ViewProps & ClassProps) {
  const style = useStyle(props.className, props);
  const { id, nativeID, ...rest } = processViewAccessibilityProps(props);
  return jsx(ViewHost, { ...rest, nativeID: id ?? nativeID, style: [style, props.style] });
}

export function NativeViewWithContext(props: ViewProps & ClassProps) {
  const style = useStyle(props.className, props);
  const { id, nativeID, ...rest } = processViewAccessibilityProps(props);
  return jsx(ContextViewHost, { ...rest, nativeID: id ?? nativeID, style: [style, props.style] });
}

export function NativeText(props: TextProps & ClassProps & { selectionColorClassName?: string }) {
  // Eligible Text has no press handlers, so React Native never starts pressability.
  const state = { isPressed: false, isDisabled: Boolean(props.disabled) };
  const style = useStyle(props.className, props, state);
  const accent = useAccentColor(props.selectionColorClassName, props, state);
  const { id, nativeID, selectionColor, ...rest } = processTextAccessibilityProps(props);
  const lines = style.WebkitLineClamp ?? props.numberOfLines;
  return jsx(TextHost, {
    ...rest,
    ...processTextStyle([style, props.style]),
    ...processSelectionColor(selectionColor ?? accent),
    nativeID: id ?? nativeID,
    allowFontScaling: props.allowFontScaling !== false,
    ellipsizeMode: props.ellipsizeMode ?? 'tail',
    numberOfLines: lines != null && !(lines >= 0) ? 0 : lines,
  });
}

export function NativeImage(props: ImageProps & ClassProps & { tintColorClassName?: string }) {
  const style = useStyle(props.className, props);
  const accent = useAccentColor(props.tintColorClassName, props);
  const resolved = { ...props, style: [style, props.style], tintColor: props.tintColor ?? accent };
  const { id, nativeID, ...rest } = processImageAccessibilityProps(resolved);
  return jsx(ImageHost, {
    ...rest,
    ...processImageSourceProps(resolved),
    nativeID: id ?? nativeID,
    ...(Platform.OS === 'android'
      ? { shouldNotifyLoadEvents: Boolean(props.onLoadStart || props.onLoad || props.onLoadEnd || props.onError) }
      : {}),
  });
}

export function NativeActivityIndicator(props: ActivityIndicatorProps & ClassProps & { colorClassName?: string }) {
  const generatedStyle = useStyle(props.className, props);
  const accent = useAccentColor(props.colorClassName, props);
  const { style, color, size, animating = true, hidesWhenStopped = true, onLayout, ...rest } = props;
  const resolvedColor = color ?? accent;
  return jsx(ViewHost, {
    style: processActivityIndicatorStyle([generatedStyle, style]),
    onLayout,
    children: jsx(ActivityHost, {
      ...rest,
      animating,
      hidesWhenStopped,
      color: resolvedColor === undefined ? (Platform.OS === 'ios' ? '#999999' : null) : resolvedColor,
      ...processActivityIndicatorSize(size),
      ...(Platform.OS === 'android' ? { styleAttr: 'Normal', indeterminate: true } : {}),
    }),
  });
}
