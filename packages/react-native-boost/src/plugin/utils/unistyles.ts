import { createRequire } from 'node:module';
import nodePath from 'node:path';
import { UNISTYLES_MODULE_NAME } from './constants';

/**
 * Whether `react-native-unistyles` is resolvable from the given directory (Babel's config dirname,
 * falling back to the process working directory). Used to auto-enable "Unistyles mode".
 *
 * An installed package does not prove that Unistyles' own Babel plugin is active in the project, so a
 * positive result only auto-enables the mode and emits a one-time hint to set the `unistyles` flag
 * explicitly. `createRequire` is used so the probe works in both the CJS and ESM plugin builds; the
 * anchor path only needs to seed the `node_modules` lookup, it does not need to exist.
 */
export function isUnistylesInstalled(fromDirectory: string | undefined): boolean {
  const base = fromDirectory ?? process.cwd();
  try {
    const require = createRequire(nodePath.join(base, 'package.json'));
    require.resolve(`${UNISTYLES_MODULE_NAME}/package.json`);
    return true;
  } catch {
    return false;
  }
}
