import { Image } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create({ image: { width: 16 } });

<>
  {/* @boost-force */}
  <Image source={{ uri: 'logo.png' }} style={styles.image} />
</>;
