import { NativeText as _UnistylesNativeText } from 'react-native-unistyles/components/native/NativeText';
import { getDefaultTextAccessible as _getDefaultTextAccessible } from 'react-native-boost/runtime';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create({
  text: {
    color: 'red',
  },
});
<_UnistylesNativeText
  style={styles.text}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}>
  Hello
</_UnistylesNativeText>;
