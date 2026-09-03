import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import type { ConfigT } from 'metro-config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withBoostConfig } from '..';

const requireFromProject = createRequire(import.meta.url);
const temporaryDirectories: string[] = [];
const acceptsMetroConfig = (config: ConfigT) => withBoostConfig(config);
void acceptsMetroConfig;

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('Metro integration', () => {
  it('wraps the configured Babel transformer with the target and Boost options', () => {
    const config = withBoostConfig(
      {
        projectRoot: process.cwd(),
        transformer: { babelTransformerPath: requireFromProject.resolve('metro-babel-transformer') },
      },
      { logLevel: 'silent', optimizations: { 'native-text': 'off' } }
    );
    const wrapper = fs.readFileSync(config.transformer.babelTransformerPath, 'utf8');
    const { version } = requireFromProject('react-native/package.json') as { version: string };

    expect(wrapper).toContain('createTransformer');
    expect(wrapper).toContain(JSON.stringify(requireFromProject.resolve('metro-babel-transformer')));
    expect(wrapper).not.toContain('module.parent');
    expect(wrapper).toContain(`"version":"${version}"`);
    expect(wrapper).toContain('"native-text":"off"');
  });

  it('resolves a named Babel transformer from the project', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-boost-metro-'));
    temporaryDirectories.push(projectRoot);
    fs.writeFileSync(path.join(projectRoot, 'package.json'), '{}');
    const transformerDirectory = path.join(projectRoot, 'node_modules', 'custom-transformer');
    fs.mkdirSync(transformerDirectory, { recursive: true });
    fs.writeFileSync(path.join(transformerDirectory, 'package.json'), JSON.stringify({ main: 'index.js' }));
    const transformer = path.join(transformerDirectory, 'index.js');
    fs.writeFileSync(transformer, 'exports.transform = () => ({ ast: {} });');

    const config = withBoostConfig(
      { projectRoot, transformer: { babelTransformerPath: 'custom-transformer' } },
      { logLevel: 'silent' }
    );
    const wrapper = fs.readFileSync(config.transformer.babelTransformerPath, 'utf8');

    expect(wrapper).toContain(JSON.stringify(fs.realpathSync(transformer)));
  });

  it('fails early when the Babel transformer cannot be resolved', () => {
    expect(() =>
      withBoostConfig(
        {
          projectRoot: process.cwd(),
          transformer: { babelTransformerPath: 'missing-react-native-boost-transformer' },
        },
        { logLevel: 'silent' }
      )
    ).toThrow('Set transformer.babelTransformerPath with require.resolve(...)');
  });

  it('rejects duplicate Metro configuration', () => {
    const config = withBoostConfig({
      projectRoot: process.cwd(),
      transformer: { babelTransformerPath: requireFromProject.resolve('metro-babel-transformer') },
    });

    expect(() => withBoostConfig(config)).toThrow('applied more than once');
  });

  it('uses an explicit React Native package and changes the cache entry with its version', () => {
    const firstPackage = createPackage('0.86.0');
    const secondPackage = createPackage('0.87.1');
    const baseConfig = {
      projectRoot: process.cwd(),
      transformer: { babelTransformerPath: requireFromProject.resolve('metro-babel-transformer') },
    };

    const first = withBoostConfig(baseConfig, {
      logLevel: 'silent',
      target: { reactNative: { packageJson: firstPackage } },
    });
    const second = withBoostConfig(baseConfig, {
      logLevel: 'silent',
      target: { reactNative: { packageJson: secondPackage } },
    });

    expect(first.transformer.babelTransformerPath).not.toBe(second.transformer.babelTransformerPath);
    expect(fs.readFileSync(first.transformer.babelTransformerPath, 'utf8')).toContain('"version":"0.86.0"');
    expect(fs.readFileSync(second.transformer.babelTransformerPath, 'utf8')).toContain('"version":"0.87.1"');
  });

  it('warns when React Native cannot be resolved', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-boost-metro-'));
    temporaryDirectories.push(projectRoot);
    fs.writeFileSync(path.join(projectRoot, 'package.json'), '{}');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    withBoostConfig({
      projectRoot,
      transformer: { babelTransformerPath: requireFromProject.resolve('metro-babel-transformer') },
    });

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('React Native could not be detected'));
  });
});

function createPackage(version: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-boost-package-'));
  temporaryDirectories.push(directory);
  const packageJson = path.join(directory, 'package.json');
  fs.writeFileSync(packageJson, JSON.stringify({ name: 'react-native', version }));
  return packageJson;
}
