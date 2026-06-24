import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create({ box: { flex: 1 }, t: {} });
const C = () => (
  <View style={styles.box}>
    <Text style={styles.t}>top</Text>
    <View style={styles.box}>
      <Text style={styles.t}>deep</Text>
    </View>
  </View>
);
