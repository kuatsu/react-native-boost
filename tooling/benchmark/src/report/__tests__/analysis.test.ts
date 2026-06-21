import { describe, expect, it } from 'vitest';
import type { BoostMode, FpsMeasurement, FpsResult, ProfileId } from '../../schema.ts';
import { anchoredCore, anchorWarnings, hasProfile, peakBoostGain, peakCoreGain } from '../analysis.ts';

/** Build a measurement; only load/profile/boost/avgFps matter to the math under test. */
const m = (load: number, profile: ProfileId, boost: BoostMode, avgFps: number): FpsMeasurement => ({
  load,
  profile,
  boost,
  avgFps,
  p50FrameMs: 0,
  p95FrameMs: 0,
  droppedPct: 0,
  frames: 0,
  durationMs: 0,
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
    expect(peakCoreGain(r)).toBeCloseTo(40); // (42-30)/30, anchor 1 at load 300
  });
});
