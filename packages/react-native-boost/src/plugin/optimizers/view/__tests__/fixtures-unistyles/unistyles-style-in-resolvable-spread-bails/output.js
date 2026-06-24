import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create({
  box: {
    flex: 1,
  },
});
const extra = {
  style: styles.box,
};
<View {...extra} />;
