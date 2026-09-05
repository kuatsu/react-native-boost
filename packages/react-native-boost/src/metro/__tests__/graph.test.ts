import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { transformSync, types as t, type TransformCaller } from '@babel/core';
import { afterEach, describe, expect, it } from 'vitest';
import { installMetroGraphPatch } from '../graph';
import boostPlugin from '../../plugin';

const requireFromTest = createRequire(import.meta.url);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('private Metro graph integration', () => {
  it.each([
    [`export { Pressable as Card } from 'react-native';`, `export { Text as Card } from 'react-native';`],
    [
      `import Animated from 'react-native-reanimated'; export const Card = Animated.View;`,
      `import Animated from 'react-native-reanimated'; export const Card = Animated.Text;`,
    ],
  ])('invalidates an intrinsic ancestor summary: %s', async (safe, text) => {
    const sources = {
      'Screen.js': `import { Text } from 'react-native'; import { Card } from './Card'; export default () => <Card><Text>Hello</Text></Card>;`,
      'Card.js': safe,
    };
    const project = createGraph(sources);
    await project.graph.initialTraverseDependencies(project.options);
    expect(project.code()).toContain('<_NativeText');

    sources['Card.js'] = text;
    const delta = await project.graph.traverseDependencies([project.filename('Card.js')], project.options);
    expect(project.code()).toContain('<Text>Hello</Text>');
    expect(delta.modified.has(project.filename('Screen.js'))).toBe(true);
  });

  it('keeps unsafe branches distinct from variable Text context across files', async () => {
    const sources = {
      'Screen.js': `import { Text, View } from 'react-native'; import { Wrapper } from './Wrapper'; export default () => <Wrapper><View testID="target"><Text>Hello</Text></View><Text>inline</Text></Wrapper>;`,
      'Wrapper.js': `import { Text } from 'react-native'; import { Inner } from './Inner'; export function Wrapper({children, inline}) { if (inline) return <Text>{children}</Text>; return <Inner>{children}</Inner>; }`,
      'Inner.js': `export const Inner = ({children}) => children;`,
    };
    const project = createGraph(sources);
    await project.graph.initialTraverseDependencies(project.options);
    expect(project.code()).toContain('<_NativeViewWithContext testID="target">');
    expect(project.code()).toContain('<Text>inline</Text>');

    sources['Inner.js'] =
      `import React from 'react'; export const Inner = ({children}) => React.Children.map(children, child => React.cloneElement(child, {'aria-label': 'Name'}));`;
    await project.graph.traverseDependencies([project.filename('Inner.js')], project.options);
    expect(project.code()).toContain('<View testID="target">');
    expect(project.code()).not.toContain('NativeViewWithContext');

    sources['Inner.js'] =
      `import { Text } from 'react-native'; export const Inner = ({children}) => <Text>{children}</Text>;`;
    await project.graph.traverseDependencies([project.filename('Inner.js')], project.options);
    expect(project.code()).toContain('<_NativeViewWithContext testID="target">');
  });

  it('continues resolving ancestors after a queued transform fails', async () => {
    const project = createGraph({
      'Screen.js': `import { Text } from 'react-native'; import { Card } from './Card'; export default () => <Card><Text>Hello</Text></Card>;`,
      'Card.js': `import { View } from 'react-native'; export const Card = ({ children }) => <View>{children}</View>;`,
    });
    const transform = project.options.transform;
    let consumerTransforms = 0;
    project.options.transform = async (filename) => {
      if (filename === project.filename('Screen.js') && ++consumerTransforms === 2) {
        throw new Error('Queued transform failed');
      }
      return transform(filename);
    };

    await expect(project.graph.initialTraverseDependencies(project.options)).rejects.toThrow('Queued transform failed');
    await project.graph.traverseDependencies([project.filename('Screen.js')], project.options);

    expect(project.code()).toContain('<_NativeText');
  });

  it.each([
    ['View', '<Text>{children}</Text>', false],
    ['Text', '<View>{children}</View>', true],
    ['View', 'children', true],
    ['Text', 'children', false],
    ['View', '<Unknown>{children}</Unknown>', false],
  ])('preserves an imported %s ancestor around %s', async (host, inner, optimized) => {
    const project = createGraph({
      'Screen.js': `import { Text } from 'react-native'; import { Wrapper } from './Wrapper'; export default () => <Wrapper><Text>Hello</Text></Wrapper>;`,
      'Wrapper.js': `import { ${host} } from 'react-native'; import { Inner } from './Inner'; export const Wrapper = ({ children }) => <${host}><Inner>{children}</Inner></${host}>;`,
      'Inner.js': `import { Text, View } from 'react-native'; export const Inner = ({ children }) => ${inner};`,
    });

    await project.graph.initialTraverseDependencies(project.options);

    expect(project.code()).toContain(optimized ? '<_NativeText' : '<Text>Hello</Text>');
  });

  it('resolves newly discovered ancestors in initial and incremental graphs', async () => {
    const sources = {
      'Screen.js': `import { Text } from 'react-native'; import { Shell } from './Shell'; import { Middle } from './Middle'; import { Pass } from './Pass'; export default () => <Shell><Middle><Pass><Text>Hello</Text></Pass></Middle></Shell>;`,
      'Shell.js': `import { View } from 'react-native'; export const Shell = ({ children }) => <View>{children}</View>;`,
      'Middle.js': `export const Middle = ({ children }) => children;`,
      'Pass.js': `export const Pass = ({ children }) => children;`,
    };
    const project = createGraph(sources);
    await project.graph.initialTraverseDependencies(project.options);

    expect(project.code()).toContain('<_NativeText');
    expect(project.transforms.get('Screen.js')).toBe(4);
    expect(project.transforms.get('Shell.js')).toBe(1);

    sources['Pass.js'] =
      `import { Text } from 'react-native'; export const Pass = ({ children }) => <Text>{children}</Text>;`;
    await project.graph.traverseDependencies([project.filename('Pass.js')], project.options);
    expect(project.code()).toContain('<Text>Hello</Text>');

    sources['Pass.js'] = `export const Pass = ({ children }) => children;`;
    const delta = await project.graph.traverseDependencies([project.filename('Pass.js')], project.options);
    expect(project.code()).toContain('<_NativeText');
    expect(delta.modified.has(project.filename('Screen.js'))).toBe(true);

    const count = project.transforms.get('Screen.js');
    await project.graph.traverseDependencies([project.filename('Shell.js')], project.options);
    expect(project.transforms.get('Screen.js')).toBe(count);
  });

  it('resolves consumers with an external entry', async () => {
    const sources = {
      '../entry.js': `import './app/Screen';`,
      'Screen.js': `import { Text } from 'react-native'; import { Card } from './Card'; export default () => <Card><Text>Hello</Text></Card>;`,
      'Card.js': `import { View } from 'react-native'; export const Card = ({ children }) => <View>{children}</View>;`,
    };
    const project = createGraph(sources, '../entry.js');
    await project.graph.initialTraverseDependencies(project.options);
    expect(project.code()).toContain('<_NativeText');

    sources['Card.js'] =
      `import { Text } from 'react-native'; export const Card = ({ children }) => <Text>{children}</Text>;`;
    const delta = await project.graph.traverseDependencies([project.filename('Card.js')], project.options);
    expect(project.code()).toContain('<Text>Hello</Text>');
    expect(delta.modified.has(project.filename('Screen.js'))).toBe(true);
  });

  it('updates an unchanged consumer in the same graph delta', async () => {
    const graphPath = requireFromTest.resolve('metro/private/DeltaBundler/Graph');
    const { Graph } = requireFromTest(graphPath) as {
      Graph: new (options: { entryPoints: Set<string>; transformOptions: { platform: string } }) => MetroGraph;
    };
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-boost-graph-'));
    temporaryDirectories.push(projectRoot);
    const consumerPath = path.join(projectRoot, 'Screen.js');
    const componentPath = path.join(projectRoot, 'Card.js');
    const snapshotPath = path.join(projectRoot, 'snapshot.json');
    const injectionId = 'metro-test';
    let componentSummary: 'safe' | 'text' = 'safe';
    const transforms = new Map<string, number>();

    installMetroGraphPatch(graphPath, { injectionId, snapshotPath });
    const graph = new Graph({ entryPoints: new Set([consumerPath]), transformOptions: { platform: 'ios' } });
    const options = {
      lazy: false,
      onProgress: null,
      shallow: false,
      resolve: () => ({ filePath: componentPath }),
      transform: async (filename: string) => {
        transforms.set(filename, (transforms.get(filename) ?? 0) + 1);
        const snapshot = fs.existsSync(snapshotPath) ? JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) : undefined;
        const resolved = snapshot?.platforms?.ios?.[consumerPath]?.['./Card']?.Card ?? 'unknown';
        return {
          dependencies:
            filename === consumerPath
              ? [
                  {
                    name: './Card',
                    data: {
                      key: './Card',
                      asyncType: null,
                      isESMImport: true,
                      isOptional: false,
                      locs: [],
                    },
                  },
                ]
              : [],
          output: [
            {
              type: 'js/module',
              data: {
                code: filename === consumerPath ? resolved : componentSummary,
                reactNativeBoost: {
                  injectionId,
                  analysis:
                    filename === consumerPath
                      ? {
                          exports: {},
                          exportAll: [],
                          references: [{ source: './Card', imported: 'Card' }],
                        }
                      : { exports: { Card: componentSummary }, exportAll: [], references: [] },
                },
              },
            },
          ],
          getSource: () => Buffer.alloc(0),
          unstable_transformResultKey: filename === componentPath ? `${filename}:${componentSummary}` : filename,
        };
      },
    };

    await graph.initialTraverseDependencies(options);

    expect(graph.dependencies.get(consumerPath)!.output[0].data.code).toBe('safe');
    expect(transforms.get(consumerPath)).toBe(2);
    expect(transforms.get(componentPath)).toBe(1);

    componentSummary = 'text';
    const delta = await graph.traverseDependencies([componentPath], options);

    expect(graph.dependencies.get(consumerPath)!.output[0].data.code).toBe('text');
    expect(delta.modified.has(consumerPath)).toBe(true);
    expect(delta.modified.has(componentPath)).toBe(true);
    expect(transforms.get(consumerPath)).toBe(3);
    expect(transforms.get(componentPath)).toBe(2);
  });
});

function createGraph(sources: Record<string, string>, entry = 'Screen.js') {
  const graphPath = requireFromTest.resolve('metro/private/DeltaBundler/Graph');
  const { Graph } = requireFromTest(graphPath) as {
    Graph: new (options: { entryPoints: Set<string>; transformOptions: { platform: string } }) => MetroGraph;
  };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-boost-graph-'));
  temporaryDirectories.push(directory);
  const projectRoot = path.join(directory, 'app');
  const snapshotPath = path.join(directory, 'snapshot.json');
  const injectionId = directory;
  const filename = (name: string) => path.resolve(projectRoot, name);
  const transforms = new Map<string, number>();
  installMetroGraphPatch(graphPath, { injectionId, snapshotPath });
  const graph = new Graph({ entryPoints: new Set([filename(entry)]), transformOptions: { platform: 'ios' } });
  const options = {
    lazy: false,
    onProgress: null,
    shallow: false,
    resolve: (origin: string, dependency: { name: string }) => ({
      filePath: path.resolve(path.dirname(origin), `${dependency.name}.js`),
    }),
    transform: async (absoluteFilename: string) => {
      const name = path.relative(projectRoot, absoluteFilename);
      transforms.set(name, (transforms.get(name) ?? 0) + 1);
      const source = sources[name]!;
      const result = transformSync(source, {
        filename: absoluteFilename,
        babelrc: false,
        configFile: false,
        ast: true,
        caller: { name: 'metro', platform: 'ios' } as TransformCaller,
        plugins: [
          '@babel/plugin-syntax-jsx',
          [
            boostPlugin,
            {
              logLevel: 'silent',
              target: { reactNative: { packageJson: requireFromTest.resolve('react-native/package.json') } },
              __reactNativeBoost: injectionId,
              __reactNativeBoostProjectRoot: projectRoot,
              __reactNativeBoostSnapshot: snapshotPath,
            },
          ],
        ],
      })!;
      const imports = result.ast!.program.body.filter(
        (statement): statement is t.ImportDeclaration =>
          t.isImportDeclaration(statement) && statement.source.value.startsWith('.')
      );
      return {
        dependencies: imports.map(({ source: { value: name } }) => ({
          name,
          data: { key: name, asyncType: null, isESMImport: true, isOptional: false, locs: [] },
        })),
        output: [{ type: 'js/module', data: { code: result.code!, ...result.metadata } }],
        getSource: () => Buffer.from(source),
        unstable_transformResultKey: source,
      };
    },
  };
  return {
    graph,
    options,
    transforms,
    filename,
    code: () => graph.dependencies.get(filename('Screen.js'))!.output[0].data.code,
  };
}

type MetroGraph = {
  dependencies: Map<string, { output: Array<{ data: { code: string } }> }>;
  initialTraverseDependencies: (options: unknown) => Promise<unknown>;
  traverseDependencies: (paths: string[], options: unknown) => Promise<{ modified: Map<string, unknown> }>;
};
