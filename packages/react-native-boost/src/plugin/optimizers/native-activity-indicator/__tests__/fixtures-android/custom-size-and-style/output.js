import {
  NativeView as _NativeView,
  activityIndicatorStyles as _activityIndicatorStyles,
  NativeActivityIndicator as _NativeActivityIndicator,
} from 'react-native-boost/runtime';
import { ActivityIndicator } from 'react-native';
<_NativeView
  style={[
    _activityIndicatorStyles.container,
    {
      margin: 4,
    },
  ]}>
  <_NativeActivityIndicator
    animating={true}
    color={null}
    hidesWhenStopped={true}
    style={{
      height: 24,
      width: 24,
    }}
    styleAttr="Normal"
    indeterminate={true}
  />
</_NativeView>;
