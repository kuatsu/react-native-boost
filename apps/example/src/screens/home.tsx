import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { startMarker } from 'react-native-time-to-render';
import { Benchmark, BenchmarkStep } from '../types';
import MeasureComponent from '../components/measure-component';
import { getMarkerName } from '../utils/helpers';

const benchmarks = [
  {
    title: 'Text',
    count: 10_000,
    // @boost-ignore
    unoptimizedComponent: <Text style={{ color: 'red' }}>Nice text</Text>,
    optimizedComponent: <Text style={{ color: 'red' }}>Nice text</Text>,
  },
  {
    title: 'View',
    count: 10_000,
    // @boost-ignore
    unoptimizedComponent: <View style={{ borderWidth: 1, borderColor: 'red' }} />,
    optimizedComponent: <View style={{ borderWidth: 1, borderColor: 'red' }} />,
  },
] satisfies Benchmark[];

export default function HomeScreen() {
  const [currentBenchmark, setCurrentBenchmark] = useState(0);
  const [currentStep, setCurrentStep] = useState<BenchmarkStep>(BenchmarkStep.Unoptimized);
  const [runBenchmark, setRunBenchmark] = useState(false);
  const [results, setResults] = useState<Record<number, { unoptimized: number; optimized: number }>>({});

  const progress = useMemo<[number, number]>(() => {
    const total = benchmarks.length * 2;
    const current = currentBenchmark * 2 + (currentStep === BenchmarkStep.Unoptimized ? 0 : 1);
    return [current, total];
  }, [currentBenchmark, currentStep]);

  const buttonTitle = useMemo(() => {
    if (currentBenchmark === 0 && progress[0] === 0) {
      return 'Start Benchmark';
    }
    if (currentBenchmark === benchmarks.length - 1) {
      return 'Last Step';
    }
    return 'Next Step';
  }, [currentStep, runBenchmark, currentBenchmark, progress]);

  const markerName = useMemo(
    () => getMarkerName(benchmarks[currentBenchmark].title, currentStep),
    [currentBenchmark, currentStep]
  );

  const handleRun = (timestamp: number) => {
    startMarker(markerName, timestamp);
    setRunBenchmark(true);
  };

  const handleRenderTimeChange = (renderTime: number) => {
    setRunBenchmark(false);

    const newResults =
      currentBenchmark === 0 && currentStep === BenchmarkStep.Unoptimized
        ? { [currentBenchmark]: { unoptimized: renderTime, optimized: 0 } }
        : {
            ...results,
            [currentBenchmark]: { ...results[currentBenchmark], [currentStep]: renderTime },
          };
    setResults(newResults);

    if (currentStep === BenchmarkStep.Unoptimized) {
      setCurrentStep(BenchmarkStep.Optimized);
    } else {
      setCurrentStep(BenchmarkStep.Unoptimized);
      if (currentBenchmark < benchmarks.length - 1) {
        setCurrentBenchmark(currentBenchmark + 1);
      } else {
        // All benchmarks have run; restart the cycle.
        setCurrentBenchmark(0);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text>Step {`${progress[0]} / ${progress[1]}`}</Text>
      <Button title={buttonTitle} onPress={(event) => handleRun(event.nativeEvent.timestamp)} />

      {/* Results display below the button */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {Object.keys(results).length > 0
            ? Object.entries(results)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([key, value]) => {
                  const index = Number(key);
                  const percent =
                    value.unoptimized === 0 ? 'N/A' : ((1 - value.optimized / value.unoptimized) * 100).toFixed(2);
                  return `${benchmarks[index].title}: ${value.unoptimized}ms -> ${value.optimized}ms (${percent}%)`;
                })
                .join('\n')
            : ''}
        </Text>
      </View>

      {runBenchmark && (
        <MeasureComponent
          key={markerName}
          onRenderTimeChange={handleRenderTimeChange}
          step={currentStep}
          {...benchmarks[currentBenchmark]}
          markerName={markerName}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
  },
  resultsText: {
    minHeight: benchmarks.length * 16,
    textAlign: 'center',
  },
});
