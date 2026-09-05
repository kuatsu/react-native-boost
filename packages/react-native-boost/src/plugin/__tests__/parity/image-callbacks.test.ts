import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { transformSync, type TransformCaller } from '@babel/core';
import compiler from 'babel-plugin-react-compiler';
import { act, create as mount, type ReactTestRenderer } from 'react-test-renderer';
import { create, diff } from 'react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactNativeAttributePayload';
import boostPlugin from '../../index';
import { NativeImageCapturer, renderAndCaptureAll } from './capture';
import { captureBoostHosts } from './boost';
import { captureWrapperHosts } from './wrapper';
import { writeAndImportFresh } from './generated';
import { setPlatformOS } from './mocks/Platform';

vi.mock('../../../runtime/components/native-text', async () => {
  const { NativeTextCapturer } = await import('./capture');
  return { NativeText: NativeTextCapturer };
});
vi.mock('../../../runtime/components/native-view', async () => {
  const { NativeViewCapturer } = await import('./capture');
  return { NativeView: NativeViewCapturer };
});
vi.mock('../../../runtime/components/native-image', async () => {
  const { NativeImageCapturer } = await import('./capture');
  return { NativeImage: NativeImageCapturer };
});
vi.mock('../../../runtime/components/native-activity-indicator', async () => {
  const { NativeActivityIndicatorCapturer } = await import('./capture');
  return { NativeActivityIndicator: NativeActivityIndicatorCapturer };
});

afterEach(() => vi.unstubAllGlobals());
const callbacks = ['onLoadStart', 'onLoad', 'onLoadEnd', 'onError'];
const eventAttributes = Object.fromEntries([...callbacks, 'shouldNotifyLoadEvents'].map((name) => [name, true]));
const eventProps = (props: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(props).filter(([name]) => Object.hasOwn(eventAttributes, name)));

for (const platform of ['ios', 'android'] as const) {
  describe(`raw Image callbacks (${platform})`, () => {
    it.each([false, true])(
      'rejects parents that inspect or inject props, even on static images (compiler=%s)',
      (compile) => {
        for (const callback of ['', 'onLoad={() => {}}']) {
          const source = `import {cloneElement} from 'react'; import {Image} from 'react-native';
          const Parent = ({children}) => cloneElement(children, {onLoad: () => {}});
          export default function Case() { return <Parent><Image source={{uri:'logo.png'}} ${callback} /></Parent>; }`;
          const code = transformSync(source, {
            configFile: false,
            babelrc: false,
            filename: 'image-parent.jsx',
            caller: { name: 'metro', platform } as TransformCaller,
            presets: [['@babel/preset-react', { runtime: 'automatic' }]],
            plugins: [
              ...(compile ? [compiler] : []),
              [boostPlugin, { logLevel: 'silent', assumptions: { unknownAncestorsDoNotRenderText: true } }],
            ],
          })!.code!;
          expect(code).not.toContain('NativeImage');
        }
      }
    );

    it('keeps impure callback and source evaluation in order on the wrapper', async () => {
      setPlatformOS(platform);
      const state = { calls: [] as unknown[], handler: undefined as unknown };
      vi.stubGlobal('imageCallbackState', state);
      const source = `import {Image, View} from 'react-native';
        const handler = () => {}; globalThis.imageCallbackState.handler = handler;
        const mark = value => {globalThis.imageCallbackState.calls.push(value); return value};
        export default () => <View><Image source={(mark('source'), {uri:'logo.png'})}
          onLoad={mark('callback') && handler} testID={mark('testID')} />{mark('sibling') && null}</View>;`;
      for (const optimized of [false, true]) {
        let code = transformSync(source, {
          configFile: false,
          babelrc: false,
          filename: 'image-order.jsx',
          caller: { name: 'metro', platform } as TransformCaller,
          presets: [['@babel/preset-react', { runtime: 'automatic' }]],
          plugins: optimized ? [[boostPlugin, { logLevel: 'silent' }]] : [],
        })!.code!;
        expect(code).not.toContain('NativeImage');
        expect(code).toContain("import { Image, View } from 'react-native';");
        code = code.replace(
          "import { Image, View } from 'react-native';",
          `import Image from 'react-native/Libraries/Image/Image.${platform}'; import View from 'react-native/Libraries/Components/View/View';`
        );
        const { default: Case } = await writeAndImportFresh('image-order', code);
        state.calls.length = 0;
        const hosts = renderAndCaptureAll(createElement(Case));
        expect(state.calls).toStrictEqual(['source', 'callback', 'testID', 'sibling']);
        expect(hosts[1].props.onLoad).toBe(state.handler);
      }
    });

    it.each([
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ])('keeps function identity, own keys, and renderer patches (compiler=%s, spread=%s)', async (compile, spread) => {
      const state = { handler: undefined as unknown, events: [] as unknown[] };
      vi.stubGlobal('imageCallbackState', state);
      const preamble = `const load = event => globalThis.imageCallbackState.events.push(event);
        globalThis.imageCallbackState.handler = load;`;
      let previousExpected = {};
      let previousActual = {};
      for (const value of ['load', '() => {}', 'null', 'undefined']) {
        const source = spread ? "{...{source:{uri:'logo.png'}}}" : "source={{uri:'logo.png'}}";
        const jsx = `<View><Image ${source} ${callbacks.map((name) => `${name}={${value}}`).join(' ')} /></View>`;
        const expectedHosts = await captureWrapperHosts(platform, jsx, preamble);
        const expected = eventProps(expectedHosts[1].props);
        const expectedHandler = state.handler;
        const result = await captureBoostHosts(platform, jsx, preamble, false, compile);
        if (!result.optimized) throw new Error('Image must optimize');
        const actual = eventProps(result.hosts[1].props);
        expect(Object.keys(actual).sort()).toStrictEqual(Object.keys(expected).sort());
        for (const name of Object.keys(expected)) {
          if (typeof expected[name] === 'function') {
            expect(actual[name]).toBeTypeOf('function');
            if (value === 'load') {
              expect(expected[name]).toBe(expectedHandler);
              expect(actual[name]).toBe(state.handler);
              const event = { nativeEvent: { source: { uri: 'logo.png' }, target: 42 } };
              (actual[name] as (event: unknown) => void)(event);
              expect(state.events.at(-1)).toBe(event);
            }
          } else expect(actual[name]).toBe(expected[name]);
        }
        expect(create(actual, eventAttributes)).toStrictEqual(create(expected, eventAttributes));
        expect(diff(previousActual, actual, eventAttributes)).toStrictEqual(
          diff(previousExpected, expected, eventAttributes)
        );
        previousActual = actual;
        previousExpected = expected;
      }
    });

    it.each([false, true])(
      'updates and removes mounted JS handlers without wrapping them (compiler=%s)',
      async (compile) => {
        setPlatformOS(platform);
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        const state = { handler: undefined as unknown, events: [] as unknown[] };
        vi.stubGlobal('imageCallbackState', state);
        const results: Record<string, unknown>[][] = [];
        for (const optimized of [false, true]) {
          const source = `${
            optimized
              ? "import {Image, View} from 'react-native';"
              : `import Image from 'react-native/Libraries/Image/Image.${platform}'; import View from 'react-native/Libraries/Components/View/View';`
          }
          export default function Case({mode}) {
            const load = event => globalThis.imageCallbackState.events.push([mode, event]);
            globalThis.imageCallbackState.handler = load;
            return <View>{mode < 2 ? <Image source={{uri:'logo.png'}} onLoad={load} /> :
              mode === 2 ? <Image source={{uri:'logo.png'}} onLoad={null} /> :
              <Image source={{uri:'logo.png'}} />}</View>;
          }`;
          const code = transformSync(source, {
            configFile: false,
            babelrc: false,
            filename: 'image-mounted.jsx',
            caller: { name: 'metro', platform } as TransformCaller,
            presets: [['@babel/preset-react', { runtime: 'automatic' }]],
            plugins: [...(compile ? [compiler] : []), ...(optimized ? [[boostPlugin, { logLevel: 'silent' }]] : [])],
          })!.code!;
          if (optimized) {
            expect(code).toContain('NativeImage');
            expect(code).not.toContain('(Image,');
          }
          const module = await writeAndImportFresh('image-mounted', code);
          const Case = module.default as ComponentType<{ mode: number }>;
          let renderer: ReactTestRenderer;
          const sequence: Record<string, unknown>[] = [];
          await act(async () => {
            renderer = mount(createElement(Case, { mode: 0 }));
          });
          for (const mode of [0, 1, 2, 3]) {
            if (mode > 0)
              await act(async () => {
                renderer.update(createElement(Case, { mode }));
              });
            const props = renderer!.root.findByType(NativeImageCapturer).props;
            sequence.push(eventProps(props));
            if (mode < 2) {
              expect(props.onLoad).toBe(state.handler);
              const event = { nativeEvent: { target: 42 } };
              props.onLoad(event);
              expect(state.events.at(-1)).toStrictEqual([mode, event]);
            }
          }
          await act(async () => {
            renderer.unmount();
          });
          results.push(sequence);
        }
        for (let index = 0; index < results[0].length; index++) {
          const expected = results[0][index];
          const actual = results[1][index];
          expect(Object.keys(actual).sort()).toStrictEqual(Object.keys(expected).sort());
          expect(create(actual, eventAttributes)).toStrictEqual(create(expected, eventAttributes));
          if (index > 0)
            expect(diff(results[1][index - 1], actual, eventAttributes)).toStrictEqual(
              diff(results[0][index - 1], expected, eventAttributes)
            );
        }
      }
    );
  });
}
