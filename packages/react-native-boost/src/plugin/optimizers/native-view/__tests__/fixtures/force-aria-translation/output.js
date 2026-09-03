import { NativeView as _NativeView } from 'react-native-boost/runtime';
import { View } from 'react-native';
function Component(props) {
  return (
    <>
      <View {...props} aria-label="x" />
      {/* @boost-force */}
      <_NativeView {...props} accessibilityLabel="x" />
    </>
  );
}
