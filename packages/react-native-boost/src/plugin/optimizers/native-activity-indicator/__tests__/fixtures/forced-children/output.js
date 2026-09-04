import {
  NativeView as _NativeView,
  activityIndicatorStyles as _activityIndicatorStyles,
  NativeActivityIndicator as _NativeActivityIndicator,
} from 'react-native-boost/runtime';
import { ActivityIndicator, View } from 'react-native';
<>
  {/* @boost-force */}
  <_NativeView style={_activityIndicatorStyles.container}>
    <_NativeActivityIndicator
      animating={true}
      color="#999999"
      hidesWhenStopped={true}
      style={_activityIndicatorStyles.small}
      size="small"
    />
  </_NativeView>
</>;
