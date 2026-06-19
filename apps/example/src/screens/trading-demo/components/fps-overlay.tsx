import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface CaptureSummary {
  avgFps: number;
  p50Ms: number;
  p95Ms: number;
  dropped: number;
  frames: number;
}

const DISPLAY_INTERVAL_MS = 250;
const CAPTURE_DURATION_MS = 5000;
const FRAME_BUDGET_MS = 1000 / 60;
const DROP_THRESHOLD_MS = FRAME_BUDGET_MS * 1.9;

const percentile = (sortedAscending: number[], fraction: number): number => {
  if (sortedAscending.length === 0) return 0;
  const index = Math.min(sortedAscending.length - 1, Math.floor(fraction * sortedAscending.length));
  return sortedAscending[index];
};

const average = (values: number[]): number => {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
};

export function FpsOverlay() {
  const [fps, setFps] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [summary, setSummary] = useState<CaptureSummary | null>(null);

  const lastFrameRef = useRef<number | null>(null);
  const lastDisplayRef = useRef(0);
  const recentRef = useRef<number[]>([]);
  const captureRef = useRef<number[] | null>(null);

  useEffect(() => {
    let frameHandle = requestAnimationFrame(function loop(time: number): void {
      const previous = lastFrameRef.current;
      lastFrameRef.current = time;
      if (previous !== null) {
        const delta = time - previous;
        const recent = recentRef.current;
        recent.push(delta);
        if (recent.length > 20) recent.shift();
        if (captureRef.current !== null) captureRef.current.push(delta);
        if (time - lastDisplayRef.current >= DISPLAY_INTERVAL_MS) {
          lastDisplayRef.current = time;
          setFps(Math.round(1000 / average(recent)));
        }
      }
      frameHandle = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frameHandle);
  }, []);

  const handleCapture = (): void => {
    if (capturing) return;
    captureRef.current = [];
    setSummary(null);
    setCapturing(true);
    setTimeout(() => {
      const deltas = captureRef.current ?? [];
      captureRef.current = null;
      setCapturing(false);
      if (deltas.length === 0) return;
      const sorted = [...deltas].sort((a, b) => a - b);
      let dropped = 0;
      for (const delta of deltas) {
        if (delta > DROP_THRESHOLD_MS) dropped += 1;
      }
      setSummary({
        avgFps: Math.round(1000 / average(deltas)),
        p50Ms: Math.round(percentile(sorted, 0.5) * 10) / 10,
        p95Ms: Math.round(percentile(sorted, 0.95) * 10) / 10,
        dropped,
        frames: deltas.length,
      });
    }, CAPTURE_DURATION_MS);
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.badge}>
        <Text style={styles.fpsValue}>{fps}</Text>
        <Text style={styles.fpsUnit}>FPS</Text>
      </View>
      <Pressable style={styles.capture} onPress={handleCapture} disabled={capturing}>
        <Text style={styles.captureText}>{capturing ? 'Capturing…' : 'Capture 5s'}</Text>
      </Pressable>
      {summary ? (
        <View style={styles.summary}>
          <Text style={styles.summaryLine}>
            avg {summary.avgFps} fps · {summary.frames}f
          </Text>
          <Text style={styles.summaryLine}>
            p50 {summary.p50Ms}ms · p95 {summary.p95Ms}ms
          </Text>
          <Text style={styles.summaryLine}>dropped {summary.dropped}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    right: 8,
    alignItems: 'flex-end',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(8, 11, 15, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a3139',
  },
  fpsValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0ecb81',
    fontVariant: ['tabular-nums'],
  },
  fpsUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6c7480',
    marginLeft: 4,
  },
  capture: {
    marginTop: 6,
    backgroundColor: '#1f2630',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  captureText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#eaecef',
  },
  summary: {
    marginTop: 6,
    backgroundColor: 'rgba(8, 11, 15, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  summaryLine: {
    fontSize: 11,
    color: '#b7bdc6',
    fontVariant: ['tabular-nums'],
  },
});
