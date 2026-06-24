import { Pressable, Text, View } from 'react-native';
import { StyleSheet, UnistylesRuntime, useUnistyles } from 'react-native-unistyles';
import { RootStackScreenProps } from '../../navigation';

/**
 * Boost × Unistyles compatibility probe.
 *
 * These subjects do NOT call `useUnistyles`, so they never re-render — any color/layout change after a theme toggle or a
 * rotation can only come through the native (C++) update path, i.e. the registration Boost preserved.
 */
export default function UnistylesDemoScreen(_props: RootStackScreenProps<'UnistylesDemo'>) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Unistyles × Boost</Text>
      <Text style={styles.subtitle}>
        These cards are Boost-optimized and Unistyles-reactive. Toggle the theme or rotate the device: if the colors and
        layout update, the native registration survived optimization.
      </Text>

      <ThemeToggle />
      <StatusReadout />

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Card A</Text>
          <Text style={styles.cardBody}>background and text follow the theme</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Card B</Text>
          <Text style={styles.cardBody}>row on wide screens, column on narrow</Text>
        </View>
      </View>

      <View style={styles.accentBox}>
        <Text style={styles.accentText}>Accent box — background is accent on narrow, card on wide</Text>
      </View>
    </View>
  );
}

function ThemeToggle() {
  const { rt } = useUnistyles();
  return (
    <Pressable
      style={styles.toggle}
      onPress={() => UnistylesRuntime.setTheme(rt.themeName === 'dark' ? 'light' : 'dark')}>
      <Text style={styles.toggleText}>Toggle theme (current: {rt.themeName})</Text>
    </Pressable>
  );
}

function StatusReadout() {
  const { rt } = useUnistyles();
  return (
    <View style={styles.status}>
      <Text style={styles.statusText}>theme: {rt.themeName}</Text>
      <Text style={styles.statusText}>breakpoint: {rt.breakpoint}</Text>
      <Text style={styles.statusText}>width: {Math.round(rt.screen.width)}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.gap(2),
    gap: theme.gap(1.5),
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.muted,
  },
  toggle: {
    borderRadius: 12,
    padding: theme.gap(1.5),
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  status: {
    flexDirection: 'row',
    gap: theme.gap(2),
    paddingVertical: theme.gap(1),
  },
  statusText: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  row: {
    flexDirection: { xs: 'column', md: 'row' },
    gap: theme.gap(1.5),
  },
  card: {
    flex: 1,
    borderRadius: 16,
    padding: theme.gap(2),
    backgroundColor: theme.colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    minHeight: 96,
    gap: theme.gap(0.5),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  cardBody: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  accentBox: {
    borderRadius: 12,
    padding: theme.gap(2),
    backgroundColor: {
      xs: theme.colors.accent,
      md: theme.colors.card,
    },
  },
  accentText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
}));
