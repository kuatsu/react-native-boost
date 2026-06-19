import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../navigation';

export default function LauncherScreen({ navigation }: RootStackScreenProps<'Launcher'>) {
  return (
    <View style={styles.screen}>
      <View style={styles.intro}>
        <Text style={styles.title}>React Native Boost</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => navigation.navigate('TradingDemo', { coinId: 'btc' })}>
        <Text style={styles.cardTitle}>Trading Demo</Text>
        <Text style={styles.cardBody}>
          A wall of price cells re-rendering every frame. Toggle Boost on and off to see the FPS impact.
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => navigation.navigate('Benchmark')}>
        <Text style={styles.cardTitle}>Mount Benchmark</Text>
        <Text style={styles.cardBody}>Mount thousands of Text and View nodes and measure raw render time.</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b0e11',
    padding: 20,
    gap: 16,
    justifyContent: 'center',
  },
  intro: {
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#eaecef',
  },
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#12161c',
    borderColor: '#2a3139',
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#eaecef',
  },
  cardBody: {
    fontSize: 13,
    color: '#9aa3ad',
    marginTop: 6,
    lineHeight: 18,
  },
});
