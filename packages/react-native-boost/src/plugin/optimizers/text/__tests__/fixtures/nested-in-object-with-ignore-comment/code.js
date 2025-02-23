import { Text } from 'react-native';
const benchmarks = [
  {
    title: 'Text',
    count: 10_000,
    optimizedComponent: <Text>Nice text</Text>,
    // @boost-ignore
    unoptimizedComponent: <Text>Nice text</Text>,
  },
];
