import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import * as Unistyles from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  container: { backgroundColor: theme.colors.background },
}));

const namespaceStyles = Unistyles.StyleSheet.create((theme) => ({
  container: { backgroundColor: theme.colors.background },
}));

const staticStyles = StyleSheet.create({
  box: { backgroundColor: 'red', opacity: 1 },
});

const containerStyle = styles.container;
const staticContainerStyle = staticStyles.box;
const viewProps = { style: containerStyle };

<>
  <View style={styles.container} />
  <View style={containerStyle} />
  <View style={namespaceStyles.container} />
  <View {...viewProps} />
  <View style={staticStyles.box} />
  <View style={staticContainerStyle} />
</>;
