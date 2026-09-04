import {
  NativeView as _NativeView,
  activityIndicatorStyles as _activityIndicatorStyles,
  NativeActivityIndicator as _NativeActivityIndicator,
  processActivityIndicatorStyle as _processActivityIndicatorStyle,
} from 'react-native-boost/runtime';
import { ActivityIndicator } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create({
  spinner: {
    margin: 4,
  },
});
<>
  {/* @boost-force */}
  <_NativeView style={_processActivityIndicatorStyle(styles.spinner)}>
    <_NativeActivityIndicator
      animating={true}
      color="#999999"
      hidesWhenStopped={true}
      style={_activityIndicatorStyles.small}
      size="small"
    />
  </_NativeView>
</>;
