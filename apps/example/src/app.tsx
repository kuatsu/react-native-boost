import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './screens/home';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <HomeScreen />
    </SafeAreaProvider>
  );
}
