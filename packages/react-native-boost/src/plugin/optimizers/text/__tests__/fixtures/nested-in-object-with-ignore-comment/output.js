import { NativeText as _NativeText } from 'react-native-boost/runtime';
import { Text } from 'react-native';
const benchmarks = [
  {
    title: 'Text',
    count: 10_000,
    optimizedComponent: (
      <_NativeText allowFontScaling={true} ellipsizeMode={'tail'}>
        Nice text
      </_NativeText>
    ),
    // @boost-ignore
    unoptimizedComponent: <Text>Nice text</Text>,
  },
];
