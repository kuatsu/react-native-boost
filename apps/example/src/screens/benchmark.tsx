import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
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
  {
    title: 'ActivityIndicator',
    count: 2000,
    // @boost-ignore
    unoptimizedComponent: <ActivityIndicator animating={false} />,
    optimizedComponent: <ActivityIndicator animating={false} />,
  },
  {
    title: 'Image',
    count: 2000,
    // @boost-ignore
    unoptimizedComponent: (
      <Image
        source={{
          uri: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
          width: 16,
          height: 16,
        }}
        style={{ width: 16, height: 16 }}
      />
    ),
    optimizedComponent: (
      <Image
        source={{
          uri: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
          width: 16,
          height: 16,
        }}
        style={{ width: 16, height: 16 }}
      />
    ),
  },
] satisfies Benchmark[];

type RunStatus = 'idle' | 'settling' | 'measuring' | 'complete';
type ScheduledStep = { benchmarkIndex: number; step: BenchmarkStep };

const SETTLE_DELAY_MS = 500;

export default function BenchmarkScreen() {
  const insets = useSafeAreaInsets();
  const [selectedBenchmarks, setSelectedBenchmarks] = useState(() => benchmarks.map(() => true));
  const [schedule, setSchedule] = useState<ScheduledStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [results, setResults] = useState<Record<number, { unoptimized: number | null; optimized: number | null }>>({});

  const activeStep = schedule[currentStepIndex];
  const activeBenchmark = activeStep ? benchmarks[activeStep.benchmarkIndex] : undefined;
  const isRunning = runStatus === 'settling' || runStatus === 'measuring';
  const selectedCount = selectedBenchmarks.filter(Boolean).length;
  const markerName = activeStep ? getMarkerName(benchmarks[activeStep.benchmarkIndex].title, activeStep.step) : '';
  const subtitle =
    isRunning && activeStep
      ? `Step ${currentStepIndex + 1} / ${schedule.length}: ${activeBenchmark?.title} (${activeStep.step})`
      : runStatus === 'complete'
        ? 'Benchmark complete'
        : `${selectedCount} of ${benchmarks.length} benchmarks selected`;
  const buttonTitle = isRunning
    ? `Running ${currentStepIndex + 1} / ${schedule.length}`
    : runStatus === 'complete'
      ? 'Run Selected Again'
      : 'Run Selected';

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

  // Let cleanup and result UI work finish before the next measurement starts.
  useEffect(() => {
    if (runStatus !== 'settling' || !activeStep) return;

    let frame: number | undefined;
    const timeout = setTimeout(() => {
      frame = requestAnimationFrame((timestamp) => {
        startMarker(markerName, timestamp);
        setRunStatus('measuring');
      });
    }, SETTLE_DELAY_MS);

    return () => {
      clearTimeout(timeout);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [activeStep, markerName, runStatus]);

  const handleRun = () => {
    const nextSchedule = selectedBenchmarks.flatMap<ScheduledStep>((selected, benchmarkIndex) =>
      selected
        ? [
            { benchmarkIndex, step: BenchmarkStep.Unoptimized },
            { benchmarkIndex, step: BenchmarkStep.Optimized },
          ]
        : []
    );
    if (nextSchedule.length === 0) return;

    setSchedule(nextSchedule);
    setCurrentStepIndex(0);
    setResults({});
    setRunStatus('settling');
  };

  const handleToggleBenchmark = (benchmarkIndex: number) => {
    if (isRunning) return;
    setSelectedBenchmarks((current) =>
      current.map((selected, index) => (index === benchmarkIndex ? !selected : selected))
    );
    if (runStatus === 'complete') setRunStatus('idle');
  };

  const handleRenderTimeChange = (renderTime: number) => {
    if (!activeStep) return;

    setResults((previousResults) => {
      const previousBenchmarkResult = previousResults[activeStep.benchmarkIndex] ?? {
        unoptimized: null,
        optimized: null,
      };

      return {
        ...previousResults,
        [activeStep.benchmarkIndex]:
          activeStep.step === BenchmarkStep.Unoptimized
            ? { unoptimized: renderTime, optimized: null }
            : { ...previousBenchmarkResult, optimized: renderTime },
      };
    });

    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex < schedule.length) {
      setCurrentStepIndex(nextStepIndex);
      setRunStatus('settling');
    } else {
      setRunStatus('complete');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>React Native Boost Benchmark</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
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
                isRunning && index === activeStep?.benchmarkIndex && styles.tableActiveRow,
                !selectedBenchmarks[index] && styles.tableRowDisabled,
              ]}>
              <Pressable
                accessibilityLabel={`${row.title} benchmark`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedBenchmarks[index], disabled: isRunning }}
                disabled={isRunning}
                hitSlop={8}
                onPress={() => handleToggleBenchmark(index)}
                style={[styles.tableCell, styles.benchmarkColumn, styles.benchmarkSelector]}>
                <View style={[styles.checkbox, selectedBenchmarks[index] && styles.checkboxSelected]}>
                  {selectedBenchmarks[index] && <View style={styles.checkboxMark} />}
                </View>
                <Text style={styles.benchmarkText}>{row.title}</Text>
              </Pressable>
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
          accessibilityState={{ disabled: isRunning || selectedCount === 0 }}
          disabled={isRunning || selectedCount === 0}
          onPress={handleRun}
          style={({ pressed }) => [
            styles.runButton,
            (isRunning || selectedCount === 0) && styles.runButtonDisabled,
            pressed && styles.runButtonPressed,
          ]}>
          <Text style={styles.runButtonText}>{buttonTitle}</Text>
        </Pressable>
      </View>

      {runStatus === 'measuring' && activeStep && activeBenchmark && (
        <MeasureComponent
          key={`${markerName}-${currentStepIndex}`}
          onRenderTimeChange={handleRenderTimeChange}
          step={activeStep.step}
          {...activeBenchmark}
          markerName={markerName}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0e11',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    width: '100%',
    maxWidth: 640,
  },
  headerCard: {
    backgroundColor: '#141b22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3139',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#eaecef',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#9aa3ad',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  runButton: {
    backgroundColor: '#f0b90b',
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
  runButtonDisabled: {
    opacity: 0.5,
  },
  runButtonText: {
    color: '#0b0e11',
    fontSize: 15,
    fontWeight: '700',
  },
  tableCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a3139',
    backgroundColor: '#12161c',
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
    backgroundColor: '#1b2330',
    borderBottomWidth: 1,
    borderBottomColor: '#2a3139',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c7480',
  },
  tableStripeLight: {
    backgroundColor: '#12161c',
  },
  tableStripeDark: {
    backgroundColor: '#161c24',
  },
  tableActiveRow: {
    backgroundColor: '#1f2a36',
  },
  tableRowDisabled: {
    opacity: 0.45,
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
  benchmarkSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#6c7480',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#f0b90b',
    borderColor: '#f0b90b',
  },
  checkboxMark: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#0b0e11',
  },
  benchmarkText: {
    fontSize: 14,
    color: '#eaecef',
    fontWeight: '600',
  },
  metricText: {
    fontSize: 13,
    color: '#9aa3ad',
    textAlign: 'right',
  },
  gainPositive: {
    color: '#0ecb81',
    fontWeight: '700',
  },
  gainNegative: {
    color: '#f6465d',
    fontWeight: '700',
  },
  gainNeutral: {
    color: '#6c7480',
  },
});
