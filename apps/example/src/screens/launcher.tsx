import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackScreenProps } from '../navigation';

export default function LauncherScreen({ navigation }: RootStackScreenProps<'Launcher'>) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.title}>React Native Boost</Text>
        </View>

        <View style={[styles.cards, landscape && styles.cardsLandscape]}>
          <Pressable
            style={({ pressed }) => [styles.card, landscape && styles.cardLandscape, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('TradingDemo')}>
            <Text style={styles.cardTitle}>Trading Demo</Text>
            <Text style={styles.cardBody}>
              A wall of price cells re-rendering every frame. Toggle Boost on and off to see the FPS impact.
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.card, landscape && styles.cardLandscape, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('Benchmark')}>
            <Text style={styles.cardTitle}>Mount Benchmark</Text>
            <Text style={styles.cardBody}>Mount thousands of Text and View nodes and measure raw render time.</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.card, landscape && styles.cardLandscape, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('UnistylesDemo')}>
            <Text style={styles.cardTitle}>Unistyles Demo</Text>
            <Text style={styles.cardBody}>
              Boost-optimized Text and View driven by Unistyles serving as a test screen for Boost's Unistyles support
              layer.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b0e11',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    gap: 16,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  cards: {
    gap: 16,
  },
  cardsLandscape: {
    flexDirection: 'row',
  },
  cardLandscape: {
    flex: 1,
    flexBasis: 0,
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
