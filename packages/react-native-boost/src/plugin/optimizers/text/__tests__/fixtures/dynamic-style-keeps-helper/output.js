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
  {..._processTextStyle(dynamicStyle)}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}
/>;
<_NativeText
  {..._processTextStyle([
    {
      a: 1,
    },
    condition && {
      b: 2,
    },
  ])}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}
/>;
<_NativeText
  {..._processTextStyle(styles.foo)}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}
/>;
