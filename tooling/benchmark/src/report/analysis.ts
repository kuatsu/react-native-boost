/**
 * Pure FPS-report math (no IO), unit-tested in isolation. Two regimes:
 *
 * - **Thermal runs** (the current methodology): one build, both profiles relaunched seconds apart and every
 *   capture gated to a fixed thermal floor, so `default_off` and `core_off` are directly comparable. Gains
 *   are direct ratios of replicate medians, and `validate` turns the old cross-build anchor into a pass/fail
 *   sanity check (the flag-invariant Boost curves must agree; samples must be at the floor).
 * - **Legacy runs** (pre-thermal archives): two separate builds captured minutes apart, so absolute FPS
 *   isn't directly comparable. The flag-invariant Boost curve is the per-load reference that `anchoredCore`
 *   uses to lift the core build onto the baseline build's axis. Kept unchanged so old reports stay identical.
 *
 * `isThermalRun` selects the regime; the report renders accordingly.
 */

import type { BoostMode, FpsMeasurement, FpsResult, ProfileId, ThermalLevel } from '../schema.ts';

/** Heat ordering for thermal levels; `unknown` ranks below `nominal` so it never reads as "the worst
 *  observed" in the informational report note (gating treats unknown as hot — that lives in the runner). */
const THERMAL_RANK: Record<ThermalLevel, number> = { unknown: -1, nominal: 0, fair: 1, serious: 2, critical: 3 };

/** The hottest thermal level any sample observed, or `null` when none carried a known level (legacy runs
 *  predate the thermal signal) — callers suppress the thermal note in that case. */
export function worstThermalLevel(result: FpsResult): ThermalLevel | null {
  let worst: ThermalLevel | null = null;
  let worstRank = -1;
  const consider = (level: ThermalLevel): void => {
    if (THERMAL_RANK[level] > worstRank) {
      worstRank = THERMAL_RANK[level];
      worst = level;
    }
  };
  for (const m of result.measurements) {
    consider(m.thermalStart);
    consider(m.thermalEnd);
  }
  return worst;
}

/** Boost curves should match across the two builds; a per-load divergence beyond this marks the run
 *  anchor-suspect (thermal drift the anchor can't be trusted to correct). */
export const ANCHOR_DIVERGENCE_TOLERANCE = 0.08;

export const gainPct = (off: number, on: number): number => (off === 0 ? 0 : ((on - off) / off) * 100);

/** Linear-interpolated quantile of an already-ascending-sorted array. */
function quantile(sortedAscending: number[], q: number): number {
  if (sortedAscending.length === 0) return 0;
  const position = (sortedAscending.length - 1) * q;
  const lower = Math.floor(position);
  const upper = sortedAscending[lower + 1];
  return upper === undefined
    ? sortedAscending[lower]
    : sortedAscending[lower] + (position - lower) * (upper - sortedAscending[lower]);
}

export function median(values: number[]): number {
  return quantile(
    [...values].sort((a, b) => a - b),
    0.5
  );
}

/** One (profile, boost, load) cell reduced over its replicates: the median FPS plus a dispersion band. */
export interface AggregatedPoint {
  load: number;
  profile: ProfileId;
  boost: BoostMode;
  /** Median avgFps over the cell's replicates. */
  fps: number;
  /** Interquartile range (p75 − p25) of avgFps — the error band the report draws. */
  iqr: number;
  /** How many replicate samples fed this cell. */
  samples: number;
}

/** Reduce raw replicated measurements to one point per (profile, boost, load), median + IQR over replicates. */
export function aggregate(result: FpsResult): AggregatedPoint[] {
  const groups = new Map<string, FpsMeasurement[]>();
  for (const measurement of result.measurements) {
    const key = `${measurement.profile}|${measurement.boost}|${measurement.load}`;
    const list = groups.get(key);
    if (list) list.push(measurement);
    else groups.set(key, [measurement]);
  }
  const points: AggregatedPoint[] = [];
  for (const list of groups.values()) {
    const sortedFps = list.map((m) => m.avgFps).sort((a, b) => a - b);
    const { load, profile, boost } = list[0];
    points.push({
      load,
      profile,
      boost,
      fps: quantile(sortedFps, 0.5),
      iqr: quantile(sortedFps, 0.75) - quantile(sortedFps, 0.25),
      samples: list.length,
    });
  }
  return points.sort((a, b) => a.load - b.load);
}

export function loadsOf(result: FpsResult): number[] {
  return [...new Set(result.measurements.map((m) => m.load))].sort((a, b) => a - b);
}

export function hasProfile(result: FpsResult, profile: ProfileId): boolean {
  return result.measurements.some((m) => m.profile === profile);
}

/** Median avgFps for a (profile, boost, load) cell over its replicates (a single-replicate cell = that
 *  value, so legacy runs are unchanged); 0 if the cell wasn't measured. */
export function fpsAt(result: FpsResult, load: number, profile: ProfileId, boost: BoostMode): number {
  const matches = result.measurements.filter((m) => m.load === load && m.profile === profile && m.boost === boost);
  return matches.length === 0 ? 0 : median(matches.map((m) => m.avgFps));
}

/** One load's three comparable FPS values, with the core build anchored onto the baseline build's axis. */
export interface AnchoredPoint {
  load: number;
  /** Stock-RN baseline (build 1, boost off). */
  baseline: number;
  /** react-native-boost (build 1, boost on) — the flag-invariant reference curve. */
  boost: number;
  /** Core build's baseline (build 2, boost off), lifted onto build 1's axis by the anchor. */
  baselineOptimized: number;
  /** boost(build 1) / boost(build 2) — ≈ 1; corrects thermal drift between the two builds. */
  anchor: number;
  /** |anchor − 1| — how far the two supposedly-identical boost curves drifted apart. */
  anchorDivergence: number;
}

/** The anchored three-series points, or `undefined` unless the result holds BOTH the `default` and `core`
 *  profiles (a single-profile run can't be anchored — it renders as a classic two-series chart instead). */
export function anchoredCore(result: FpsResult): AnchoredPoint[] | undefined {
  if (!hasProfile(result, 'core') || !hasProfile(result, 'default')) return undefined;
  return loadsOf(result).map((load) => {
    const baseline = fpsAt(result, load, 'default', 'off');
    const boost = fpsAt(result, load, 'default', 'on');
    const boostCore = fpsAt(result, load, 'core', 'on');
    const coreOff = fpsAt(result, load, 'core', 'off');
    const anchor = boostCore === 0 ? 1 : boost / boostCore;
    return {
      load,
      baseline,
      boost,
      baselineOptimized: coreOff * anchor,
      anchor,
      anchorDivergence: Math.abs(anchor - 1),
    };
  });
}

// ── Thermal-run regime: direct gains at a common floor + a pass/fail validator ──────────────────────────

/** FPS within this margin of the detected refresh ceiling carries no signal → that load is "clamped"
 *  (matches the runner's budget-focus threshold). */
const CLAMP_EPSILON_FPS = 2;

/** The thermal floor a published run is validated against (the default the runner gates to). */
const VALIDATION_FLOOR: ThermalLevel = 'fair';

/** Replicate dispersion (IQR as a fraction of the cell's median) above this marks a cell too noisy to trust. */
const MAX_RELATIVE_IQR = 0.2;

/** Whether this run carries the thermal signal (so it was gated + replicated → direct gains + validation),
 *  vs a legacy pre-thermal archive (→ the cross-build anchor). */
export function isThermalRun(result: FpsResult): boolean {
  return worstThermalLevel(result) !== null;
}

/** One load's three directly-comparable median FPS values (single build, gated to a common floor), with
 *  dispersion bands and whether the load is informative (not pinned at the refresh ceiling). */
export interface ConvergencePoint {
  load: number;
  baseline: number;
  boost: number;
  baselineOptimized: number;
  baselineIqr: number;
  boostIqr: number;
  baselineOptimizedIqr: number;
  /** False when every condition pins at the refresh ceiling (no FPS signal to compare). */
  informative: boolean;
}

/** Direct three-series points for a thermal run (no anchor), or `undefined` unless it holds BOTH profiles. */
export function convergencePoints(result: FpsResult): ConvergencePoint[] | undefined {
  if (!hasProfile(result, 'core') || !hasProfile(result, 'default')) return undefined;
  const cells = aggregate(result);
  const ceiling = cells.length === 0 ? 0 : Math.max(...cells.map((c) => c.fps));
  const cellAt = (load: number, profile: ProfileId, boost: BoostMode): AggregatedPoint | undefined =>
    cells.find((c) => c.load === load && c.profile === profile && c.boost === boost);
  return loadsOf(result).map((load) => {
    const baseline = cellAt(load, 'default', 'off');
    const boost = cellAt(load, 'default', 'on');
    const coreOff = cellAt(load, 'core', 'off');
    const baselineFps = baseline?.fps ?? 0;
    return {
      load,
      baseline: baselineFps,
      boost: boost?.fps ?? 0,
      baselineOptimized: coreOff?.fps ?? 0,
      baselineIqr: baseline?.iqr ?? 0,
      boostIqr: boost?.iqr ?? 0,
      baselineOptimizedIqr: coreOff?.iqr ?? 0,
      informative: baselineFps > 0 && baselineFps < ceiling - CLAMP_EPSILON_FPS,
    };
  });
}

/** Whether a thermalEnd reading is at-or-below the validation floor (a knowable level — `unknown` fails,
 *  since we can't confirm it). */
function isFloorValid(level: ThermalLevel): boolean {
  return level !== 'unknown' && THERMAL_RANK[level] <= THERMAL_RANK[VALIDATION_FLOOR];
}

/** Per-load verdict that replaces the old anchor correction for thermal runs. The core-optimized comparison
 *  at a load is trustworthy only if every capture there was at the floor, the flag-invariant Boost curves
 *  agree, and replicate spread is tight; loads that fail are dropped from the core series (Boost-vs-baseline
 *  is robust and always shown). A noisy device taints individual transition loads, not the whole run. */
export interface ValidationReport {
  /** Loads whose core comparison isn't trustworthy → core dropped there, each with its reason(s). */
  invalidLoads: Map<number, string[]>;
  /** True when every load's core comparison passed. */
  allValid: boolean;
}

export function validate(result: FpsResult): ValidationReport {
  const invalidLoads = new Map<number, string[]>();
  const reject = (load: number, reason: string): void => {
    const reasons = invalidLoads.get(load);
    if (reasons) reasons.push(reason);
    else invalidLoads.set(load, [reason]);
  };

  // (a) thermal — a load whose hottest end-of-capture level breached the floor.
  const worstBreach = new Map<number, ThermalLevel>();
  for (const m of result.measurements) {
    if (
      !isFloorValid(m.thermalEnd) &&
      THERMAL_RANK[m.thermalEnd] > THERMAL_RANK[worstBreach.get(m.load) ?? 'unknown']
    ) {
      worstBreach.set(m.load, m.thermalEnd);
    }
  }
  for (const [load, level] of [...worstBreach.entries()].sort((a, b) => a[0] - b[0])) {
    reject(load, `captured at ${level} (> floor ${VALIDATION_FLOOR})`);
  }

  // (b) the flag-invariant Boost curves disagree at an informative load.
  const points = convergencePoints(result);
  if (points) {
    for (const p of points) {
      if (!p.informative) continue;
      const coreBoost = fpsAt(result, p.load, 'core', 'on');
      if (coreBoost === 0 || p.boost === 0) continue;
      const divergence = Math.abs(p.boost / coreBoost - 1);
      if (divergence > ANCHOR_DIVERGENCE_TOLERANCE) {
        reject(
          p.load,
          `Boost curves diverge ${(divergence * 100).toFixed(1)}% (> ${(ANCHOR_DIVERGENCE_TOLERANCE * 100).toFixed(0)}%)`
        );
      }
    }
  }

  // (c) a cell feeding the load's comparison has wide replicate spread.
  for (const cell of aggregate(result)) {
    if (cell.samples > 1 && cell.fps > 0 && cell.iqr / cell.fps > MAX_RELATIVE_IQR) {
      reject(
        cell.load,
        `${cell.profile}/${cell.boost} replicate IQR ${((cell.iqr / cell.fps) * 100).toFixed(0)}% of median`
      );
    }
  }

  return { invalidLoads, allValid: invalidLoads.size === 0 };
}

/** Whether the core-optimized comparison at `load` is trustworthy (per-load validity). */
export function coreValidAt(report: ValidationReport, load: number): boolean {
  return !report.invalidLoads.has(load);
}

// ── Headline gains (regime-aware) ───────────────────────────────────────────────────────────────────────

/** Boost-vs-baseline FPS gain (%) at the heaviest load — the headline number. */
export function peakBoostGain(result: FpsResult): number | undefined {
  const loads = loadsOf(result);
  if (loads.length === 0) return undefined;
  const load = Math.max(...loads);
  return gainPct(fpsAt(result, load, 'default', 'off'), fpsAt(result, load, 'default', 'on'));
}

/** Core-vs-baseline FPS gain (%) at the heaviest load; `undefined` if the run isn't a two-profile run.
 *  Thermal runs use the direct ratio of medians at the heaviest **validated** load (single build, common
 *  floor); legacy runs anchor across the two builds — so old archives keep their existing trend value. */
export function peakCoreGain(result: FpsResult): number | undefined {
  if (!hasProfile(result, 'core') || !hasProfile(result, 'default')) return undefined;
  const loads = loadsOf(result);
  if (loads.length === 0) return undefined;
  if (isThermalRun(result)) {
    const report = validate(result);
    const validLoads = loads.filter((l) => coreValidAt(report, l) && fpsAt(result, l, 'default', 'off') > 0);
    if (validLoads.length === 0) return undefined;
    const load = Math.max(...validLoads);
    return gainPct(fpsAt(result, load, 'default', 'off'), fpsAt(result, load, 'core', 'off'));
  }
  const load = Math.max(...loads);
  const points = anchoredCore(result);
  if (!points || points.length === 0) return undefined;
  const point = points.find((p) => p.load === load);
  if (!point || point.baseline === 0) return undefined;
  return gainPct(point.baseline, point.baselineOptimized);
}

/** Loads whose boost curves diverged past tolerance — the report flags these as anchor-suspect. */
export function anchorWarnings(result: FpsResult): string[] {
  const points = anchoredCore(result);
  if (!points) return [];
  return points
    .filter((p) => p.anchorDivergence > ANCHOR_DIVERGENCE_TOLERANCE)
    .map(
      (p) =>
        `load ${p.load}: the two boost curves diverge ${(p.anchorDivergence * 100).toFixed(1)}% ` +
        `(> ${(ANCHOR_DIVERGENCE_TOLERANCE * 100).toFixed(0)}% tolerance) — anchored core gain is suspect`
    );
}
