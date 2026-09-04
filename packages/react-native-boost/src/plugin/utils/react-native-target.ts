import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { ReactNativeColorNormalizer, ReactNativeTargetOption } from '../types';

export interface ResolvedReactNativeTarget {
  version: string;
  packageJson: string;
  fingerprint: string;
}

export interface ReactNativeTargetResolution {
  target?: ResolvedReactNativeTarget;
  versions: string[];
}

export function resolveReactNativeTarget(
  configuredTarget: ReactNativeTargetOption | undefined,
  locations: Array<string | undefined>
): ReactNativeTargetResolution {
  if (configuredTarget) {
    const target = readReactNativeTarget(resolvePath(configuredTarget.packageJson, locations));
    return { target, versions: target ? [target.version] : [] };
  }

  const packageJsonPaths = new Set<string>();
  const targets: ResolvedReactNativeTarget[] = [];
  for (const location of locations) {
    const packageJson = resolveReactNativePackageJson(location);
    if (!packageJson || packageJsonPaths.has(packageJson)) continue;
    packageJsonPaths.add(packageJson);
    const target = readReactNativeTarget(packageJson);
    if (target) targets.push(target);
  }

  if (targets.length === 0) return { versions: [] };

  const counts = new Map<string, number>();
  for (const target of targets) counts.set(target.version, (counts.get(target.version) ?? 0) + 1);
  let selected = targets[0]!;
  for (const target of targets.slice(1)) {
    if ((counts.get(target.version) ?? 0) > (counts.get(selected.version) ?? 0)) selected = target;
  }

  return { target: selected, versions: [...new Set(targets.map((target) => target.version))] };
}

export function getReactNativeMinor(version: string | undefined): number | undefined {
  const match = version ? /^(\d+)\.(\d+)\./.exec(version) : null;
  if (!match) return undefined;
  return Number(match[1]) === 0 ? Number(match[2]) : Number.MAX_SAFE_INTEGER;
}

export function loadReactNativeColorNormalizer(
  packageJson: string | undefined
): ReactNativeColorNormalizer | undefined {
  if (!packageJson) return undefined;

  try {
    const normalizeColor = createRequire(packageJson)('@react-native/normalize-colors') as unknown;
    return typeof normalizeColor === 'function' ? (normalizeColor as ReactNativeColorNormalizer) : undefined;
  } catch {
    return undefined;
  }
}

function resolvePath(packageJson: string, locations: Array<string | undefined>): string {
  if (path.isAbsolute(packageJson)) return packageJson;
  const origin = locations.find(Boolean);
  return path.resolve(origin ? path.dirname(origin) : process.cwd(), packageJson);
}

function resolveReactNativePackageJson(origin: string | undefined): string | undefined {
  if (!origin) return undefined;

  try {
    return fs.realpathSync(createRequire(path.resolve(origin)).resolve('react-native/package.json'));
  } catch {
    return undefined;
  }
}

function readReactNativeTarget(packageJson: string): ResolvedReactNativeTarget | undefined {
  try {
    const contents = fs.readFileSync(packageJson, 'utf8');
    const { version } = JSON.parse(contents) as { version?: unknown };
    if (typeof version !== 'string' || !isReactNativeVersion(version)) return undefined;
    return { version, packageJson: fs.realpathSync(packageJson), fingerprint: hash(contents) };
  } catch {
    return undefined;
  }
}

function isReactNativeVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:-|$)/.test(version);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
