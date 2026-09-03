import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create({ text: { color: 'red' } });
<Text style={[styles.text, { margin: 4 }]}>Hello</Text>;
