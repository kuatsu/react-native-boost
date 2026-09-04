import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getReactNativeMinor, loadReactNativeColorNormalizer, resolveReactNativeTarget } from '../react-native-target';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('React Native target resolution', () => {
  it('uses the version resolved from the requiring project', () => {
    const project = createProject('0.87.1');
    const resolution = resolveReactNativeTarget(undefined, [path.join(project, 'package.json')]);

    expect(resolution.target?.version).toBe('0.87.1');
    expect(resolution.target?.packageJson).toBe(
      fs.realpathSync(path.join(project, 'node_modules/react-native/package.json'))
    );
    expect(getReactNativeMinor(resolution.target?.version)).toBe(87);
  });

  it('uses the most common version when candidates disagree', () => {
    const first = createProject('0.86.0');
    const second = createProject('0.87.1');
    const third = createProject('0.87.1');
    const resolution = resolveReactNativeTarget(undefined, [
      path.join(first, 'package.json'),
      path.join(second, 'package.json'),
      path.join(third, 'package.json'),
    ]);

    expect(resolution.target?.version).toBe('0.87.1');
    expect(resolution.versions).toEqual(['0.86.0', '0.87.1']);
  });

  it('loads the color normalizer from the selected React Native package', () => {
    const project = createProject('0.83.0');
    const packageJson = path.join(project, 'node_modules/react-native/package.json');
    const normalizerDirectory = path.join(
      project,
      'node_modules/react-native/node_modules/@react-native/normalize-colors'
    );
    fs.mkdirSync(normalizerDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(normalizerDirectory, 'index.js'),
      'module.exports = color => color === "red" ? 42 : null;'
    );

    const normalizeColor = loadReactNativeColorNormalizer(packageJson);

    expect(normalizeColor?.('red')).toBe(42);
    expect(normalizeColor?.('invalid')).toBeNull();
  });
});

function createProject(version: string): string {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-boost-target-'));
  temporaryDirectories.push(project);
  const packageDirectory = path.join(project, 'node_modules/react-native');
  fs.mkdirSync(packageDirectory, { recursive: true });
  fs.writeFileSync(path.join(project, 'package.json'), '{}');
  fs.writeFileSync(path.join(packageDirectory, 'package.json'), JSON.stringify({ name: 'react-native', version }));
  return project;
}
