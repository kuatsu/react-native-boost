import { processTextStyle as _processTextStyle, NativeText as _NativeText } from 'react-native-boost/runtime';
import { NativeText as _UnistylesNativeText } from 'react-native-unistyles/components/native/NativeText';
import { getDefaultTextAccessible as _getDefaultTextAccessible } from 'react-native-boost/runtime';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create({
  box: {},
  label: {},
});
const C = (props) => (
  <View style={styles.box}>
    <_UnistylesNativeText
      style={styles.label}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      unistyles
    </_UnistylesNativeText>
    <_NativeText
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      {..._processTextStyle({
        color: 'red',
      })}
      accessible={_getDefaultTextAccessible()}>
      plain literal
    </_NativeText>
    <Text style={props.style}>unknown bails</Text>
  </View>
);
