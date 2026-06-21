import type { OrderMode, ProfileSpec, SweepConfig, ThermalPolicy } from './schema.ts';

/**
 * Default sweep. Loads are rows rendered per side (each row = 6 churning Text cells): 34→300 spans
 * "barely any work" to "JS thread saturated", so the Boost-on/off curves are pinned together at the
 * low end and diverge at the high end — the honest shape.
 */
export const DEFAULT_SWEEP: SweepConfig = {
  loads: [34, 100, 160, 230, 300],
  warmupMs: 2000,
  captureMs: 5000,
  tickMs: 16,
};

/**
 * The build-flag profiles swept by default. The `core` profile is the **moving target**: it's defined as
 * "stock RN plus whatever RN core currently offers to cut JS-`Text`/`View` wrapper overhead", not a fixed
 * flag. Add flags here as RN ships them — `override` ignores keys absent in older RN, so forcing a
 * not-yet-existing flag is a silent no-op and the archive stays correct across the RN versions it spans
 * (on RN < 0.82 the `core` profile simply equals `baseline`). The exact active set is recorded per run
 * in `context.json` (`coreFlags`) for provenance.
 */
export const BUILD_PROFILES: ProfileSpec[] = [
  { id: 'default', label: 'Baseline', rnFlags: [] },
  { id: 'core', label: 'Core-optimized', rnFlags: ['reduceDefaultPropsInText'] },
];

/**
 * Default thermal gating: cool to `fair` before each capture (not `nominal` — sustained-load tests can't
 * reach it and would stall), wait at most 90s (then capture hot + flag), poll once a second. `fair` sits
 * below the throttle knee on both iOS and Android, so captures at-or-below it are directly comparable.
 */
export const DEFAULT_THERMAL: ThermalPolicy = {
  floor: 'fair',
  maxWaitMs: 90_000,
  pollMs: 1000,
};

/** How many times each (profile, boost, load) cell is measured by default; the report medians over them. */
export const DEFAULT_REPLICATES = 3;

/** Default load visitation order across replicate passes — palindrome averages out a linear time-trend. */
export const DEFAULT_ORDER: OrderMode = 'palindrome';

/** Default PRNG seed for the 'shuffle' order (reproducible runs). */
export const DEFAULT_SEED = 1337;

/** Fixed local port for the results server. Baked into the benchmark build via env. */
export const DEFAULT_SERVER_PORT = 8099;

/** Repo-relative archive root (committed). */
export const ARCHIVE_DIR = 'benchmarks/results';

/** Where generated SVGs are written (committed). */
export const GRAPHS_DIR = 'benchmarks/graphs';
