import { NativeText as _NativeText } from 'react-native/Libraries/Text/TextNativeComponent';
import { flattenTextStyle as _flattenTextStyle } from 'react-native-boost';
import { Text } from 'react-native';
<_NativeText
  {..._flattenTextStyle({
    color: 'red',
  })}
/>;
<_NativeText
  {..._flattenTextStyle([
    {
      color: 'red',
    },
    {
      fontSize: 16,
    },
  ])}
/>;
