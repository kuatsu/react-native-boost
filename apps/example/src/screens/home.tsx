import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
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

  const resultRows = useMemo(() => {
    return benchmarks.map((benchmark, index) => {
      const value = results[index];
      const unoptimized = value?.unoptimized ?? null;
      const optimized = value?.optimized ?? null;
      const gainPercent =
        unoptimized === null || optimized === null || unoptimized === 0 ? null : (1 - optimized / unoptimized) * 100;
      const gain = gainPercent === null ? 'N/A' : `${gainPercent.toFixed(2)}%`;

      return {
        title: benchmark.title,
        unoptimizedText: unoptimized === null ? '--' : `${unoptimized}ms`,
        optimizedText: optimized === null ? '--' : `${optimized}ms`,
        gain,
        gainPercent,
      };
    });
  }, [results]);

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
      <View style={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>React Native Boost Benchmark</Text>
          <Text
            style={
              styles.subtitle
            }>{`Step ${progress[0] + 1} / ${progress[1]}: ${benchmarks[currentBenchmark].title} (${currentStep})`}</Text>
        </View>

        <View style={styles.tableCard}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.benchmarkColumn, styles.tableHeaderText]}>Test</Text>
            <Text style={[styles.tableCell, styles.metricColumn, styles.tableHeaderText]}>Unopt.</Text>
            <Text style={[styles.tableCell, styles.metricColumn, styles.tableHeaderText]}>Opt.</Text>
            <Text style={[styles.tableCell, styles.metricColumn, styles.tableHeaderText]}>Gain</Text>
          </View>

          {resultRows.map((row, index) => (
            <View
              key={row.title}
              style={[
                styles.tableRow,
                index % 2 === 0 ? styles.tableStripeLight : styles.tableStripeDark,
                index === currentBenchmark && styles.tableActiveRow,
              ]}>
              <Text style={[styles.tableCell, styles.benchmarkColumn, styles.benchmarkText]}>{row.title}</Text>
              <Text style={[styles.tableCell, styles.metricColumn, styles.metricText]}>{row.unoptimizedText}</Text>
              <Text style={[styles.tableCell, styles.metricColumn, styles.metricText]}>{row.optimizedText}</Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.metricColumn,
                  styles.metricText,
                  row.gainPercent === null
                    ? styles.gainNeutral
                    : row.gainPercent >= 0
                      ? styles.gainPositive
                      : styles.gainNegative,
                ]}>
                {row.gain}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { bottom: insets.bottom + 16 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={(event) => handleRun(event.nativeEvent.timestamp)}
          style={({ pressed }) => [styles.runButton, pressed && styles.runButtonPressed]}>
          <Text style={styles.runButtonText}>{buttonTitle}</Text>
        </Pressable>
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
    backgroundColor: '#fff8ef',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    width: '100%',
    maxWidth: 640,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1d4a3',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#5e3c0c',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#7a4b00',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  runButton: {
    backgroundColor: '#ff9800',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 640,
  },
  runButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },
  runButtonText: {
    color: '#2f1d00',
    fontSize: 15,
    fontWeight: '700',
  },
  tableCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1d4a3',
    backgroundColor: '#ffffff',
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
  },
  tableHeader: {
    backgroundColor: '#fff0d6',
    borderBottomWidth: 1,
    borderBottomColor: '#f1d4a3',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7a4b00',
  },
  tableStripeLight: {
    backgroundColor: '#ffffff',
  },
  tableStripeDark: {
    backgroundColor: '#fffaf2',
  },
  tableActiveRow: {
    backgroundColor: '#ffe8c2',
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  benchmarkColumn: {
    flex: 1.4,
  },
  metricColumn: {
    flex: 1,
    alignItems: 'flex-end',
  },
  benchmarkText: {
    fontSize: 14,
    color: '#4d3311',
    fontWeight: '600',
  },
  metricText: {
    fontSize: 13,
    color: '#6e4c1d',
    textAlign: 'right',
  },
  gainPositive: {
    color: '#0d7a3b',
    fontWeight: '700',
  },
  gainNegative: {
    color: '#b42318',
    fontWeight: '700',
  },
  gainNeutral: {
    color: '#6e4c1d',
  },
});
