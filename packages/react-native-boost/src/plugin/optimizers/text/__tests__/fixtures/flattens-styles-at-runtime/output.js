import { flattenTextStyle as _flattenTextStyle, NativeText as _NativeText } from 'react-native-boost';
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
