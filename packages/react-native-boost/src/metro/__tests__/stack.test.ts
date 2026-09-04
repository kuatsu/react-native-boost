import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const repositoryRoot = path.resolve(import.meta.dirname, '../../../../..');
const packageRoot = path.join(repositoryRoot, 'packages/react-native-boost');
const { withBoostConfig } = requireFromTest(path.join(packageRoot, 'dist/metro/index.js')) as {
  withBoostConfig: (config: MetroConfig, options?: Record<string, unknown>) => MetroConfig;
};
const temporaryDirectories: string[] = [];

afterAll(() => {
  for (const directory of temporaryDirectories) fs.rmSync(directory, { recursive: true, force: true });
});

describe('Metro and Babel stack', () => {
  it('resolves an ancestor chain from an entry in a watch folder outside the project', async () => {
    const project = createProject();
    const external = createProject();
    const entry = path.join(external.root, 'entry.js');
    fs.writeFileSync(entry, `import ${JSON.stringify(path.join(project.root, 'Screen'))};`);
    fs.writeFileSync(
      path.join(project.root, 'Screen.js'),
      `import { Text } from 'react-native'; import { Shell } from './Shell'; import { Pass } from './Pass'; export default () => <Shell><Pass><Text>Hello</Text></Pass></Shell>;`
    );
    fs.writeFileSync(
      path.join(project.root, 'Shell.js'),
      `import { View } from 'react-native'; export const Shell = ({ children }) => <View>{children}</View>;`
    );
    fs.writeFileSync(path.join(project.root, 'Pass.js'), `export const Pass = ({ children }) => children;`);
    const { config, metro } = await createMetroConfig(project, 1, true);
    config.watchFolders = [project.root, external.root];

    const graph = await metro.buildGraph(config, { entries: [entry], platform: 'ios', dev: true, minify: false });

    expect(getCode(graph)).toContain('NativeText');
  });

  it.each([1, 4])('resolves a re-exported wrapper with %i worker(s)', async (maxWorkers) => {
    const project = createProject();
    fs.writeFileSync(
      path.join(project.root, 'Screen.js'),
      `import { Text } from 'react-native'; import { Shell } from './components'; export default () => <Shell><Text>Hello</Text></Shell>;`
    );
    fs.writeFileSync(path.join(project.root, 'components.js'), `export * from './component-export';`);
    fs.writeFileSync(path.join(project.root, 'component-export.js'), `export { Card as Shell } from './Card';`);
    fs.writeFileSync(
      path.join(project.root, 'Card.js'),
      `import { View } from 'react-native'; export function Card({ children }) { return <View>{children}</View>; }`
    );

    const graph = await buildGraph(project, maxWorkers);

    expect(getCode(graph)).toContain('react-native-boost/runtime');
    expect(getCode(graph)).toContain('NativeText');
  });

  it('resolves a default memo wrapper', async () => {
    const project = createProject();
    fs.writeFileSync(
      path.join(project.root, 'Screen.js'),
      `import { Text } from 'react-native'; import Card from './Card'; export default () => <Card><Text>Hello</Text></Card>;`
    );
    fs.writeFileSync(
      path.join(project.root, 'Card.js'),
      `import { memo } from 'react'; import { View } from 'react-native'; const Card = memo(({ children }) => <View>{children}</View>); export default Card;`
    );

    expect(getCode(await buildGraph(project, 1))).toContain('NativeText');
  });

  it('keeps a reassigned wrapper unknown', async () => {
    const project = createProject();
    fs.writeFileSync(
      path.join(project.root, 'Screen.js'),
      `import { Text } from 'react-native'; import { Card } from './Card'; export default () => <Card><Text>Hello</Text></Card>;`
    );
    fs.writeFileSync(
      path.join(project.root, 'Card.js'),
      `import { Text, View } from 'react-native'; export let Card = ({ children }) => <View>{children}</View>; Card = ({ children }) => <Text>{children}</Text>;`
    );

    expect(getCode(await buildGraph(project, 1))).not.toContain('react-native-boost/runtime');
  });

  it('uses the active platform file and honors the opt-out', async () => {
    const project = createProject();
    fs.writeFileSync(
      path.join(project.root, 'Screen.js'),
      `import { Text } from 'react-native'; import { Card } from './Card'; export default () => <Card><Text>Hello</Text></Card>;`
    );
    fs.writeFileSync(
      path.join(project.root, 'Card.ios.js'),
      `import { View } from 'react-native'; export const Card = ({ children }) => <View>{children}</View>;`
    );
    fs.writeFileSync(
      path.join(project.root, 'Card.android.js'),
      `import { Text } from 'react-native'; export const Card = ({ children }) => <Text>{children}</Text>;`
    );

    const ios = await buildGraph(project, 1, 'ios');
    const android = await buildGraph(project, 1, 'android');
    const disabled = await buildGraph(project, 1, 'ios', false);

    expect(getCode(ios)).toContain('NativeText');
    expect(getCode(android)).not.toContain('react-native-boost/runtime');
    expect(getCode(disabled)).not.toContain('react-native-boost/runtime');
  });

  it('does not reuse a cross-file consumer from Metro cache', async () => {
    const project = createProject();
    fs.writeFileSync(
      path.join(project.root, 'Screen.js'),
      `import { Text } from 'react-native'; import { Card } from './Card'; export default () => <Card><Text>Hello</Text></Card>;`
    );
    const cardPath = path.join(project.root, 'Card.js');
    fs.writeFileSync(
      cardPath,
      `import { View } from 'react-native'; export const Card = ({ children }) => <View>{children}</View>;`
    );
    const values = new Map<string, unknown>();
    const store: CacheStore = {
      get: (key) => values.get(key.toString('hex')) ?? null,
      set: (key, value) => values.set(key.toString('hex'), value),
    };

    expect(getCode(await buildGraph(project, 1, 'ios', true, undefined, [store]))).toContain('NativeText');
    expect(values.size).toBeGreaterThan(0);

    fs.writeFileSync(
      cardPath,
      `import { Text } from 'react-native'; export const Card = ({ children }) => <Text>{children}</Text>;`
    );
    const changed = await buildGraph(project, 1, 'ios', true, undefined, [store]);

    expect(getCode(changed)).not.toContain('react-native-boost/runtime');
  });

  it('uses Metro custom-resolver edges', async () => {
    const project = createProject();
    fs.writeFileSync(
      path.join(project.root, 'Screen.js'),
      `import { Text } from 'react-native'; import * as UI from '@ui/Card'; export default () => <UI.Card><Text>Hello</Text></UI.Card>;`
    );
    const cardPath = path.join(project.root, 'Card.js');
    fs.writeFileSync(
      cardPath,
      `import { View } from 'react-native'; export function Card({ children }) { return <View>{children}</View>; }`
    );

    const graph = await buildGraph(project, 1, 'ios', true, cardPath);

    expect(getCode(graph)).toContain('NativeText');
  });
});

function createProject(): { root: string; reactNativePackageJson: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-boost-stack-'));
  temporaryDirectories.push(root);
  const babelRuntimeDirectory = path.join(root, 'node_modules/@babel/runtime/helpers');
  const reactDirectory = path.join(root, 'node_modules/react');
  const reactNativeDirectory = path.join(root, 'node_modules/react-native');
  const boostDirectory = path.join(root, 'node_modules/react-native-boost');
  fs.mkdirSync(babelRuntimeDirectory, { recursive: true });
  fs.mkdirSync(reactDirectory, { recursive: true });
  fs.mkdirSync(reactNativeDirectory, { recursive: true });
  fs.mkdirSync(boostDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(root, 'node_modules/@babel/runtime/package.json'),
    JSON.stringify({ name: '@babel/runtime' })
  );
  fs.writeFileSync(
    path.join(babelRuntimeDirectory, 'interopRequireDefault.js'),
    'module.exports = value => value && value.__esModule ? value : { default: value };'
  );
  fs.writeFileSync(path.join(reactDirectory, 'package.json'), JSON.stringify({ name: 'react', main: 'index.js' }));
  fs.writeFileSync(path.join(reactDirectory, 'index.js'), 'exports.createElement = () => {};');
  fs.writeFileSync(path.join(reactDirectory, 'jsx-runtime.js'), 'exports.jsx = () => {}; exports.jsxs = () => {};');
  const reactNativePackageJson = path.join(reactNativeDirectory, 'package.json');
  const reactNativeVersion = (requireFromTest('react-native/package.json') as { version: string }).version;
  fs.writeFileSync(
    reactNativePackageJson,
    JSON.stringify({ name: 'react-native', version: reactNativeVersion, main: 'index.js' })
  );
  fs.writeFileSync(path.join(reactNativeDirectory, 'index.js'), "exports.Text = 'Text'; exports.View = 'View';");
  fs.writeFileSync(
    path.join(boostDirectory, 'package.json'),
    JSON.stringify({ name: 'react-native-boost', exports: { './runtime': './runtime.js' } })
  );
  fs.writeFileSync(
    path.join(boostDirectory, 'runtime.js'),
    "exports.NativeText = 'NativeText'; exports.NativeView = 'NativeView';"
  );
  fs.writeFileSync(
    path.join(root, 'babel.config.js'),
    `module.exports = { presets: [${JSON.stringify(requireFromTest.resolve('@react-native/babel-preset'))}] };`
  );
  return { root, reactNativePackageJson };
}

async function buildGraph(
  project: { root: string; reactNativePackageJson: string },
  maxWorkers: number,
  platform = 'ios',
  crossFileAncestorResolution = true,
  customCardPath?: string,
  cacheStores?: CacheStore[]
): Promise<MetroGraph> {
  const { config, metro } = await createMetroConfig(
    project,
    maxWorkers,
    crossFileAncestorResolution,
    customCardPath,
    cacheStores
  );
  return metro.buildGraph(config, {
    entries: [path.join(project.root, 'Screen.js')],
    platform,
    dev: true,
    minify: false,
  });
}

async function createMetroConfig(
  project: { root: string; reactNativePackageJson: string },
  maxWorkers: number,
  crossFileAncestorResolution: boolean,
  customCardPath?: string,
  cacheStores?: CacheStore[]
): Promise<{
  config: MetroConfig;
  metro: { buildGraph: (config: MetroConfig, options: Record<string, unknown>) => Promise<MetroGraph> };
}> {
  const metroPath = requireFromTest.resolve('metro');
  const metroRequire = createRequire(metroPath);
  const metro = requireFromTest('metro') as {
    buildGraph: (config: MetroConfig, options: Record<string, unknown>) => Promise<MetroGraph>;
  };
  const { getDefaultConfig } = metroRequire('metro-config') as {
    getDefaultConfig: (root: string) => Promise<MetroConfig>;
  };
  const defaults = await getDefaultConfig(project.root);
  const resolver = {
    ...defaults.resolver,
    ...(customCardPath
      ? {
          resolveRequest: (context: ResolverContext, moduleName: string, activePlatform: string | null) =>
            moduleName === '@ui/Card'
              ? { type: 'sourceFile', filePath: customCardPath }
              : context.resolveRequest(context, moduleName, activePlatform),
        }
      : {}),
  };
  const config = withBoostConfig(
    {
      ...defaults,
      ...(cacheStores ? { cacheStores } : {}),
      maxWorkers,
      projectRoot: project.root,
      watchFolders: [project.root],
      resolver,
      transformer: {
        ...defaults.transformer,
        babelTransformerPath: metroRequire.resolve('metro-babel-transformer'),
      },
    },
    {
      crossFileAncestorResolution,
      logLevel: 'silent',
      target: { reactNative: { packageJson: project.reactNativePackageJson } },
    }
  );
  return { config, metro };
}

function getCode(graph: MetroGraph): string {
  return [...graph.dependencies.values()]
    .flatMap((module) => module.output.map((output) => output.data.code))
    .join('\n');
}

type MetroConfig = Record<string, unknown> & {
  resolver?: Record<string, unknown>;
  transformer?: Record<string, unknown>;
};
type MetroGraph = {
  dependencies: Map<string, { output: Array<{ data: { code: string } }> }>;
};
type CacheStore = {
  get: (key: Buffer) => unknown;
  set: (key: Buffer, value: unknown) => unknown;
};
type ResolverContext = {
  resolveRequest: (
    context: ResolverContext,
    moduleName: string,
    platform: string | null
  ) => { type: string; filePath: string };
};
