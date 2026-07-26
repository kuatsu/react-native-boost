import {
  NativeView as _NativeView,
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text, View } from 'react-native';
const C = () => (
  <_NativeView
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
  </_NativeView>
);
