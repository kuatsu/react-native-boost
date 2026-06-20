/**
 * Wire contract between the benchmark suite's HTTP server and this self-driving app mode. Kept as a
 * tiny standalone copy (rather than importing the suite's schema) so the Expo app has no build-time
 * dependency on the tooling package — the field names are the contract. Must stay in sync with the
 * matching types in `tooling/benchmark/src/schema.ts` (`BenchmarkPlan`, `FpsMeasurement`, `BoostMode`).
 */

export type BoostMode = 'on' | 'off';

/** The sweep the app pulls from the server on boot. */
export interface BenchmarkPlan {
  loads: number[];
  warmupMs: number;
  captureMs: number;
  tickMs: number;
  boostModes: BoostMode[];
}

/** One captured config the app posts back. */
export interface FpsMeasurement {
  load: number;
  boost: BoostMode;
  avgFps: number;
  p50FrameMs: number;
  p95FrameMs: number;
  droppedPct: number;
  frames: number;
  durationMs: number;
}
