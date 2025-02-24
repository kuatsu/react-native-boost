import { NativeText as _NativeText } from 'react-native-boost';
import { Text } from 'react-native';
const benchmarks = [
  {
    title: 'Text',
    count: 10_000,
    optimizedComponent: <_NativeText>Nice text</_NativeText>,
    // @boost-ignore
    unoptimizedComponent: <Text>Nice text</Text>,
  },
];
