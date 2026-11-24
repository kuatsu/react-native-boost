import { Text, View } from 'react-native';
import { describe, it } from 'react-native-harness';
import { StyleSheet } from 'react-native-unistyles';
import { expectOptimizedMount, type Tree } from './support';

const themes = { light: { accent: 'tomato' } };

type Themes = typeof themes;

/* oxlint-disable no-empty-object-type */
declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends Themes {}
}
/* oxlint-enable no-empty-object-type */

StyleSheet.configure({ themes, settings: { initialTheme: 'light' } });

const styles = StyleSheet.create((theme) => ({
  box: { width: 48, height: 48, backgroundColor: theme.accent },
  text: { fontSize: 18, color: theme.accent },
}));

const opacity = 0.5;

const cases: Record<string, Tree> = {
  'Text': (
    <View>
      <Text testID="target" style={styles.text}>
        Hello
      </Text>
    </View>
  ),
  'Text with a style array': (
    <View>
      <Text testID="target" numberOfLines={1} style={[styles.text, { opacity }]}>
        Hello
      </Text>
    </View>
  ),
  'View': (
    <View>
      <View testID="target" style={styles.box} />
    </View>
  ),
  'View with a style array': (
    <View>
      <View testID="target" accessibilityLabel="Target" style={[styles.box, { opacity }]} />
    </View>
  ),
};

describe('components with Unistyles styles optimized by Boost', () => {
  for (const [name, tree] of Object.entries(cases)) {
    it(`mounts ${name}`, () => expectOptimizedMount(tree));
  }
});
