import {
  processViewAccessibilityProps as _processViewAccessibilityProps,
  NativeView as _NativeView,
} from 'react-native-boost/runtime';
import { View } from 'react-native';
<_NativeView
  {..._processViewAccessibilityProps(
    Object.assign(
      {},
      {
        tabIndex: tab,
      }
    )
  )}
/>;
