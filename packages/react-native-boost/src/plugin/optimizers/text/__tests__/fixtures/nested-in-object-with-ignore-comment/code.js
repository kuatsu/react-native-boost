import { Text, View } from 'react-native';
const benchmarks = [
  {
    title: 'Text',
    count: 10_000,
    optimizedComponent: (
      <View>
        <Text>Nice text</Text>
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
