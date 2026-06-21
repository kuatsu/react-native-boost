import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from '../paths.ts';
import type { FiberResult, SweepConfig } from '../schema.ts';

/**
 * Run the headless fibers collector (a parity vitest test) and read back its result. The test renders a
 * representative list row through the real RN wrapper pipeline and counts the tree nodes Boost removes —
 * no device or build required, so this stage always runs.
 */
export function collectFibers(sweep: SweepConfig): FiberResult {
  const dir = mkdtempSync(join(tmpdir(), 'rnboost-fibers-'));
  const out = join(dir, 'fibers.json');
  try {
    execFileSync(
      'pnpm',
      ['--filter', 'react-native-boost', 'exec', 'vitest', 'run', '--project', 'parity', 'fibers.collect'],
      {
        cwd: repoRoot(),
        env: { ...process.env, BENCH_FIBERS_OUT: out, BENCH_FIBERS_LOADS: JSON.stringify(sweep.loads) },
        stdio: 'pipe',
        // The test runs in seconds; cap it so a wedged pnpm/vitest fails the stage instead of hanging the pipeline.
        timeout: 120_000,
        killSignal: 'SIGKILL',
      }
    );
    return JSON.parse(readFileSync(out, 'utf8')) as FiberResult;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
