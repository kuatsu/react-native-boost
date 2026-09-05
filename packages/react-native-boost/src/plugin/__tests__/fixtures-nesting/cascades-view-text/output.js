import {
  NativeViewWithContext as _NativeViewWithContext,
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
  NativeView as _NativeView,
} from 'react-native-boost/runtime';
import { Text, View } from 'react-native';
const C = () => (
  <_NativeViewWithContext
    style={{
      flex: 1,
    }}>
    <_NativeText
      style={_getDefaultTextStyle()}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      top
    </_NativeText>
    <_NativeView
      style={{
        gap: 4,
      }}>
      <_NativeText
        style={_getDefaultTextStyle()}
        allowFontScaling={true}
        ellipsizeMode={'tail'}
        accessible={_getDefaultTextAccessible()}>
        deep
      </_NativeText>
    </_NativeView>
  </_NativeViewWithContext>
);
