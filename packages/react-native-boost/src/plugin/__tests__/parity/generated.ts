import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ComponentType } from 'react';

let counter = 0;

/**
 * Write transformed module source to a reused, pid-scoped file under `__generated__/` and dynamically
 * import it as a fresh module. The file is pid-scoped so concurrent vitest workers never clobber each
 * other's, and the import is cache-busted with a per-call `?v=` query so the module runner re-reads the
 * just-overwritten file instead of returning the stale first module. At fuzz scale this reuse replaces
 * the thousands of uniquely-numbered files a per-case scheme would leak. Writes + imports are sequential
 * within a process (fast-check awaits each predicate; vitest runs a file's tests serially), so the
 * reused file is race-free.
 */
export async function writeAndImportFresh(label: string, code: string): Promise<{ default: ComponentType }> {
  const file = fileURLToPath(new URL(`./__generated__/${label}-fuzz-${process.pid}.js`, import.meta.url));
  writeFileSync(file, code);
  return import(/* @vite-ignore */ `${pathToFileURL(file).href}?v=${counter++}`);
}
