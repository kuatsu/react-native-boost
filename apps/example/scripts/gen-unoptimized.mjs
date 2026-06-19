import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generates `*.unoptimized.tsx` twins from canonical source files.
 */

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDirectory, '..');

const canonicalSources = ['src/screens/trading-demo/components/rows.tsx'];

const header = (sourceRelativePath) =>
  [
    '/**',
    ' * GENERATED FILE — DO NOT EDIT.',
    ` * Produced by scripts/gen-unoptimized.mjs from ${sourceRelativePath}.`,
    ' * This twin is excluded from the react-native-boost transform so it renders the',
    ' * unoptimized Text/View wrappers. Edit the canonical source and re-run the generator.',
    ' */',
    '',
  ].join('\n');

for (const sourceRelativePath of canonicalSources) {
  const sourcePath = join(projectRoot, sourceRelativePath);
  const twinPath = sourcePath.replace(/\.tsx$/, '.unoptimized.tsx');

  const source = readFileSync(sourcePath, 'utf8');
  mkdirSync(dirname(twinPath), { recursive: true });
  writeFileSync(twinPath, header(sourceRelativePath) + source);

  console.log(`generated ${relative(projectRoot, twinPath)}`);
}
