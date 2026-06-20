import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ARCHIVE_DIR, GRAPHS_DIR } from './config.ts';

let cachedRoot: string | undefined;

/** Repo root, resolved once via git (the suite always runs inside the repo). */
export function repoRoot(): string {
  cachedRoot ??= execFileSync('git', ['rev-parse', '--show-toplevel']).toString().trim();
  return cachedRoot;
}

/** Archive directory for a run, keyed by RN version and the Boost commit SHA under test. */
export function runDir(key: { rnVersion: string; boostSha: string }): string {
  return join(repoRoot(), ARCHIVE_DIR, `rn-${key.rnVersion}`, `boost-${key.boostSha}`);
}

export function archiveRoot(): string {
  return join(repoRoot(), ARCHIVE_DIR);
}

export function graphsDir(): string {
  return join(repoRoot(), GRAPHS_DIR);
}

export function exampleDir(): string {
  return join(repoRoot(), 'apps/example');
}
