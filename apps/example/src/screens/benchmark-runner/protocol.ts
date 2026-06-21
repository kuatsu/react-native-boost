/**
 * Wire contract between the benchmark suite's HTTP server and this self-driving app mode. Kept as a
 * tiny standalone copy (rather than importing the suite's schema) so the Expo app has no build-time
 * dependency on the tooling package — the field names are the contract. Must stay in sync with the
 * matching types in `tooling/benchmark/src/schema.ts` (`BenchmarkPlan`, `FpsSample`, `BoostMode`).
 *
 * Note: the build-flag `profile` is deliberately NOT on the wire. The flag is baked into this bundle, so
 * the host knows which profile is running and stamps it onto each sample on receipt — the app never
 * sends it. The app does echo its baked flags on the plan request for the staleness handshake.
 */

export type BoostMode = 'on' | 'off';

/** Device thermal state at capture time, recorded with every sample so the host can gate/validate on it. */
export type ThermalLevel = 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';

/** Load visitation order across replicate passes (decorrelates load from elapsed time). */
export type OrderMode = 'ascending' | 'palindrome' | 'shuffle';

/** The sweep the app pulls from the server on boot. */
export interface BenchmarkPlan {
  loads: number[];
  warmupMs: number;
  captureMs: number;
  tickMs: number;
  boostModes: BoostMode[];
  /** Cool the device to ≤ this thermal level before each capture (bounded by thermalMaxWaitMs). */
  thermalFloor: ThermalLevel;
  thermalMaxWaitMs: number;
  thermalPollMs: number;
  /** How many times to measure each (boost, load) cell. */
  replicates: number;
  /** Order to visit loads in across replicate passes. */
  order: OrderMode;
  /** Seed for the 'shuffle' order's PRNG. */
  seed: number;
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
  /** Thermal state at the start / end of the capture window — the heat the sample was taken under. */
  thermalStart: ThermalLevel;
  thermalEnd: ThermalLevel;
  /** Which replicate of this (boost, load) cell this is (0-based). */
  replicate: number;
}
