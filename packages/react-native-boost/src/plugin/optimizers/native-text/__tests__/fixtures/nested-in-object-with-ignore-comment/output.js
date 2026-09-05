import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text, View } from 'react-native';
const benchmarks = [
  {
    title: 'Text',
    count: 10_000,
    optimizedComponent: (
      <View>
        <_NativeText
          style={_getDefaultTextStyle() ? [_getDefaultTextStyle(), void 0] : void 0}
          allowFontScaling={true}
          ellipsizeMode={'tail'}
          accessible={_getDefaultTextAccessible()}>
          Nice text
        </_NativeText>
      </View>
    ),
    unoptimizedComponent: (
      <View>
        {/* @boost-ignore */}
        <Text>Nice text</Text>
      </View>
    ),
  },
];
