import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { ConfigT } from 'metro-config';
import { afterAll, expect, it, vi } from 'vitest';
import { withBoostConfig } from '..';

const require = createRequire(import.meta.url);
const packageRoot = path.resolve(import.meta.dirname, '../../..');
const metroRequire = createRequire(require.resolve('metro'));
const { withUniwindConfig } = require('uniwind/metro');
const root = fs.mkdtempSync(path.join(packageRoot, '.uniwind-test-'));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
fs.writeFileSync(path.join(root, 'global.css'), '@import "tailwindcss";\n@import "uniwind";\n');

function config() {
  return {
    projectRoot: root,
    transformer: { babelTransformerPath: metroRequire.resolve('metro-babel-transformer') },
  };
}

it('requires the correct Metro wrapper order when explicitly enabled', () => {
  expect(() => withBoostConfig(config(), { integrations: { uniwind: 'on' } })).toThrow('after withUniwindConfig');
});

it('detects active Uniwind and preserves its resolver except for Boost runtime imports', () => {
  const uniwind = withUniwindConfig(config(), {
    cssEntryFile: path.relative(process.cwd(), path.join(root, 'global.css')),
    dtsFile: path.join(root, 'uniwind.d.ts'),
  });
  const result = withBoostConfig(uniwind, { crossFileAncestorResolution: false, logLevel: 'silent' });
  const source = fs.readFileSync(result.transformer.babelTransformerPath, 'utf8');
  expect(source).toContain('"uniwind":"on"');
  const resolveRequest = vi.fn((_context, name: string) => ({
    type: 'sourceFile',
    filePath: path.isAbsolute(name) ? name : require.resolve(name),
  }));
  const context = { originModulePath: path.join(packageRoot, 'src/runtime/uniwind.ts'), resolveRequest };
  const resolve = result.resolver.resolveRequest;
  const native = resolve(context, 'react-native', 'ios');
  expect(native.filePath).toBe(path.join(path.dirname(require.resolve('react-native/package.json')), 'index.js'));
  const hook = resolve(context, 'react-native-boost/uniwind/useStyle', 'ios');
  expect(hook.filePath).toBe(
    path.join(path.dirname(require.resolve('uniwind/package.json')), 'src/components/native/useStyle.ts')
  );
  const application = resolve({ ...context, originModulePath: path.join(root, 'Screen.tsx') }, 'react-native', 'ios');
  expect(application.filePath).toBe(require.resolve('uniwind/components'));
  expect(result.transformerPath).toBe(uniwind.transformerPath);
  resolveRequest.mockClear();
  resolve(context, 'react-native', 'web');
  expect(resolveRequest.mock.calls[0][1]).toBe('react-native');
  const disabled = withBoostConfig(uniwind, {
    crossFileAncestorResolution: false,
    logLevel: 'silent',
    integrations: { uniwind: 'off' },
  });
  expect(disabled.resolver.resolveRequest).toBe(uniwind.resolver.resolveRequest);
});

it('allows an installed but inactive Uniwind package', () => {
  const result = withBoostConfig(config(), { crossFileAncestorResolution: false, logLevel: 'silent' });
  expect(result).not.toHaveProperty('resolver.resolveRequest');
});

it('builds class styles and native adapters through the real Metro and Uniwind workers', async () => {
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(
    path.join(root, 'babel.config.cjs'),
    `module.exports = { presets: [[${JSON.stringify(require.resolve('@react-native/babel-preset'))}, {enableBabelRuntime: false}]] };`
  );
  fs.writeFileSync(
    path.join(root, 'Screen.tsx'),
    `import './global.css'; import { Shell } from './Shell'; import { View, Text, Image, ActivityIndicator } from 'react-native'; export default () => <View className="p-4"><Shell><Text className="text-red-500">hello</Text></Shell><Image className="w-8 h-8" source={{uri:'logo.png'}}/><ActivityIndicator className="p-2" colorClassName="accent-red-500"/></View>;`
  );
  fs.writeFileSync(
    path.join(root, 'Shell.tsx'),
    `import { View } from 'react-native'; import { ScopedTheme } from 'uniwind'; export function Shell({ children }) { return <View className="p-2"><ScopedTheme theme="dark">{children}</ScopedTheme></View>; }`
  );
  const { getDefaultConfig } = metroRequire('metro-config');
  const base: ConfigT = await getDefaultConfig(root);
  const uniwind = withUniwindConfig(
    {
      ...base,
      maxWorkers: 1,
      resolver: {
        ...base.resolver,
        resolverMainFields: ['react-native', 'browser', 'main'],
        unstable_conditionNames: ['require', 'react-native'],
        extraNodeModules: { 'react-native-boost': packageRoot },
      },
      watchFolders: [path.resolve(packageRoot, '../..')],
      transformer: {
        ...base.transformer,
        assetRegistryPath: createRequire(require.resolve('react-native/package.json')).resolve(
          '@react-native/assets-registry/registry'
        ),
        babelTransformerPath: metroRequire.resolve('metro-babel-transformer'),
      },
    },
    {
      cssEntryFile: path.relative(process.cwd(), path.join(root, 'global.css')),
      dtsFile: path.join(root, 'uniwind.d.ts'),
    }
  );
  const built = require(path.join(packageRoot, 'dist/metro/index.js')).withBoostConfig(uniwind, {
    logLevel: 'silent',
    integrations: { unistyles: 'off' },
  });
  const graph = await require('metro').buildGraph(built, {
    entries: [path.join(root, 'Screen.tsx')],
    platform: 'ios',
    dev: true,
    minify: false,
  });
  const code = graph.dependencies.get(path.join(root, 'Screen.tsx')).output[0].data.code as string;
  expect(code).toContain('react-native-boost/uniwind');
  for (const name of ['NativeView', 'NativeText', 'NativeImage', 'NativeActivityIndicator'])
    expect(code).toContain(name);
  const runtime = graph.dependencies.get(path.join(packageRoot, 'dist/runtime/uniwind.js'));
  expect(runtime).toBeDefined();
  const dependencies = [...runtime.dependencies.values()] as Array<{ absolutePath: string; data: { name: string } }>;
  expect(dependencies.find((dependency) => dependency.data.name === 'react-native')?.absolutePath).toBe(
    path.join(path.dirname(require.resolve('react-native/package.json')), 'index.js')
  );
  expect(
    dependencies.find((dependency) => dependency.data.name === 'react-native-boost/uniwind/useStyle')?.absolutePath
  ).toContain('/uniwind/src/components/native/useStyle.ts');
  const css = graph.dependencies.get(path.join(root, 'global.css')).output[0].data.code;
  expect(css).toContain('text-red-500');
}, 60_000);

it.each([
  { name: 'uniwind', version: '1.13.0', license: 'MIT' },
  { name: '@uniwind/pro', version: '1.12.0', license: 'UNLICENSED' },
])('rejects an unchecked Uniwind package: $name $version', (manifest) => {
  const projectRoot = fs.mkdtempSync(path.join(root, 'unsupported-'));
  const directory = path.join(projectRoot, 'node_modules/uniwind');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(manifest));
  expect(() =>
    withBoostConfig(
      { ...config(), projectRoot, transformer: { ...config().transformer, uniwind: {} } },
      { logLevel: 'silent' }
    )
  ).toThrow('free Uniwind 1.12.x');
});
