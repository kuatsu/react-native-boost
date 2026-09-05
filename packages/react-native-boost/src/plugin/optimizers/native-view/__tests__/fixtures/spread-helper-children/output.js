import { NativeViewWithContext as _NativeViewWithContext } from 'react-native-boost/runtime';
import { Text, View } from 'react-native';
function getProps(children) {
  return {
    children,
  };
}
export const Cell = () => (
  <Text>
    <_NativeViewWithContext {...getProps(<Text>cell</Text>)} />
  </Text>
);
