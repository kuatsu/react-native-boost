import { NativeText as _NativeText } from 'react-native-boost/runtime';
import { Text } from 'react-native';
const someFunction = () => ({});
<_NativeText allowFontScaling={true} ellipsizeMode={'tail'}>
  Hello
</_NativeText>;
<_NativeText allowFontScaling={false} ellipsizeMode={'tail'}>
  No Scaling
</_NativeText>;
const unknownProps = someFunction();
<Text {...unknownProps}>Unknown</Text>;
const partialProps = {
  color: 'blue',
  ellipsizeMode: 'clip',
};
<_NativeText {...partialProps} allowFontScaling={true}>
  Partial props
</_NativeText>;
