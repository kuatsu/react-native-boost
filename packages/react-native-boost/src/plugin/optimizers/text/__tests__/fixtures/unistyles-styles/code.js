import { Text, StyleSheet as RNStyleSheet } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import * as Unistyles from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  title: { color: theme.colors.text },
  active: { fontWeight: '600' },
}));

const namespaceStyles = Unistyles.StyleSheet.create((theme) => ({
  title: { color: theme.colors.text },
}));

const staticStyles = StyleSheet.create({
  subtitle: { color: 'blue', fontSize: 16 },
});

const rnStyles = RNStyleSheet.create({
  title: { color: 'red' },
});

const titleStyle = styles.title;
const staticTitleStyle = staticStyles.subtitle;
const textProps = { style: titleStyle };

<>
  <Text style={styles.title}>Title</Text>
  <Text style={titleStyle}>Alias</Text>
  <Text style={[styles.title, isActive && styles.active]}>Active</Text>
  <Text {...textProps}>Spread</Text>
  <Text style={namespaceStyles.title}>Namespace</Text>
  <Text style={staticStyles.subtitle}>Static</Text>
  <Text style={staticTitleStyle}>Static Alias</Text>
  <Text style={rnStyles.title}>React Native style</Text>
</>;
