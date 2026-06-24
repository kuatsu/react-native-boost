import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create({ box: {}, label: {} });
const C = (props) => (
  <View style={styles.box}>
    <Text style={styles.label}>unistyles</Text>
    <Text style={{ color: 'red' }}>plain literal</Text>
    <Text style={props.style}>unknown bails</Text>
  </View>
);
