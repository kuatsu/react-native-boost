import { Button, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [runBenchmark, setRunBenchmark] = useState(false);
  const [results, setResults] = useState<Record<number, { unoptimized: number | null; optimized: number | null }>>({});

  const totalSteps = benchmarks.length * 2;
  const currentBenchmark = useMemo(() => Math.floor(currentStepIndex / 2), [currentStepIndex]);
  const currentStep = useMemo<BenchmarkStep>(
    () => (currentStepIndex % 2 === 0 ? BenchmarkStep.Unoptimized : BenchmarkStep.Optimized),
    [currentStepIndex]
  );

  const progress = useMemo<[number, number]>(() => {
    return [currentStepIndex, totalSteps];
  }, [currentStepIndex, totalSteps]);

  const buttonTitle = useMemo(() => {
    if (currentStepIndex === 0) {
      return 'Start Benchmark';
    }
    if (currentStepIndex === totalSteps - 1) {
      return 'Last Step';
    }
    return 'Next Step';
  }, [currentStepIndex, totalSteps]);

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

    setResults((previousResults) => {
      const baseResults = currentStepIndex === 0 ? {} : previousResults;
      const previousBenchmarkResult = baseResults[currentBenchmark] ?? { unoptimized: null, optimized: null };

      return {
        ...baseResults,
        [currentBenchmark]:
          currentStep === BenchmarkStep.Unoptimized
            ? { unoptimized: renderTime, optimized: null }
            : { ...previousBenchmarkResult, optimized: renderTime },
      };
    });

    setCurrentStepIndex((previousStepIndex) => (previousStepIndex + 1) % totalSteps);
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
                    value.unoptimized === null || value.optimized === null || value.unoptimized === 0
                      ? 'N/A'
                      : `${((1 - value.optimized / value.unoptimized) * 100).toFixed(2)}%`;
                  const unoptimizedText = value.unoptimized === null ? '--' : `${value.unoptimized}ms`;
                  const optimizedText = value.optimized === null ? '--' : `${value.optimized}ms`;

                  return `${benchmarks[index].title}: ${unoptimizedText} -> ${optimizedText} (${percent})`;
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
