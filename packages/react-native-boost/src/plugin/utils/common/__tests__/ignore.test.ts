import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFileIgnoreMatcher } from '../validation';

const file = (cwd: string, filename: string) => ({ opts: { cwd, filename } });

describe('compiled file ignores', () => {
  it('preserves glob rules and resolves relative patterns against each file working directory', () => {
    const first = path.resolve('/first');
    const second = path.resolve('/second');
    const matches = createFileIgnoreMatcher([
      'node_modules/**',
      '**/*.unoptimized.tsx',
      path.join(first, 'absolute/**'),
    ]);
    for (const cwd of [first, second, first]) {
      expect(matches(file(cwd, path.join(cwd, 'node_modules/.pnpm/package/index.js')))).toBe(true);
      expect(matches(file(cwd, path.join(cwd, 'src/file.unoptimized.tsx')))).toBe(true);
      expect(matches(file(cwd, path.join(first, 'absolute/file.js')))).toBe(true);
      expect(matches(file(cwd, path.join(cwd, 'src/file.tsx')))).toBe(false);
      const other = cwd === first ? second : first;
      expect(matches(file(cwd, path.join(other, 'node_modules/package/index.js')))).toBe(false);
    }
  });

  it('does not share patterns between plugin configurations', () => {
    const cwd = process.cwd();
    const source = file(cwd, path.join(cwd, 'source.js'));
    expect(createFileIgnoreMatcher(['**/*.js'])(source)).toBe(true);
    expect(createFileIgnoreMatcher([])(source)).toBe(false);
  });
});
