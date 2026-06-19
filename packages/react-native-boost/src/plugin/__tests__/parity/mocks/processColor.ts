// Identity stand-in for `react-native/Libraries/StyleSheet/processColor`. Its real implementation
// does a CJS `require('../Utilities/Platform')` that escapes vite resolution and pulls raw Flow into
// Node. We don't exercise `selectionColor`, so cutting that subtree here is safe.
export default function processColor(color: unknown) {
  return color;
}
