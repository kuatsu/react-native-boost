import { Text } from 'react-native';

export default function TextBenchmark(props) {
  const optimizedViews = Array.from({ length: props.count }, (_, index) => <Text key={index}>Nice text</Text>);
  const unoptimizedViews = Array.from({ length: props.count }, (_, index) => (
    // @boost-ignore
    <Text key={index}>Nice text</Text>
  ));

  if (props.status === 'pending') return <Text>Pending...</Text>;

  return (
    <View>
      {optimizedViews}
      {unoptimizedViews}
    </View>
  );
}
