import {
  NativeView as _NativeView,
  activityIndicatorStyles as _activityIndicatorStyles,
  NativeActivityIndicator as _NativeActivityIndicator,
} from 'react-native-boost/runtime';
import { ActivityIndicator } from 'react-native';
<_NativeView style={_activityIndicatorStyles.container}>
  <_NativeActivityIndicator
    animating={false}
    color="red"
    hidesWhenStopped={true}
    testID="spinner"
    style={_activityIndicatorStyles.large}
    size="large"
  />
</_NativeView>;
