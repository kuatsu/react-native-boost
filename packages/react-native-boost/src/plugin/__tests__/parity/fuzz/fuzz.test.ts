import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// Same as parity.test.ts: mock the runtime's host COMPONENTS to the shared capturers while keeping the
// real runtime HELPERS (processTextAccessibilityProps / processTextStyle / processViewAccessibilityProps)
// under test. vi.mock is per-file, so the fuzz file repeats the block.
vi.mock('../../../../runtime/components/native-text', async () => ({
  NativeText: (await import('../capture')).NativeTextCapturer,
}));
vi.mock('../../../../runtime/components/native-view', async () => ({
  NativeView: (await import('../capture')).NativeViewCapturer,
}));
vi.mock('../../../../runtime/components/native-image', async () => ({
  NativeImage: (await import('../capture')).NativeImageCapturer,
}));

import { captureBoost } from '../boost';
import { captureWrapper } from '../wrapper';
import { normalize, normalizeImage } from '../normalize';
import { type PlatformOS } from '../mocks/Platform';
import { elementSpecArb, platformArb, render, type Tag } from './generator';
import { divergingKeys } from './diff';

const SEED = Number(process.env.FUZZ_SEED ?? 0xb0051);
const NUM_RUNS = Number(process.env.FUZZ_RUNS ?? 500);
const DISCOVER = process.env.FUZZ_DISCOVER === '1';
const DISCOVER_SAMPLES = Number(process.env.FUZZ_DISCOVER_SAMPLES ?? 3000);

interface Skipped {
  status: 'skipped';
}
interface Matched {
  status: 'match';
}
interface Diverged {
  status: 'divergence';
  whichBoost: string;
  whichWrapper: string;
  boost: Record<string, unknown>;
  wrapper: Record<string, unknown>;
  keys: string[];
}
type CaseResult = Skipped | Matched | Diverged;

/**
 * Run one generated case through both oracles. Returns `skipped` when Boost bails (equivalent to the
 * wrapper by construction), `match` when the optimized output equals the wrapper, or `divergence` with
 * the differing keys + both bags. Throws only on a genuine harness error (e.g. a value that makes BOTH
 * sides throw, or a wrapper render that is not single-host) — never on a parity difference.
 */
async function runCase(os: PlatformOS, jsxBody: string, preamble: string): Promise<CaseResult> {
  const boost = await captureBoost(os, jsxBody, preamble);
  if (!boost.optimized) return { status: 'skipped' };

  const wrapper = await captureWrapper(os, jsxBody, preamble);
  const normalizer = boost.which === 'NativeImage' || wrapper.which === 'NativeImage' ? normalizeImage : normalize;
  const boostNorm = normalizer(boost.props);
  const wrapperNorm = normalizer(wrapper.props);
  const keys = divergingKeys(boostNorm, wrapperNorm);

  if (boost.which === wrapper.which && keys.length === 0) return { status: 'match' };
  return {
    status: 'divergence',
    whichBoost: boost.which,
    whichWrapper: wrapper.which,
    boost: boostNorm,
    wrapper: wrapperNorm,
    keys,
  };
}

function formatDivergence(os: PlatformOS, jsxBody: string, preamble: string, result: Diverged): string {
  const whichNote =
    result.whichBoost === result.whichWrapper ? '' : `  host:     ${result.whichBoost} ≠ ${result.whichWrapper}\n`;
  return (
    `parity divergence [${os}] on keys [${result.keys.join(', ')}]\n` +
    `  jsx:      ${jsxBody}\n` +
    `  preamble: ${preamble.replace(/\n/g, ' ⏎ ') || '(none)'}\n` +
    whichNote +
    `  boost:    ${JSON.stringify(result.boost)}\n` +
    `  wrapper:  ${JSON.stringify(result.wrapper)}`
  );
}

// ── Gating property (skipped while enumerating) ─────────────────────────────────────────────────────
describe.skipIf(DISCOVER)('parity fuzzing', () => {
  it(
    `differential property: boost ≡ wrapper (seed=${SEED}, runs=${NUM_RUNS})`,
    async () => {
      let optimized = 0;
      let skipped = 0;
      const byTag: Record<Tag, { optimized: number; skipped: number }> = {
        Image: { optimized: 0, skipped: 0 },
        Text: { optimized: 0, skipped: 0 },
        View: { optimized: 0, skipped: 0 },
      };

      const property = fc.asyncProperty(platformArb, elementSpecArb, async (os, spec) => {
        const { preamble, jsxBody } = render(spec);
        const result = await runCase(os, jsxBody, preamble);
        if (result.status === 'skipped') {
          skipped++;
          byTag[spec.tag].skipped++;
          return;
        }
        optimized++;
        byTag[spec.tag].optimized++;
        if (result.status === 'divergence') throw new Error(formatDivergence(os, jsxBody, preamble, result));
      });

      const start = performance.now();
      await fc.assert(property, { seed: SEED, numRuns: NUM_RUNS });
      const elapsed = performance.now() - start;

      const total = optimized + skipped;
      const rate = optimized / total;
      console.log(
        `[fuzz] cases=${total} optimized=${optimized} skipped=${skipped} ` +
          `optimize-rate=${(rate * 100).toFixed(1)}% elapsed=${elapsed.toFixed(0)}ms ` +
          `(${(total / (elapsed / 1000)).toFixed(1)} cases/s) ` +
          `image=${byTag.Image.optimized}/${byTag.Image.optimized + byTag.Image.skipped} ` +
          `text=${byTag.Text.optimized}/${byTag.Text.optimized + byTag.Text.skipped} ` +
          `view=${byTag.View.optimized}/${byTag.View.optimized + byTag.View.skipped}`
      );

      // Anti-vacuous-green guard: a generator drifting into all-bail would pass trivially.
      expect(rate).toBeGreaterThan(0.5);
      const imageTotal = byTag.Image.optimized + byTag.Image.skipped;
      const imageRate = byTag.Image.optimized / imageTotal;
      expect(imageTotal).toBeGreaterThan(0);
      expect(imageRate).toBeGreaterThan(0.2);
    },
    Math.max(30_000, NUM_RUNS * 80)
  );
});

// ── Exhaustive cross-product: Text `disabled` × `accessibilityState.disabled` × `accessible` ────────
// The reconcile in processTextAccessibilityProps has a genuinely non-trivial condition; enumerate the 27
// combinations per platform rather than sampling them.
const TRISTATE = ['absent', 'true', 'false'] as const;
const disabledCombos = TRISTATE.flatMap((disabled) =>
  TRISTATE.flatMap((stateDisabled) => TRISTATE.map((accessible) => ({ disabled, stateDisabled, accessible })))
);

function buildDisabledCase(combo: { disabled: string; stateDisabled: string; accessible: string }): string {
  const attrs: string[] = [];
  if (combo.disabled !== 'absent') attrs.push(`disabled={${combo.disabled}}`);
  if (combo.stateDisabled !== 'absent') attrs.push(`accessibilityState={{ disabled: ${combo.stateDisabled} }}`);
  if (combo.accessible !== 'absent') attrs.push(`accessible={${combo.accessible}}`);
  return `<Text ${attrs.join(' ')}>x</Text>`;
}

describe.skipIf(DISCOVER).each(['ios', 'android'] as const)('disabled reconciliation [%s]', (os) => {
  it.each(disabledCombos)('disabled=$disabled state.disabled=$stateDisabled accessible=$accessible', async (combo) => {
    const jsx = buildDisabledCase(combo);
    const result = await runCase(os, jsx, '');
    if (result.status === 'divergence') throw new Error(formatDivergence(os, jsx, '', result));
  });
});

// ── Discovery enumerator (FUZZ_DISCOVER=1; run nightly by fuzz.yml with a fresh seed per run). Unlike
// the fail-fast gating property, this catalogs every distinct divergence class over a large sample
// before failing, so one long-lived divergence cannot shadow newer ones behind it. ──────
describe.runIf(DISCOVER)('parity fuzzing — discovery', () => {
  it(
    `enumerate divergence classes (seed=${SEED}, samples=${DISCOVER_SAMPLES})`,
    async () => {
      const samples = fc.sample(fc.tuple(platformArb, elementSpecArb), { numRuns: DISCOVER_SAMPLES, seed: SEED });
      const classes = new Map<string, { count: number; example: string }>();
      let optimized = 0;
      let skipped = 0;
      let harnessErrors = 0;

      for (const [os, spec] of samples) {
        const { preamble, jsxBody } = render(spec);
        let result: CaseResult;
        try {
          result = await runCase(os, jsxBody, preamble);
        } catch (error) {
          harnessErrors++;
          const key = `HARNESS-ERROR ${spec.tag}: ${(error as Error).message.split('\n')[0]}`;
          const existing = classes.get(key);
          if (existing) existing.count++;
          else classes.set(key, { count: 1, example: `${os} :: ${preamble} :: ${jsxBody}` });
          continue;
        }
        if (result.status === 'skipped') {
          skipped++;
          continue;
        }
        optimized++;
        if (result.status === 'match') continue;

        const hostNote =
          result.whichBoost === result.whichWrapper ? '' : ` host:${result.whichBoost}->${result.whichWrapper}`;
        const key = `${spec.tag} keys:[${result.keys.join(',')}]${hostNote}`;
        const existing = classes.get(key);
        if (existing) existing.count++;
        else classes.set(key, { count: 1, example: formatDivergence(os, jsxBody, preamble, result) });
      }

      const ranked = [...classes.entries()].sort((a, b) => b[1].count - a[1].count);
      const lines = ranked.map(([key, { count, example }]) => `\n### ${count}× ${key}\n${example}`);
      console.log(
        `\n[discovery] seed=${SEED} samples=${samples.length} optimized=${optimized} skipped=${skipped} ` +
          `harnessErrors=${harnessErrors} divergenceClasses=${ranked.length}\n${lines.join('\n')}`
      );

      // Fail on ANY class, including known-but-unfixed ones — a red nightly is the intended signal,
      // not noise to allowlist. The full census above is always printed first.
      expect(ranked.map(([key, { count }]) => `${count}× ${key}`)).toEqual([]);
    },
    Math.max(60_000, DISCOVER_SAMPLES * 80)
  );
});
