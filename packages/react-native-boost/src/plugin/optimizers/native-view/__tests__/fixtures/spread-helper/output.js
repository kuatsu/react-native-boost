import { NativeView as _NativeView } from 'react-native-boost/runtime';
import { View } from 'react-native';
function getProps(enabled, index) {
  if (!enabled) return {};
  const props = {
    role: 'cell',
  };
  if (index !== undefined) props['aria-colindex'] = index;
  return props;
}
export const Cell = ({ enabled, index }) => <_NativeView {...getProps(enabled, index)} />;
