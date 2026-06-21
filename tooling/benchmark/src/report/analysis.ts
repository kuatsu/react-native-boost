/**
 * Pure FPS-report math (no IO) so the cross-build anchor normalization and gain computations can be
 * unit-tested in isolation. See §4.2 of the plan: `baseline` and `baseline-optimized` come from two
 * separate builds captured minutes apart, so their absolute FPS isn't directly comparable. The `boost`
 * curve is flag-invariant (it renders the native host, bypassing the JS `Text` wrapper the flag trims),
 * so per load it's the common reference that stitches the two builds onto one thermal axis.
 */

import type { BoostMode, FpsResult, ProfileId } from '../schema.ts';

/** Boost curves should match across the two builds; a per-load divergence beyond this marks the run
 *  anchor-suspect (thermal drift the anchor can't be trusted to correct). */
export const ANCHOR_DIVERGENCE_TOLERANCE = 0.08;

export const gainPct = (off: number, on: number): number => (off === 0 ? 0 : ((on - off) / off) * 100);

export function loadsOf(result: FpsResult): number[] {
  return [...new Set(result.measurements.map((m) => m.load))].sort((a, b) => a - b);
}

export function hasProfile(result: FpsResult, profile: ProfileId): boolean {
  return result.measurements.some((m) => m.profile === profile);
}

export function fpsAt(result: FpsResult, load: number, profile: ProfileId, boost: BoostMode): number {
  return result.measurements.find((m) => m.load === load && m.profile === profile && m.boost === boost)?.avgFps ?? 0;
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

/** Boost-vs-baseline FPS gain (%) at the heaviest load — the headline number, within build 1. */
export function peakBoostGain(result: FpsResult): number | undefined {
  const loads = loadsOf(result);
  if (loads.length === 0) return undefined;
  const load = Math.max(...loads);
  return gainPct(fpsAt(result, load, 'default', 'off'), fpsAt(result, load, 'default', 'on'));
}

/** Core-vs-baseline FPS gain (%) at the heaviest load, anchored across builds; `undefined` if no core. */
export function peakCoreGain(result: FpsResult): number | undefined {
  const points = anchoredCore(result);
  if (!points || points.length === 0) return undefined;
  const maxLoad = Math.max(...points.map((p) => p.load));
  const point = points.find((p) => p.load === maxLoad);
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
