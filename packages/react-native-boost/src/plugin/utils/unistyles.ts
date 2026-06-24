import fs from 'node:fs';
import nodePath from 'node:path';
import { UNISTYLES_MODULE_NAME } from './constants';

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;

/**
 * Whether the project being built declares `react-native-unistyles` as a dependency. Used to auto-enable
 * "Unistyles mode".
 *
 * Resolution walks up from Babel's config dirname (falling back to the process working directory) to the
 * nearest `package.json` and checks its dependency fields. This is deliberately stricter than a
 * `require.resolve` probe: in a monorepo (or with a hoisted/transitive copy) the package is often
 * resolvable from a project that does not actually use it, which would wrongly enable the mode and its
 * bailouts for unrelated packages. A declared dependency is the project's own signal that it uses
 * Unistyles. The result still only auto-enables the mode and emits a one-time hint to set the `unistyles`
 * flag explicitly, since a declared dependency does not prove Unistyles' own Babel plugin is active.
 */
export function isUnistylesInstalled(fromDirectory: string | undefined): boolean {
  const packageJson = readNearestPackageJson(fromDirectory ?? process.cwd());
  if (!packageJson) return false;

  return DEPENDENCY_FIELDS.some((field) => {
    const dependencies = packageJson[field];
    return typeof dependencies === 'object' && dependencies !== null && UNISTYLES_MODULE_NAME in dependencies;
  });
}

function readNearestPackageJson(fromDirectory: string): Record<string, unknown> | undefined {
  let directory = nodePath.resolve(fromDirectory);

  // Walk up until the filesystem root, stopping at the first readable `package.json`.
  for (;;) {
    try {
      return JSON.parse(fs.readFileSync(nodePath.join(directory, 'package.json'), 'utf8'));
    } catch {
      const parent = nodePath.dirname(directory);
      if (parent === directory) return undefined;
      directory = parent;
    }
  }
}
