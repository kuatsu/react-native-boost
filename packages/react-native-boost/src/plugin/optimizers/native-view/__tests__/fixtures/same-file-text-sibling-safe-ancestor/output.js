import { NativeViewWithContext as _NativeViewWithContext, NativeView as _NativeView } from 'react-native-boost/runtime';
import { Text, View } from 'react-native';
const Card = ({ children }) => (
  <_NativeViewWithContext>
    <Text>Title</Text>
    {children}
  </_NativeViewWithContext>
);
<Card>
  <_NativeView />
</Card>;
