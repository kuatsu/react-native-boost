import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
const benchmarks = [
  {
    title: 'Text',
    count: 10_000,
    optimizedComponent: (
      <_NativeText
        style={_getDefaultTextStyle()}
        allowFontScaling={true}
        ellipsizeMode={'tail'}
        accessible={_getDefaultTextAccessible()}>
        Nice text
      </_NativeText>
    ),
    // @boost-ignore
    unoptimizedComponent: <Text>Nice text</Text>,
  },
];
