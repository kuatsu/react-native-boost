import { getDefaultTextStyle as _getDefaultTextStyle, NativeText as _NativeText } from 'react-native-boost/runtime';
import { NativeText as _UnistylesNativeText } from 'react-native-unistyles/components/native/NativeText';
import { getDefaultTextAccessible as _getDefaultTextAccessible } from 'react-native-boost/runtime';
import _UnistylesNativeView from 'react-native-unistyles/components/native/NativeView';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create({
  box: {},
  label: {},
});
const C = (props) => (
  <_UnistylesNativeView style={styles.box}>
    <_UnistylesNativeText
      style={styles.label}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      unistyles
    </_UnistylesNativeText>
    <_NativeText
      style={[
        _getDefaultTextStyle(),
        {
          color: 'red',
        },
      ]}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      plain literal
    </_NativeText>
    <Text style={props.style}>unknown bails</Text>
  </_UnistylesNativeView>
);
