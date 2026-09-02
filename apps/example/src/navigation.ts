import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Launcher: undefined;
  Benchmark: undefined;
  TradingDemo: undefined;
  UnistylesDemo: undefined;
};

export type RootStackScreenProps<RouteName extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  RouteName
>;
