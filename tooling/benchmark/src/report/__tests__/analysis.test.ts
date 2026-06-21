import { describe, expect, it } from 'vitest';
import type { BoostMode, FpsMeasurement, FpsResult, ProfileId, ThermalLevel } from '../../schema.ts';
import {
  aggregate,
  anchoredCore,
  anchorWarnings,
  convergencePoints,
  coreValidAt,
  fpsAt,
  hasProfile,
  isThermalRun,
  median,
  peakBoostGain,
  peakCoreGain,
  validate,
} from '../analysis.ts';

/** Build a measurement; load/profile/boost/avgFps/replicate/thermal matter to the math under test. A run
 *  whose samples are all `thermal: 'unknown'` is treated as legacy (anchor regime). */
const m = (
  load: number,
  profile: ProfileId,
  boost: BoostMode,
  avgFps: number,
  replicate = 0,
  thermal: ThermalLevel = 'nominal'
): FpsMeasurement => ({
  load,
  profile,
  boost,
  avgFps,
  p50FrameMs: 0,
  p95FrameMs: 0,
  droppedPct: 0,
  frames: 0,
  durationMs: 0,
  thermalStart: thermal,
  thermalEnd: thermal,
  replicate,
});

const result = (measurements: FpsMeasurement[]): FpsResult => ({
  platform: 'ios',
  buildMode: 'release',
  device: { platform: 'ios', kind: 'simulator', name: 'iPhone', osVersion: '18.0', id: 'x' },
  measurements,
});

/** A two-profile result at one load. `coreScale` slows the whole core build by a factor (thermal drift)
 *  that the anchor should divide back out. baseline=40, boost=60, true core baseline=50. */
const twoProfile = (coreScale: number): FpsResult =>
  result([
    m(100, 'default', 'off', 40),
    m(100, 'default', 'on', 60),
    m(100, 'core', 'off', 50 / coreScale),
    m(100, 'core', 'on', 60 / coreScale),
  ]);

describe('anchoredCore', () => {
  it('is undefined without both profiles (single-profile / legacy run)', () => {
    const legacy = result([m(100, 'default', 'off', 40), m(100, 'default', 'on', 60)]);
    expect(hasProfile(legacy, 'core')).toBe(false);
    expect(anchoredCore(legacy)).toBeUndefined();
    expect(peakCoreGain(legacy)).toBeUndefined();
    expect(peakBoostGain(legacy)).toBeCloseTo(50); // (60-40)/40
  });

  it('matched boost curves → anchor is a no-op', () => {
    const points = anchoredCore(twoProfile(1))!;
    expect(points).toHaveLength(1);
    expect(points[0].anchor).toBeCloseTo(1);
    expect(points[0].anchorDivergence).toBeCloseTo(0);
    expect(points[0].baselineOptimized).toBeCloseTo(50);
  });

  it('thermal drift within tolerance → anchor recovers the true core baseline', () => {
    const points = anchoredCore(twoProfile(1.05))!; // core build ran 5% slower
    expect(points[0].anchor).toBeCloseTo(1.05);
    expect(points[0].anchorDivergence).toBeCloseTo(0.05);
    expect(points[0].baselineOptimized).toBeCloseTo(50); // drift divided back out
    expect(anchorWarnings(twoProfile(1.05))).toHaveLength(0);
  });

  it('drift beyond 8% tolerance is flagged anchor-suspect', () => {
    const warnings = anchorWarnings(twoProfile(1.15)); // 15% slower core build
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('load 100');
  });
});

describe('median', () => {
  it('handles odd and even counts and empty input', () => {
    expect(median([3, 1, 2])).toBeCloseTo(2);
    expect(median([1, 2, 3, 4])).toBeCloseTo(2.5);
    expect(median([])).toBe(0);
  });
});

describe('aggregate', () => {
  it('medians avgFps over replicates per cell with IQR + sample count', () => {
    const points = aggregate(
      result([
        m(100, 'default', 'off', 40, 0),
        m(100, 'default', 'off', 44, 1),
        m(100, 'default', 'off', 42, 2),
        m(100, 'default', 'on', 60, 0),
      ])
    );
    const off = points.find((p) => p.boost === 'off')!;
    expect(off.fps).toBeCloseTo(42); // median of 40,42,44
    expect(off.iqr).toBeCloseTo(2); // p75−p25 of [40,42,44] = 43−41
    expect(off.samples).toBe(3);
    const on = points.find((p) => p.boost === 'on')!;
    expect(on.fps).toBeCloseTo(60);
    expect(on.samples).toBe(1);
  });
});

describe('fpsAt', () => {
  it('medians a cell over its replicates', () => {
    const r = result([m(100, 'default', 'off', 40, 0), m(100, 'default', 'off', 50, 1)]);
    expect(fpsAt(r, 100, 'default', 'off')).toBeCloseTo(45);
  });
});

describe('peak gains', () => {
  it('use the heaviest load and anchor the core gain across builds', () => {
    const r = result([
      m(100, 'default', 'off', 50),
      m(100, 'default', 'on', 58),
      m(100, 'core', 'off', 52),
      m(100, 'core', 'on', 58),
      m(300, 'default', 'off', 30),
      m(300, 'default', 'on', 60),
      m(300, 'core', 'off', 42),
      m(300, 'core', 'on', 60),
    ]);
    expect(peakBoostGain(r)).toBeCloseTo(100); // (60-30)/30 at load 300
    expect(peakCoreGain(r)).toBeCloseTo(40); // (42-30)/30 — direct (thermal run), anchor would also be 1
  });
});

describe('regime: thermal (direct) vs legacy (anchor)', () => {
  it('thermal run → direct core gain at the heaviest validated load (agreeing Boost curves)', () => {
    const r = result([
      m(300, 'default', 'off', 30, 0, 'nominal'),
      m(300, 'default', 'on', 60, 0, 'nominal'),
      m(300, 'core', 'off', 42, 0, 'nominal'),
      m(300, 'core', 'on', 60, 0, 'nominal'), // agrees with default_on → load 300 is validated
    ]);
    expect(isThermalRun(r)).toBe(true);
    expect(peakCoreGain(r)).toBeCloseTo(40); // (42-30)/30 direct, no anchor
  });

  it('legacy run (all-unknown thermal) → anchored core gain', () => {
    const r = result([
      m(300, 'default', 'off', 30, 0, 'unknown'),
      m(300, 'default', 'on', 60, 0, 'unknown'),
      m(300, 'core', 'off', 42, 0, 'unknown'),
      m(300, 'core', 'on', 50, 0, 'unknown'), // anchor ×60/50=1.2 → 42 lifts to 50.4 → +68%
    ]);
    expect(isThermalRun(r)).toBe(false);
    expect(peakCoreGain(r)).toBeCloseTo(68);
  });
});

describe('convergencePoints', () => {
  it('uses direct core_off (no anchor) and flags clamped loads as not informative', () => {
    const r = result([
      m(10, 'default', 'off', 60),
      m(10, 'default', 'on', 60),
      m(10, 'core', 'off', 60),
      m(10, 'core', 'on', 60),
      m(100, 'default', 'off', 40),
      m(100, 'default', 'on', 60),
      m(100, 'core', 'off', 44),
      m(100, 'core', 'on', 60),
    ]);
    const points = convergencePoints(r)!;
    const heavy = points.find((p) => p.load === 100)!;
    expect(heavy.baselineOptimized).toBeCloseTo(44); // direct median, not anchored
    expect(heavy.informative).toBe(true);
    expect(points.find((p) => p.load === 10)!.informative).toBe(false); // pinned at ceiling
  });
});

describe('validate (per-load)', () => {
  it('passes every load when at floor, Boost curves agree, and replicates are tight', () => {
    const report = validate(
      result([
        m(100, 'default', 'off', 40),
        m(100, 'default', 'on', 60),
        m(100, 'core', 'off', 44),
        m(100, 'core', 'on', 60),
      ])
    );
    expect(report.allValid).toBe(true);
    expect(report.invalidLoads.size).toBe(0);
  });

  it('drops a load with a capture above the floor', () => {
    const report = validate(
      result([
        m(100, 'default', 'off', 40),
        m(100, 'default', 'on', 60),
        m(100, 'core', 'off', 44),
        m(100, 'core', 'on', 60, 0, 'serious'),
      ])
    );
    expect(report.allValid).toBe(false);
    expect(coreValidAt(report, 100)).toBe(false);
  });

  it('drops a load where the flag-invariant Boost curves diverge', () => {
    const report = validate(
      result([
        m(100, 'default', 'off', 40),
        m(100, 'default', 'on', 60),
        m(100, 'core', 'off', 44),
        m(100, 'core', 'on', 50), // 60 vs 50 → 20% > 8% tolerance
      ])
    );
    expect(coreValidAt(report, 100)).toBe(false);
  });

  it('drops a load with wide replicate spread', () => {
    const report = validate(
      result([
        m(100, 'default', 'off', 35, 0),
        m(100, 'default', 'off', 65, 1), // median 50, IQR 15 → 30% of median > 20%
        m(100, 'default', 'on', 60),
        m(100, 'core', 'off', 44),
        m(100, 'core', 'on', 60),
      ])
    );
    expect(coreValidAt(report, 100)).toBe(false);
  });

  it('validates loads independently — one bad load does not taint the rest', () => {
    const report = validate(
      result([
        // load 100 — clean
        m(100, 'default', 'off', 40),
        m(100, 'default', 'on', 60),
        m(100, 'core', 'off', 44),
        m(100, 'core', 'on', 60),
        // load 200 — Boost curves diverge (60 vs 45 → 33%)
        m(200, 'default', 'off', 30),
        m(200, 'default', 'on', 60),
        m(200, 'core', 'off', 33),
        m(200, 'core', 'on', 45),
      ])
    );
    expect(report.allValid).toBe(false);
    expect(coreValidAt(report, 100)).toBe(true);
    expect(coreValidAt(report, 200)).toBe(false);
  });
});
