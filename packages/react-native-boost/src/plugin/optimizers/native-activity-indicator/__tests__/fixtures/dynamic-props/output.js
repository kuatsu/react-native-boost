import {
  NativeView as _NativeView,
  activityIndicatorStyles as _activityIndicatorStyles,
  NativeActivityIndicator as _NativeActivityIndicator,
  resolveActivityIndicatorDefault as _resolveActivityIndicatorDefault,
  processActivityIndicatorSize as _processActivityIndicatorSize,
  processActivityIndicatorStyle as _processActivityIndicatorStyle,
} from 'react-native-boost/runtime';
import { ActivityIndicator } from 'react-native';
const animating = true;
const color = 'red';
const hides = false;
const size = 24;
const style = {
  margin: 4,
};
<_NativeView style={_processActivityIndicatorStyle(style)}>
  <_NativeActivityIndicator
    animating={_resolveActivityIndicatorDefault(animating, true)}
    color={_resolveActivityIndicatorDefault(color, '#999999')}
    hidesWhenStopped={_resolveActivityIndicatorDefault(hides, true)}
    {..._processActivityIndicatorSize(size)}
  />
</_NativeView>;
