import {
  NativeView as _NativeView,
  activityIndicatorStyles as _activityIndicatorStyles,
  NativeActivityIndicator as _NativeActivityIndicator,
  resolveActivityIndicatorDefault as _resolveActivityIndicatorDefault,
} from 'react-native-boost/runtime';
import { ActivityIndicator } from 'react-native';
<>
  {/* @boost-force */}
  <_NativeView style={_activityIndicatorStyles.container}>
    <_NativeActivityIndicator
      animating={true}
      color={_resolveActivityIndicatorDefault(getColor(), '#999999')}
      hidesWhenStopped={true}
      style={_activityIndicatorStyles.small}
      size="small"
    />
  </_NativeView>
</>;
