export const View = () => 'View';
export const Text = () => 'Text';
export const Image = () => 'Image';

export const Platform = {
  OS: 'ios',
};

export const StyleSheet = {
  flatten: <T>(style: T) => style,
};

// Backs the runtime index's `import { processColor } from 'react-native'`. Identity is fine here: the
// dedicated `processSelectionColor` assertions use the runtime test's own switchable mock; this exists
// so any unit test that transitively imports the runtime index resolves the named export.
export const processColor = <T>(color: T) => color;
