import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { describe, it } from 'react-native-harness';
import { expectOptimizedMount, pixel, type Tree } from './support';

// Boost resolves non-literal props with its runtime helpers, so these keep that code under test.
const color = 'tomato';
const lines = 2;
const size = 'large';
const animating = true;
const label = 'Target';
const source = { uri: pixel, width: 24, height: 24 };
const margin = { margin: 8 };

const styles = StyleSheet.create({
  box: { width: 48, height: 48, backgroundColor: 'steelblue' },
  text: { fontSize: 18, fontWeight: 'bold', color: 'tomato' },
});

const cases: Record<string, Tree> = {
  'Text': (
    <View>
      <Text testID="target">Hello</Text>
    </View>
  ),
  'Text with static props': (
    <View>
      <Text testID="target" numberOfLines={1} selectable style={{ fontSize: 18, color: 'tomato' }}>
        Hello
      </Text>
    </View>
  ),
  'Text with dynamic props': (
    <View>
      <Text testID="target" numberOfLines={lines} accessibilityLabel={label} style={[styles.text, { color }]}>
        Hello
      </Text>
    </View>
  ),
  'View': (
    <View>
      <View testID="target" />
    </View>
  ),
  'View with static props': (
    <View>
      <View
        testID="target"
        accessible
        accessibilityLabel="Target"
        pointerEvents="none"
        style={{ width: 48, height: 48 }}
      />
    </View>
  ),
  'View with dynamic props': (
    <View>
      <View testID="target" accessibilityLabel={label} style={[styles.box, { backgroundColor: color }]} />
    </View>
  ),
  'Image': (
    <View>
      <Image testID="target" source={{ uri: pixel }} style={{ width: 24, height: 24 }} />
    </View>
  ),
  'Image with static props': (
    <View>
      <Image
        testID="target"
        source={{ uri: pixel, width: 24, height: 24 }}
        resizeMode="contain"
        tintColor="tomato"
        accessibilityLabel="Target"
      />
    </View>
  ),
  'Image with dynamic props': (
    <View>
      <Image testID="target" source={source} tintColor={color} alt={label} style={styles.box} />
    </View>
  ),
  'ActivityIndicator': (
    <View>
      <ActivityIndicator testID="target" />
    </View>
  ),
  'ActivityIndicator with static props': (
    <View>
      <ActivityIndicator testID="target" size="large" color="tomato" animating={false} hidesWhenStopped={false} />
    </View>
  ),
  'ActivityIndicator with dynamic props': (
    <View>
      <ActivityIndicator testID="target" size={size} color={color} animating={animating} style={margin} />
    </View>
  ),
};

describe('components optimized by Boost', () => {
  for (const [name, tree] of Object.entries(cases)) {
    it(`mounts ${name}`, () => expectOptimizedMount(tree));
  }
});
