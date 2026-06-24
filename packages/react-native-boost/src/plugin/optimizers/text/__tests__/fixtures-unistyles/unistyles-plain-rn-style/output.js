import {
  processTextStyle as _processTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text, StyleSheet } from 'react-native';
const styles = StyleSheet.create({
  text: {
    color: 'red',
  },
});
<_NativeText
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  {..._processTextStyle(styles.text)}
  accessible={_getDefaultTextAccessible()}>
  Hello
</_NativeText>;
