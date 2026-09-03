import {
  processTextStyle as _processTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text, StyleSheet } from 'react-native';
const styles = StyleSheet.create({
  foo: {
    color: 'red',
  },
});
<_NativeText
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  {..._processTextStyle(dynamicStyle)}
  accessible={_getDefaultTextAccessible()}
/>;
<_NativeText
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  {..._processTextStyle([
    {
      a: 1,
    },
    condition && {
      b: 2,
    },
  ])}
  accessible={_getDefaultTextAccessible()}
/>;
<_NativeText
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  {..._processTextStyle(styles.foo)}
  accessible={_getDefaultTextAccessible()}
/>;
