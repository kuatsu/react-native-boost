import fs from 'node:fs';
import path from 'node:path';
import type { AncestorSnapshot } from '../../ancestor-types';

let cachedMtime: bigint | undefined;
let cachedPath: string | undefined;
let cachedSnapshot: AncestorSnapshot | undefined;

export function readModuleImports(
  snapshotPath: string | undefined,
  projectRoot: string | undefined,
  filename: string,
  platform: string | undefined
) {
  if (!snapshotPath || !projectRoot) return;

  try {
    const mtime = fs.statSync(snapshotPath, { bigint: true }).mtimeNs;
    if (cachedPath !== snapshotPath || cachedMtime !== mtime) {
      cachedPath = snapshotPath;
      cachedMtime = mtime;
      cachedSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as AncestorSnapshot;
    }
  } catch {
    return;
  }

  if (cachedSnapshot?.version !== 1) return;
  const absoluteFilename = path.resolve(projectRoot, filename);
  return {
    ancestors: cachedSnapshot.platforms[platform ?? '']?.[absoluteFilename],
    spreads: cachedSnapshot.spreadPlatforms?.[platform ?? '']?.[absoluteFilename],
  };
}
