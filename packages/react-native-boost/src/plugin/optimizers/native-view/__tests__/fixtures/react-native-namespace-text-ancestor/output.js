import { NativeViewWithContext as _NativeViewWithContext } from 'react-native-boost/runtime';
import * as ReactNative from 'react-native';
import { View } from 'react-native';
<ReactNative.Text>
  <_NativeViewWithContext>
    <NotOptimized />
  </_NativeViewWithContext>
</ReactNative.Text>;
