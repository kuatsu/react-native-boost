import type { SweepConfig } from './schema.ts';

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

/** Fixed local port for the results server. Baked into the benchmark build via env. */
export const DEFAULT_SERVER_PORT = 8099;

/** Repo-relative archive root (committed). */
export const ARCHIVE_DIR = 'benchmarks/results';

/** Where generated SVGs are written (committed). */
export const GRAPHS_DIR = 'benchmarks/graphs';
