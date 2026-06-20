import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { archiveRoot, runDir } from './paths.ts';
import type { BenchContext, FiberResult, FpsResult, Platform, RunKey, RunResult } from './schema.ts';

/** The Boost commit SHA is the repo commit — Boost lives in this repo. */
export const keyOf = (ctx: BenchContext): RunKey => ({ rnVersion: ctx.rnVersion, boostSha: ctx.gitSha });

function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function readJson<T>(file: string): T | undefined {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : undefined;
}

export function saveContext(ctx: BenchContext): void {
  writeJson(join(runDir(keyOf(ctx)), 'context.json'), ctx);
}

export function saveFibers(key: RunKey, fibers: FiberResult): void {
  writeJson(join(runDir(key), 'fibers.json'), fibers);
}

/** Idempotent: re-running a platform overwrites only that platform's file. */
export function saveFps(key: RunKey, result: FpsResult): void {
  writeJson(join(runDir(key), `${result.platform}.json`), result);
}

/** Read a complete archived run for one key (used by the report stage). */
export function loadRun(key: RunKey): RunResult | undefined {
  const dir = runDir(key);
  const context = readJson<BenchContext>(join(dir, 'context.json'));
  if (!context) return undefined;
  const fps: RunResult['fps'] = {};
  for (const platform of ['ios', 'android'] as Platform[]) {
    const r = readJson<FpsResult>(join(dir, `${platform}.json`));
    if (r) fps[platform] = r;
  }
  return { context, fibers: readJson<FiberResult>(join(dir, 'fibers.json')), fps };
}

/** All archived runs, newest-RN-first (used for cross-version trend graphs). */
export function listRuns(): RunResult[] {
  const root = archiveRoot();
  if (!existsSync(root)) return [];
  const runs: RunResult[] = [];
  for (const rnDir of readdirSync(root)) {
    if (!rnDir.startsWith('rn-')) continue;
    const rnVersion = rnDir.slice('rn-'.length);
    for (const boostDir of readdirSync(join(root, rnDir))) {
      if (!boostDir.startsWith('boost-')) continue;
      const run = loadRun({ rnVersion, boostSha: boostDir.slice('boost-'.length) });
      if (run) runs.push(run);
    }
  }
  return runs.sort((a, b) => b.context.rnVersion.localeCompare(a.context.rnVersion, undefined, { numeric: true }));
}
