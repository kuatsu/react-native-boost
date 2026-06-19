import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootStackParamList } from './navigation';
import { coinsById } from './screens/trading-demo/model/coins';
import TradingDemoScreen from './screens/trading-demo';
import LauncherScreen from './screens/launcher';
import BenchmarkScreen from './screens/benchmark';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
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
