import { processTextStyle as _processTextStyle, NativeText as _NativeText } from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  {..._processTextStyle({
    color: 'red',
  })}
/>;
<_NativeText
  {..._processTextStyle([
    {
      color: 'red',
    },
    {
      fontSize: 16,
    },
  ])}
/>;
