import { FpsMeasurement } from './protocol';

const average = (values: number[]): number => {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
};

const percentile = (sortedAscending: number[], fraction: number): number => {
  if (sortedAscending.length === 0) return 0;
  const index = Math.min(sortedAscending.length - 1, Math.floor(fraction * sortedAscending.length));
  return sortedAscending[index];
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Reduce a window of per-frame deltas (ms) into the FPS metrics the suite archives. A frame counts as
 * dropped when it overruns ~1.9× the target budget — the same threshold the on-screen FPS overlay uses.
 */
export function summarize(
  deltas: number[],
  tickMs: number
): Omit<FpsMeasurement, 'load' | 'boost' | 'thermalStart' | 'thermalEnd' | 'replicate'> {
  // A capture with no frames means the app stalled completely — report 0 fps, not 1000.
  if (deltas.length === 0) {
    return { avgFps: 0, p50FrameMs: 0, p95FrameMs: 0, droppedPct: 0, frames: 0, durationMs: 0 };
  }
  const sorted = [...deltas].sort((a, b) => a - b);
  const dropThreshold = tickMs * 1.9;
  let dropped = 0;
  let total = 0;
  for (const delta of deltas) {
    total += delta;
    if (delta > dropThreshold) dropped += 1;
  }
  return {
    avgFps: round1(1000 / (average(deltas) || 1)),
    p50FrameMs: round1(percentile(sorted, 0.5)),
    p95FrameMs: round1(percentile(sorted, 0.95)),
    droppedPct: round1((dropped / Math.max(1, deltas.length)) * 100),
    frames: deltas.length,
    durationMs: Math.round(total),
  };
}
