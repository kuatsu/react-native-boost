import fs from 'node:fs';
import path from 'node:path';
import type { AncestorSnapshot, ComponentAncestorClassification } from '../../ancestor-types';

let cachedMtime: bigint | undefined;
let cachedPath: string | undefined;
let cachedSnapshot: AncestorSnapshot | undefined;

export function readAncestorImports(
  snapshotPath: string | undefined,
  projectRoot: string | undefined,
  filename: string,
  platform: string | undefined
): Record<string, Record<string, ComponentAncestorClassification>> | undefined {
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
  return cachedSnapshot.platforms[platform ?? '']?.[absoluteFilename];
}
