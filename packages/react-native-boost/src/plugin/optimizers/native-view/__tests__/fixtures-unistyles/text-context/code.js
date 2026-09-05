import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create({ box: { flex: 1 } });
function Mixed({ children, inline }) {
  if (inline) return <Text>{children}</Text>;
  return children;
}

<>
  <Text>
    <View style={styles.box}>
      <Text>label</Text>
    </View>
  </Text>
  <Mixed>
    <View style={styles.box}>
      <Text>label</Text>
    </View>
  </Mixed>
  <Text>
    <View style={{ flex: 1 }}>
      <Text>label</Text>
    </View>
  </Text>
</>;
