/**
 * The JSON contract shared by every stage of the suite (context → collectors → store → report).
 * The archive is keyed by (rnVersion, Boost commit SHA); within a key, results are split per platform.
 * Numbers are only ever comparable within the same `device` and `buildMode` — both are recorded.
 */

export type Platform = 'ios' | 'android';
export type BuildMode = 'release' | 'debug';
export type BoostMode = 'on' | 'off';
export type DeviceKind = 'simulator' | 'emulator' | 'device';

/** Device thermal state a sample was captured under (iOS `ProcessInfo.thermalState` / Android
 *  `PowerManager.currentThermalStatus`). `unknown` = unreadable (e.g. Android < API 29) — treated as hot. */
export type ThermalLevel = 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';

/** Load visitation order across replicate passes — decorrelates load from elapsed time / thermal history.
 *  `palindrome` alternates ascending/descending per pass; `shuffle` permutes each pass with a seed. */
export type OrderMode = 'ascending' | 'palindrome' | 'shuffle';

/**
 * The build-time flag profile a config was captured under — orthogonal to `boost`. `default` is stock
 * RN; `core` bakes the curated set of RN-core overhead-reduction feature flags (see `BUILD_PROFILES`).
 * Unlike `boost` (a per-render twin swap), a profile is a property of the whole build: the flags are
 * read once at RN module-init, so each app process exhibits exactly one profile.
 */
export type ProfileId = 'default' | 'core';

/** A build profile: an id, a display label, and the RN feature flags it forces on at build time. */
export interface ProfileSpec {
  id: ProfileId;
  /** Display label, e.g. 'Baseline' | 'Core-optimized'. */
  label: string;
  /** RN feature flags forced `true` at build time (applied-if-present; absent flags no-op on old RN). */
  rnFlags: string[];
}

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
  /** The exact RN flags the `core` profile baked for this run — provenance for the moving flag set. */
  coreFlags: string[];
}

export interface DeviceInfo {
  platform: Platform;
  kind: DeviceKind;
  name: string;
  osVersion: string;
  /** iOS udid or Android serial. */
  id: string;
}

/**
 * One captured config as it crosses the wire (the app→host POST body), before the host stamps the
 * build profile. The app never sends `profile` — the flag is baked into its bundle, so the host knows
 * which profile is running and stamps it on receipt (see `FpsMeasurement`).
 */
export interface FpsSample {
  load: number;
  boost: BoostMode;
  avgFps: number;
  p50FrameMs: number;
  p95FrameMs: number;
  /** Fraction of frames over ~2× the 16.67ms budget. */
  droppedPct: number;
  frames: number;
  durationMs: number;
  /** Thermal state at the start / end of the capture window — the heat the sample was taken under. */
  thermalStart: ThermalLevel;
  thermalEnd: ThermalLevel;
  /** Which replicate of this (profile, boost, load) cell this is (0-based); the report medians over them. */
  replicate: number;
}

/** One archived config: a wire sample stamped with the build-flag profile it was captured under. */
export interface FpsMeasurement extends FpsSample {
  profile: ProfileId;
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

/** How the runner gates captures on device temperature: cool to `floor` before each capture, but never
 *  wait longer than `maxWaitMs` (then capture at the achieved level and flag it). */
export interface ThermalPolicy {
  /** Only capture once the device is at or below this level (e.g. 'fair'). */
  floor: ThermalLevel;
  /** Max cooldown wait before proceeding anyway (and flagging the over-floor sample). */
  maxWaitMs: number;
  /** Cooldown poll cadence. */
  pollMs: number;
}

/** Plan the app pulls from the server on boot (drives the self-running sweep). */
export interface BenchmarkPlan {
  loads: number[];
  warmupMs: number;
  captureMs: number;
  tickMs: number;
  /** Which Boost modes to run, in order. */
  boostModes: BoostMode[];
  /** Cool to this level before each capture (see ThermalPolicy). */
  thermalFloor: ThermalLevel;
  thermalMaxWaitMs: number;
  thermalPollMs: number;
  /** How many times to measure each (boost, load) cell; the report medians over them. */
  replicates: number;
  /** Order to visit loads in across replicate passes (default 'palindrome'). */
  order: OrderMode;
  /** Seed for the 'shuffle' order's PRNG (reproducible runs). */
  seed: number;
}
