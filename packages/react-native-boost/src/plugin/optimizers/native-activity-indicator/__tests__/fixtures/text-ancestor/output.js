import {
  NativeView as _NativeView,
  activityIndicatorStyles as _activityIndicatorStyles,
  NativeActivityIndicator as _NativeActivityIndicator,
} from 'react-native-boost/runtime';
import { ActivityIndicator, Text } from 'react-native';
<Text>
  <_NativeView style={_activityIndicatorStyles.container}>
    <_NativeActivityIndicator
      animating={true}
      color="#999999"
      hidesWhenStopped={true}
      style={_activityIndicatorStyles.small}
      size="small"
    />
  </_NativeView>
</Text>;
