import { NativeViewWithContext as _NativeViewWithContext, NativeView as _NativeView } from 'react-native-boost/runtime';
import { View } from 'react-native';
const Box = ({ children }) => <_NativeViewWithContext testID="box">{children}</_NativeViewWithContext>;
const ExplicitChildren = ({ children }) => <_NativeViewWithContext children={children} />;
const Empty = () => <_NativeView />;
const Nested = ({ children }) => (
  <_NativeViewWithContext>
    <_NativeView>{children}</_NativeView>
  </_NativeViewWithContext>
);
function renderBox(children) {
  return <_NativeViewWithContext>{children}</_NativeViewWithContext>;
}
