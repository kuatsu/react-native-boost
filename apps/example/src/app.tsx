import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootStackParamList } from './navigation';
import { coinsById } from './screens/trading-demo/model/coins';
import TradingDemoScreen from './screens/trading-demo';
import LauncherScreen from './screens/launcher';
import BenchmarkScreen from './screens/benchmark';
import BenchmarkRunner from './screens/benchmark-runner';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  // The benchmark suite launches the app with this flag to run the headless, self-driving FPS sweep.
  if (process.env.EXPO_PUBLIC_BENCHMARK === '1') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <BenchmarkRunner />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={DarkTheme}>
        <Stack.Navigator initialRouteName="Launcher">
          <Stack.Screen name="Launcher" component={LauncherScreen} options={{ title: 'Launcher' }} />
          <Stack.Screen name="Benchmark" component={BenchmarkScreen} options={{ title: 'Benchmark' }} />
          <Stack.Screen
            name="TradingDemo"
            component={TradingDemoScreen}
            options={({ route }) => ({ title: coinsById[route.params.coinId]?.pair ?? 'Price Wall' })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
