import { processTextStyle as _processTextStyle, NativeText as _NativeText } from 'react-native-boost/runtime';
import { Text, StyleSheet as RNStyleSheet } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import * as Unistyles from 'react-native-unistyles';
const styles = StyleSheet.create((theme) => ({
  title: {
    color: theme.colors.text,
  },
  active: {
    fontWeight: '600',
  },
}));
const namespaceStyles = Unistyles.StyleSheet.create((theme) => ({
  title: {
    color: theme.colors.text,
  },
}));
const staticStyles = StyleSheet.create({
  subtitle: {
    color: 'blue',
    fontSize: 16,
  },
});
const rnStyles = RNStyleSheet.create({
  title: {
    color: 'red',
  },
});
const titleStyle = styles.title;
const staticTitleStyle = staticStyles.subtitle;
const textProps = {
  style: titleStyle,
};
<>
  <Text style={styles.title}>Title</Text>
  <Text style={titleStyle}>Alias</Text>
  <Text style={[styles.title, isActive && styles.active]}>Active</Text>
  <Text {...textProps}>Spread</Text>
  <Text style={namespaceStyles.title}>Namespace</Text>
  <_NativeText {..._processTextStyle(staticStyles.subtitle)} allowFontScaling={true} ellipsizeMode={'tail'}>
    Static
  </_NativeText>
  <_NativeText {..._processTextStyle(staticTitleStyle)} allowFontScaling={true} ellipsizeMode={'tail'}>
    Static Alias
  </_NativeText>
  <_NativeText {..._processTextStyle(rnStyles.title)} allowFontScaling={true} ellipsizeMode={'tail'}>
    React Native style
  </_NativeText>
</>;
