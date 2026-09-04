import { Image, StyleSheet } from 'react-native';

const styles = StyleSheet.create({ image: { width: 16 } });

<Image source={{ uri: 'logo.png' }} style={styles.image} />;
