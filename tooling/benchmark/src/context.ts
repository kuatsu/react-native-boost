import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { BUILD_PROFILES } from './config.ts';
import { repoRoot, exampleDir } from './paths.ts';
import type { BenchContext, SweepConfig } from './schema.ts';

const require = createRequire(import.meta.url);

function jsonVersion(pkgJsonPath: string): string {
  return JSON.parse(readFileSync(pkgJsonPath, 'utf8')).version;
}

/** Version of a dependency as actually resolved from the example app (the app under test). */
function resolvedVersion(name: string): string {
  const pkgJson = require.resolve(`${name}/package.json`, { paths: [exampleDir()] });
  return jsonVersion(pkgJson);
}

/** Resolve the archive key + provenance for this run. `timestamp` is stamped by the caller. */
export function resolveContext(sweep: SweepConfig, timestamp: string): BenchContext {
  const root = repoRoot();
  const gitSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
  return {
    boostVersion: jsonVersion(join(root, 'packages/react-native-boost/package.json')),
    rnVersion: resolvedVersion('react-native'),
    reactVersion: resolvedVersion('react'),
    gitSha,
    timestamp,
    sweep,
    coreFlags: BUILD_PROFILES.find((p) => p.id === 'core')?.rnFlags ?? [],
  };
}
