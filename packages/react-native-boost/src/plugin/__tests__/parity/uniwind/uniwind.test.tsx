import * as React from 'react';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { transformSync, type TransformCaller } from '@babel/core';
import boost from '../../../index';
import { renderAndCaptureAll } from '../capture';
import { normalize, normalizeImage } from '../normalize';
import { setPlatformOS } from '../mocks/Platform';
import * as optimized from '../../../../runtime/uniwind';

vi.mock('../../../../runtime/components/native-text', () =>
  import('../capture').then(({ NativeTextCapturer }) => ({ NativeText: NativeTextCapturer }))
);
vi.mock('../../../../runtime/components/native-view', () =>
  import('../capture').then(({ NativeViewCapturer }) => ({ NativeView: NativeViewCapturer }))
);
vi.mock('../../../../runtime/components/native-image', () =>
  import('../capture').then(({ NativeImageCapturer }) => ({ NativeImage: NativeImageCapturer }))
);
vi.mock('../../../../runtime/components/native-activity-indicator', () =>
  import('../capture').then(({ NativeActivityIndicatorCapturer }) => ({
    NativeActivityIndicator: NativeActivityIndicatorCapturer,
  }))
);

const require = createRequire(import.meta.url);
const root = join(dirname(require.resolve('uniwind/package.json')), 'src');
const load = (name: string) => import(/* @vite-ignore */ `${root}/${name}`);
const { UniwindStore } = await load('core/native/store.ts');
const { UniwindContext } = await load('core/context.ts');
const { StyleDependency } = await load('common/consts.ts');
const { default: View } = await load('components/native/View.tsx');
const { default: Text } = await load('components/native/Text.tsx');
const { default: Image } = await load('components/native/Image.tsx');
const { default: ActivityIndicator } = await load('components/native/ActivityIndicator.tsx');
const original = { NativeView: View, NativeText: Text, NativeImage: Image, NativeActivityIndicator: ActivityIndicator };
const style = (values: Record<string, unknown>, condition = {}) => ({
  entries: Object.entries(values).map(([key, value]) => [key, typeof value === 'function' ? value : () => value]),
  minWidth: 0,
  maxWidth: Infinity,
  theme: null,
  orientation: null,
  rtl: null,
  active: null,
  focus: null,
  disabled: null,
  dataAttributes: null,
  dependencies: null,
  importantProperties: [],
  complexity: 0,
  ...condition,
});
UniwindStore.reinit(
  () => ({
    vars: { '--color': () => 'red' },
    scopedVars: {},
    stylesheet: {
      box: [style({ width: 40, padding: 8 })],
      themed: [
        style({ backgroundColor: 'red' }),
        style({ backgroundColor: 'blue' }, { theme: 'dark', dependencies: [StyleDependency.Theme] }),
      ],
      variable: [
        style(
          { backgroundColor: (vars: Record<string, (argument: unknown) => unknown>) => vars['--color'](vars) },
          { dependencies: [StyleDependency.Variables] }
        ),
      ],
      selected: [style({ opacity: 0.5 }, { dataAttributes: { 'data-selected': 'true' } })],
      text: [
        style({
          fontWeight: 700,
          verticalAlign: 'middle',
          userSelect: 'none',
          WebkitLineClamp: 2,
          overflow: 'visible',
        }),
      ],
      disabled: [style({ color: 'blue' }, { disabled: true })],
      accent: [style({ accentColor: '#ff0000' })],
      image: [style({ objectFit: 'contain', width: 70 })],
    },
  }),
  ['light', 'dark']
);

const capture = (Component: React.ElementType, props: object) =>
  renderAndCaptureAll(React.createElement(Component, props)).map((item) => ({
    which: item.which,
    props: item.which === 'NativeImage' ? normalizeImage(item.props, 87) : normalize(item.props),
  }));
const generated = fileURLToPath(new URL('__generated__/', import.meta.url));
mkdirSync(generated, { recursive: true });
afterAll(() => rmSync(generated, { recursive: true, force: true }));
let sequence = 0;
async function compile(jsx: string, platform = 'ios', options = {}) {
  const result = transformSync(
    `import {useRef} from 'react'; import {View, Text, Image, ActivityIndicator, Animated, Platform, StyleSheet} from 'react-native'; export default () => (${jsx});`,
    {
      configFile: false,
      babelrc: false,
      filename: join(generated, 'input.jsx'),
      caller: { name: 'parity', platform } as TransformCaller,
      presets: [[require.resolve('@babel/preset-react'), { runtime: 'automatic' }]],
      plugins: [
        [
          boost,
          {
            logLevel: 'silent',
            integrations: { unistyles: 'off', uniwind: 'on' },
            target: { reactNative: { packageJson: require.resolve('react-native/package.json') } },
            assumptions: { unknownAncestorsDoNotRenderText: true },
            ...options,
          },
        ],
      ],
    }
  )!;
  const filename = join(generated, `case-${sequence++}.js`);
  writeFileSync(filename, result.code!);
  const { default: Component } = await import(/* @vite-ignore */ filename);
  return { code: result.code!, Component };
}

describe('free Uniwind native parity', () => {
  it.each([
    ['NativeView', { 'className': 'box selected', 'data-selected': true, 'style': { width: 20 }, 'aria-label': 'Box' }],
    [
      'NativeText',
      {
        className: 'text disabled',
        disabled: true,
        numberOfLines: 5,
        selectionColorClassName: 'accent',
        children: 'hello',
      },
    ],
    ['NativeText', { 'className': 'disabled', 'aria-disabled': true, 'selectionColor': null, 'children': 'hello' }],
    [
      'NativeImage',
      {
        source: { uri: 'logo.png', width: 20, height: 10 },
        className: 'image',
        tintColorClassName: 'accent',
        alt: 'Logo',
      },
    ],
    ['NativeActivityIndicator', { className: 'box', colorClassName: 'accent', color: null, size: 28 }],
    ['NativeActivityIndicator', { color: null }],
  ] as const)('%s preserves native props', (name, props) => {
    for (const platform of ['ios', 'android'] as const) {
      setPlatformOS(platform);
      expect(capture(optimized[name], props), platform).toEqual(capture(original[name], props));
    }
    setPlatformOS('ios');
  });

  it.each(['NativeView', 'NativeText', 'NativeImage', 'NativeActivityIndicator'] as const)(
    '%s preserves scoped themes, variables, and style precedence',
    (name) => {
      for (const context of [
        { scopedTheme: 'dark', rtl: null, variables: null },
        { scopedTheme: null, rtl: null, variables: { '--color': 'green' } },
      ]) {
        const props = { className: context.variables ? 'variable' : 'themed', style: { width: 22 } };
        const render = (Component: React.ElementType) =>
          capture(
            () => React.createElement(UniwindContext, { value: context }, React.createElement(Component, props)),
            {}
          );
        expect(render(optimized[name])).toEqual(render(original[name]));
        expect(render(optimized[name])[0].props.style.backgroundColor).toBe(context.variables ? '#008000' : 'blue');
      }
    }
  );

  it('compiles every native optimizer and retains generated class styles', async () => {
    const { code, Component } = await compile(
      '<View className="box"><Text className="text">hello</Text><Image className="image" source={{uri:"logo.png"}}/><ActivityIndicator className="box" colorClassName="accent"/></View>'
    );
    expect(code).toContain('react-native-boost/uniwind');
    for (const name of ['NativeView', 'NativeText', 'NativeImage', 'NativeActivityIndicator'])
      expect(code).toContain(name);
    const hosts = capture(Component, {});
    expect(hosts.map((host) => host.which)).toEqual([
      'NativeView',
      'NativeText',
      'NativeImage',
      'NativeView',
      'NativeActivityIndicator',
    ]);
    expect(hosts[0].props.style.width).toBe(40);
    expect(hosts[1].props.style.fontWeight).toBe('700');
    expect(hosts[1].props.numberOfLines).toBe(2);
    expect(hosts[2].props.resizeMode).toBe('contain');
    expect(hosts[2].props.style.width).toBe(70);
    expect(hosts[3].props.style.padding).toBe(8);
    expect(hosts[4].props.color).toBe('#ff0000');
  });

  it('retains wrappers for pressable Text and unsupported Image srcSet', async () => {
    const { code } = await compile(
      '<View><Text onPress={() => {}} className="text">hello</Text><Image srcSet="logo.png 2x" className="image"/></View>'
    );
    expect(code).not.toContain('NativeText');
    expect(code).not.toContain('NativeImage');
  });
});

it.each(['NativeView', 'NativeText', 'NativeImage', 'NativeActivityIndicator'] as const)(
  '%s updates mounted classes and theme subscriptions',
  async (name) => {
    const { act, create } = await import('react-test-renderer');
    const { UniwindListener } = await load('core/listener.ts');
    const { Uniwind } = await load('core/config/config.native.ts');
    const { captures } = await import('../capture');
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const Component of [original[name], optimized[name]]) {
        Uniwind.setTheme('light');
        let renderer: ReturnType<typeof create>;
        await act(() => {
          renderer = create(React.createElement(Component, { className: 'themed' }));
        });
        expect(normalize({ style: captures.at(-1)!.props.style }).style.backgroundColor).toBe(
          name === 'NativeActivityIndicator' ? undefined : 'red'
        );
        captures.length = 0;
        await act(() => {
          Uniwind.setTheme('dark');
        });
        expect(normalize({ style: captures[0].props.style }).style.backgroundColor).toBe('blue');
        await act(() => {
          renderer!.update(React.createElement(Component, { 'className': 'selected', 'data-selected': true }));
        });
        const selected = captures.slice(name === 'NativeActivityIndicator' ? -2 : -1)[0];
        expect(normalize({ style: selected.props.style }).style.opacity).toBe(0.5);
        captures.length = 0;
        await act(() => {
          renderer!.update(React.createElement(Component, { 'className': 'selected', 'data-selected': false }));
        });
        expect(normalize({ style: captures[0].props.style }).style.opacity).toBeUndefined();
        await act(() => {
          renderer!.unmount();
        });
        captures.length = 0;
        await act(() => {
          UniwindListener.notifyAll();
        });
        expect(captures).toEqual([]);
      }
    } finally {
      Uniwind.setTheme('light');
      const messages = warning.mock.calls.map(([message]) => String(message));
      warning.mockRestore();
      expect(
        messages.every(
          (message) =>
            message.startsWith('react-test-renderer is deprecated') ||
            message.startsWith('Detected multiple renderers concurrently rendering the same context provider')
        )
      ).toBe(true);
    }
  }
);

it('routes animation hooks missing from Uniwind through the native runtime', async () => {
  const { code } = await compile(
    '<View value={useRef(new Animated.ValueXY({x: 1, y: 2})).current} color={useRef(new Animated.Color("red")).current}/>'
  );
  expect(code).toMatch(/import[^;]*useAnimatedValueXY[^;]*from "react-native-boost\/uniwind"/);
  expect(code).toMatch(/import[^;]*useAnimatedColor[^;]*from "react-native-boost\/uniwind"/);
  expect(code).not.toContain('new Animated.');
});

it('retains classes when removing an eligible Animated wrapper', async () => {
  const { code, Component } = await compile('<Animated.View className="box"/>', 'ios', {
    optimizations: { 'animated-wrapper-removal': 'on' },
  });
  expect(code).toContain('NativeView');
  expect(code).not.toContain('_jsx(Animated.View');
  expect(capture(Component, {})[0].props.style.width).toBe(40);
});

it('combines platform and stylesheet transforms with class styles', async () => {
  const { code, Component } = await compile(
    '<View className="box" testID={Platform.OS} style={StyleSheet.compose({padding: 2}, {margin: 3})}/>'
  );
  expect(code).not.toContain('Platform.OS');
  expect(code).not.toContain('StyleSheet.compose(');
  expect(capture(Component, {})[0].props).toMatchObject({ testID: 'ios', style: { width: 40, padding: 2, margin: 3 } });
});

it('keeps the original Uniwind components on web', async () => {
  const { code } = await compile(
    '<View className="box"><Text className="text">hello</Text><Image className="image" source={{uri:"logo.png"}}/><ActivityIndicator colorClassName="accent"/></View>',
    'web'
  );
  expect(code).not.toContain('react-native-boost/');
  expect(code).toContain('className: "text"');
});
