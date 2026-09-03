import { Text, StyleSheet } from 'react-native';
const styles = StyleSheet.create({ foo: { color: 'red' } });
<Text style={dynamicStyle} />;
<Text style={[{ a: 1 }, condition && { b: 2 }]} />;
<Text style={styles.foo} />;
