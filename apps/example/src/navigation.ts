import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Launcher: undefined;
  Benchmark: undefined;
  TradingDemo: { coinId: string };
};

export type RootStackScreenProps<RouteName extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  RouteName
>;
