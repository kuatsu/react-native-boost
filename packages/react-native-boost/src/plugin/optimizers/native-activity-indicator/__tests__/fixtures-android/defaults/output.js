import {
  NativeView as _NativeView,
  activityIndicatorStyles as _activityIndicatorStyles,
  NativeActivityIndicator as _NativeActivityIndicator,
} from 'react-native-boost/runtime';
import { ActivityIndicator } from 'react-native';
<_NativeView style={_activityIndicatorStyles.container}>
  <_NativeActivityIndicator
    animating={true}
    color={null}
    hidesWhenStopped={true}
    style={_activityIndicatorStyles.small}
    size="small"
    styleAttr="Normal"
    indeterminate={true}
  />
</_NativeView>;
