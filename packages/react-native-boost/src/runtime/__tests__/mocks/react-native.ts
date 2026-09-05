export const View = () => 'View';
export const unstable_TextAncestorContext = undefined;
export const Text = () => 'Text';
export const Image = Object.assign(() => 'Image', {
  resolveAssetSource: <T>(source: T): T => source,
});
export const ActivityIndicator = () => 'ActivityIndicator';

// `constants.reactNativeVersion` backs the runtime's Image wrapper-version gates. Pinned rather than
// read from the installed RN so unit expectations are deterministic; the version-dependent branches
// have their own tests that reload the runtime against a specific version.
export const Platform = {
  OS: 'ios',
  constants: { reactNativeVersion: { major: 0, minor: 86, patch: 0 } },
};

export const StyleSheet = {
  flatten: (style: unknown): unknown => {
    if (!Array.isArray(style)) return style;
    const result: Record<string, unknown> = {};
    for (const entry of style) {
      const flat = StyleSheet.flatten(entry);
      if (flat && typeof flat === 'object') Object.assign(result, flat);
    }
    return result;
  },
};

// Backs the runtime index's `import { processColor } from 'react-native'`. Identity is fine here: the
// dedicated `processSelectionColor` assertions use the runtime test's own switchable mock; this exists
// so any unit test that transitively imports the runtime index resolves the named export.
export const processColor = <T>(color: T) => color;
