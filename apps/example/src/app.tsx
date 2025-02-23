import { StatusBar } from 'expo-status-bar';
import { Button, StyleSheet, Text, View } from 'react-native';
import MeasureComponent from './components/measure-component';
import { useState } from 'react';
import { startMarker } from 'react-native-time-to-render';

export default function App() {
  const [run, setRun] = useState(false);

  const handleStart = (timestamp: number) => {
    if (run) {
      setRun(false);
      return;
    }

    startMarker('test', timestamp);
    setRun(true);
  };

  return (
    <View style={styles.container}>
      <Button title={run ? 'Reset' : 'Run'} onPress={(event) => handleStart(event.nativeEvent.timestamp)} />
      {run && (
        <MeasureComponent markerName="test" title="Test">
          <Text>Hello, World!</Text>
        </MeasureComponent>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
