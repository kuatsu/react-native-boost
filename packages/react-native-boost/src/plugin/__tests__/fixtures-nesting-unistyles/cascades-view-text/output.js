import { NativeText as _UnistylesNativeText } from 'react-native-unistyles/components/native/NativeText';
import { getDefaultTextAccessible as _getDefaultTextAccessible } from 'react-native-boost/runtime';
import _UnistylesNativeView from 'react-native-unistyles/components/native/NativeView';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create({
  box: {
    flex: 1,
  },
  t: {},
});
const C = () => (
  <_UnistylesNativeView style={styles.box}>
    <_UnistylesNativeText
      style={styles.t}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      top
    </_UnistylesNativeText>
    <_UnistylesNativeView style={styles.box}>
      <_UnistylesNativeText
        style={styles.t}
        allowFontScaling={true}
        ellipsizeMode={'tail'}
        accessible={_getDefaultTextAccessible()}>
        deep
      </_UnistylesNativeText>
    </_UnistylesNativeView>
  </_UnistylesNativeView>
);
