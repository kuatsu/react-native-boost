/**
 * The JSON contract shared by every stage of the suite (context → collectors → store → report).
 * The archive is keyed by (rnVersion, Boost commit SHA); within a key, results are split per platform.
 * Numbers are only ever comparable within the same `device` and `buildMode` — both are recorded.
 */

export type Platform = 'ios' | 'android';
export type BuildMode = 'release' | 'debug';
export type BoostMode = 'on' | 'off';
export type DeviceKind = 'simulator' | 'emulator' | 'device';

/** Identifies a run's archive directory: the RN version and the Boost commit SHA benchmarked. */
export interface RunKey {
  rnVersion: string;
  boostSha: string;
}

/** The load axis: rows rendered per side (each row = 6 churning Text cells across both sides). */
export interface SweepConfig {
  /** Rows rendered per side, swept low→high. */
  loads: number[];
  /** Settle time before each capture (ms) — lets render/JIT stabilize. */
  warmupMs: number;
  /** Capture window per config (ms). */
  captureMs: number;
  /** Tick interval driving re-renders (ms); 16 ≈ 60 Hz. */
  tickMs: number;
}

/** Identifies a benchmark run for the archive + provenance. */
export interface BenchContext {
  boostVersion: string;
  rnVersion: string;
  reactVersion: string;
  gitSha: string;
  /** ISO timestamp; passed in (Date.now is avoided inside collectors for determinism). */
  timestamp: string;
  sweep: SweepConfig;
}

export interface DeviceInfo {
  platform: Platform;
  kind: DeviceKind;
  name: string;
  osVersion: string;
  /** iOS udid or Android serial. */
  id: string;
}

/** One captured config: a given load with Boost on or off. */
export interface FpsMeasurement {
  load: number;
  boost: BoostMode;
  avgFps: number;
  p50FrameMs: number;
  p95FrameMs: number;
  /** Fraction of frames over ~2× the 16.67ms budget. */
  droppedPct: number;
  frames: number;
  durationMs: number;
}

export interface FpsResult {
  platform: Platform;
  buildMode: BuildMode;
  device: DeviceInfo;
  measurements: FpsMeasurement[];
}

export interface FiberCount {
  /** All React tree nodes (composite + host) ≈ fibers. */
  fibers: number;
  /** Native host instances only (NativeText/NativeView/...). */
  hosts: number;
}

/** Structural overhead Boost removes at a given load — deterministic, device-free. */
export interface FiberMeasurement {
  load: number;
  on: FiberCount;
  off: FiberCount;
  saved: FiberCount;
}

export interface FiberResult {
  measurements: FiberMeasurement[];
  /** Per-row breakdown for transparency (one rendered row at the smallest load). */
  perRow: { fibersOn: number; fibersOff: number; savedPerRow: number };
}

/** The full archived run for one (rnVersion, Boost commit SHA) key. */
export interface RunResult {
  context: BenchContext;
  fibers?: FiberResult;
  fps: Partial<Record<Platform, FpsResult>>;
}

/** Plan the app pulls from the server on boot (drives the self-running sweep). */
export interface BenchmarkPlan {
  loads: number[];
  warmupMs: number;
  captureMs: number;
  tickMs: number;
  /** Which Boost modes to run, in order. */
  boostModes: BoostMode[];
}
