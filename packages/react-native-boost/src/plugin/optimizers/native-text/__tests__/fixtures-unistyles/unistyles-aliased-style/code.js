import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create({ text: { color: 'red' } });
const textStyle = styles.text;
<Text style={textStyle}>Hello</Text>;
