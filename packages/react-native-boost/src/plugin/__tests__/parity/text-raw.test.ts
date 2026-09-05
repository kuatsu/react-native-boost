import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import Text from 'react-native/Libraries/Text/Text';
import StyleSheet from 'react-native/Libraries/StyleSheet/StyleSheetExports';
import attributes from 'react-native/Libraries/Components/View/ReactNativeStyleAttributes';
import { create, diff } from 'react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactNativeAttributePayload';
import { processTextAccessibilityProps, processTextStyle } from '../../../runtime';
import { renderAndCaptureSingle } from './capture';
import { captureBoostHosts } from './boost';
import { captureWrapper, captureWrapperHosts } from './wrapper';
import { reactNativeVersion, setPlatformOS } from './mocks/Platform';

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

const originalAttributes = { ...attributes };
afterEach(() => Object.assign(attributes, originalAttributes));
const wrapper = (props: Record<string, unknown>) => renderAndCaptureSingle(createElement(Text, props, 'label')).props;

for (const platform of ['ios', 'android'] as const) {
  describe(`raw Text parity (${platform})`, () => {
    it('keeps literal spread string whitespace and entities', async () => {
      for (const component of ['Text', 'View']) {
        const jsx = `<${component} {...{id:"a\\n b &amp;", testID:"a\\n b &amp;"}} />`;
        const expected = await captureWrapperHosts(platform, jsx);
        const result = await captureBoostHosts(platform, jsx);
        if (!result.optimized) throw new Error(`${component} must optimize`);
        expect(result.hosts[0].props.nativeID).toBe(expected[0].props.nativeID);
        expect(result.hosts[0].props.testID).toBe(expected[0].props.testID);
      }
    });

    it.each([false, true])(
      'preserves literal spread host payloads and preprocessing (compiler=%s)',
      async (compile) => {
        const observations: unknown[] = [];
        for (const key of ['color', 'fontWeight', 'userSelect', 'opacity']) {
          StyleSheet.setStyleAttributePreprocessor(key, (value) => {
            observations.push([key, value]);
            return `${key}:${String(value)}:${observations.length}`;
          });
        }
        const validAttributes = {
          style: attributes,
          nativeID: true,
          selectable: true,
          accessibilityState: { busy: true, checked: true, disabled: true, expanded: true, selected: true },
          animating: true,
          size: true,
          source: true,
          resizeMode: true,
        };
        for (const component of ['Text', 'View', 'Image', 'ActivityIndicator']) {
          let previousExpected = {};
          let previousActual = {};
          for (const color of ['red', 'blue']) {
            const props =
              component === 'Text'
                ? `id:"winner", disabled:false, accessibilityState:{disabled:true}, style:[{color:"${color}",fontWeight:400},{fontWeight:700,userSelect:"text"}]`
                : component === 'Image'
                  ? `source:{uri:"logo.png",width:20,height:30}, style:[{opacity:0.2},{opacity:0.8}]`
                  : component === 'ActivityIndicator'
                    ? `size:"large", animating:false, style:[{opacity:0.2},{opacity:0.8}]`
                    : `id:"winner", style:[{opacity:0.2},{opacity:0.8}]`;
            const jsx = `<${component} {...{${props}}} />`;
            const expected = await captureWrapperHosts(platform, jsx);
            const result = await captureBoostHosts(platform, jsx, '', true, compile);
            expect(result.optimized).toBe(true);
            if (!result.optimized) throw new Error(`${component} must optimize`);
            expect(result.hosts.length).toBe(expected.length);
            for (let index = 0; index < expected.length; index++) {
              const expectedProps = expected[index].props;
              const actualProps = result.hosts[index].props;
              expect(actualProps.style).toStrictEqual(expectedProps.style);
              if (component === 'Text')
                expect(actualProps.accessibilityState).toStrictEqual(expectedProps.accessibilityState);
              observations.length = 0;
              const expectedPayload = create(expectedProps, validAttributes);
              const expectedCalls = [...observations];
              observations.length = 0;
              expect(create(actualProps, validAttributes)).toStrictEqual(expectedPayload);
              expect(observations).toStrictEqual(expectedCalls);
              observations.length = 0;
              const patch = diff(previousExpected, expectedProps, validAttributes);
              const updateCalls = [...observations];
              observations.length = 0;
              expect(diff(previousActual, actualProps, validAttributes)).toStrictEqual(patch);
              expect(observations).toStrictEqual(updateCalls);
              previousExpected = expectedProps;
              previousActual = actualProps;
            }
          }
        }
      }
    );

    it.each([null, undefined, false, true])('preserves aria-hidden %s and native own keys', (hidden) => {
      setPlatformOS(platform);
      const props = { 'aria-hidden': hidden, 'accessibilityElementsHidden': true, 'importantForAccessibility': null };
      const expected = wrapper(props);
      const actual = processTextAccessibilityProps(props);
      for (const key of [
        'accessibilityElementsHidden',
        'importantForAccessibility',
        'accessibilityLabel',
        'accessibilityState',
      ]) {
        expect(Object.hasOwn(actual, key), key).toBe(Object.hasOwn(expected, key));
        expect(actual[key], key).toBe(expected[key]);
      }
    });

    it('reconciles shared state in place across renders and preserves ARIA copy boundaries', () => {
      setPlatformOS(platform);
      for (const aria of [{}, { 'aria-busy': true }]) {
        const expectedState = { disabled: true };
        const actualState = { disabled: true };
        for (const disabled of [false, true, undefined]) {
          const expected = wrapper({ accessibilityState: expectedState, disabled, ...aria });
          const actual = processTextAccessibilityProps({ accessibilityState: actualState, disabled, ...aria });
          expect(actualState).toStrictEqual(expectedState);
          expect(actual.accessibilityState === actualState).toBe(expected.accessibilityState === expectedState);
          expect(actual.accessibilityState).toStrictEqual(expected.accessibilityState);
          expect(actual.disabled).toBe(expected.disabled);
        }
      }
    });

    it('throws for a frozen conflicting state, but not an ARIA-created copy', () => {
      setPlatformOS(platform);
      const state = Object.freeze({ disabled: true });
      if (reactNativeVersion.minor >= 85) {
        expect(() => wrapper({ accessibilityState: state, disabled: false })).toThrow(TypeError);
        expect(() => processTextAccessibilityProps({ accessibilityState: state, disabled: false })).toThrow(TypeError);
      } else {
        expect(
          processTextAccessibilityProps({ accessibilityState: state, disabled: false }).accessibilityState
        ).toStrictEqual(wrapper({ accessibilityState: state, disabled: false }).accessibilityState);
      }
      const props = { 'accessibilityState': state, 'disabled': false, 'aria-busy': true };
      expect(processTextAccessibilityProps(props).accessibilityState).toStrictEqual(wrapper(props).accessibilityState);
    });

    it('keeps style identity, undefined override keys, and reads mutations on each call', () => {
      setPlatformOS(platform);
      const style = [{ color: 'red', fontWeight: 400, userSelect: 'none', verticalAlign: 'middle' }];
      for (const weight of [400, 700]) {
        style[0].fontWeight = weight;
        const expected = wrapper({ style });
        const actual = processTextStyle(style as never);
        expect(actual.style).toStrictEqual(expected.style);
        const normalized = reactNativeVersion.minor >= 85 ? (actual.style as unknown[])[1] : actual.style;
        expect((normalized as unknown[])[0]).toBe(style);
        expect(actual.selectable).toBe(expected.selectable);
      }
      const plain = [{ color: 'red' }, { color: 'blue' }];
      const actual = processTextStyle(plain).style;
      expect(reactNativeVersion.minor >= 85 ? (actual as unknown[])[1] : actual).toBe(plain);
    });

    it.each(['', 'style=""', 'style={null}', 'style={false}', 'style={undefined}'])(
      'keeps empty style shape: %s',
      async (attribute) => {
        const jsx = `<Text ${attribute}>label</Text>`;
        const { props: expected } = await captureWrapper(platform, jsx);
        const result = await captureBoostHosts(platform, jsx);
        if (!result.optimized) throw new Error('Text must stay optimized');
        expect(result.hosts[0].props.style).toStrictEqual(expected.style);
      }
    );

    it.each([false, true])(
      'does not move caller-state mutation before sibling JSX evaluation (compiler=%s)',
      async (compile) => {
        const preamble = 'const state = {disabled:true};';
        const jsx =
          '<View><Text accessibilityState={state} disabled={false}>first</Text><Text testID={String(state.disabled)}>second</Text></View>';
        const expected = await captureWrapperHosts(platform, jsx, preamble);
        const result = await captureBoostHosts(platform, jsx, preamble, true, compile);
        if (!result.optimized) throw new Error('The safe sibling must stay optimized');
        expect(result.hosts[2].props.testID).toBe(expected[2].props.testID);
        expect(result.hosts[1].props.accessibilityState).toStrictEqual(expected[1].props.accessibilityState);
      }
    );

    it('observes late preprocessor replacement and exceptions on raw numeric weights', async () => {
      const jsx = '<Text style={{fontWeight: 400}}>label</Text>';
      const { props: expected } = await captureWrapper(platform, jsx);
      const result = await captureBoostHosts(platform, jsx);
      if (!result.optimized) throw new Error('Text must stay optimized');
      const actual = result.hosts[0].props;
      const validAttributes = { style: attributes };
      for (const replacement of ['first', 'second']) {
        const calls: unknown[] = [];
        StyleSheet.setStyleAttributePreprocessor('fontWeight', (value) => {
          calls.push(value);
          return `${replacement}:${String(value)}`;
        });
        const expectedPayload = create(expected, validAttributes);
        expect(calls).toStrictEqual([400, '400']);
        calls.length = 0;
        expect(create(actual, validAttributes)).toStrictEqual(expectedPayload);
        expect(calls).toStrictEqual([400, '400']);
      }
      StyleSheet.setStyleAttributePreprocessor('fontWeight', (value) => {
        if (typeof value === 'number') throw new Error('raw weight');
        return value;
      });
      expect(() => create(expected, validAttributes)).toThrow('raw weight');
      expect(() => create(actual, validAttributes)).toThrow('raw weight');
    });

    for (const dynamic of [false, true]) {
      for (const compile of [false, true]) {
        it(`preserves renderer preprocessing and update patches (dynamic=${dynamic}, compiler=${compile})`, async () => {
          const observations: unknown[] = [];
          for (const key of ['color', 'fontWeight', 'userSelect', 'verticalAlign', 'textAlignVertical', 'opacity']) {
            StyleSheet.setStyleAttributePreprocessor(key, (value: unknown) => {
              observations.push([key, value]);
              return `${key}:${String(value)}:${observations.length}`;
            });
          }
          const validAttributes = { style: attributes, selectable: true };
          let previousExpected = {};
          let previousActual = {};
          const styles = [
            '[{color:"red", opacity:0.2}, {color:"blue", opacity:0.8}]',
            '[{color:"green", opacity:0.4}, {color:"blue", opacity:0.8}]',
            '[{fontWeight:400,userSelect:"none",verticalAlign:"middle"},{color:"red"}]',
            '[{fontWeight:700,userSelect:"text",verticalAlign:"top"},{color:null}]',
            '[{color:"red"}, {color:undefined}]',
            '[{color:"red"}, false]',
            '{color:"blue",userSelect:null,verticalAlign:null}',
            'null',
          ];
          for (const style of styles) {
            const preamble = dynamic ? `const input = ${style};` : '';
            const jsx = `<Text style={${dynamic ? 'input' : style}}>label</Text>`;
            const { props: expected } = await captureWrapper(platform, jsx, preamble);
            const result = await captureBoostHosts(platform, jsx, preamble, true, compile);
            expect(result.optimized).toBe(true);
            if (!result.optimized) throw new Error('Text must stay optimized');
            const actual = result.hosts[0].props;
            observations.length = 0;
            const expectedCreate = create(expected, validAttributes);
            const expectedCalls = [...observations];
            observations.length = 0;
            expect(create(actual, validAttributes)).toStrictEqual(expectedCreate);
            expect(observations).toStrictEqual(expectedCalls);
            observations.length = 0;
            const expectedPatch = diff(previousExpected, expected, validAttributes);
            const expectedUpdateCalls = [...observations];
            observations.length = 0;
            expect(diff(previousActual, actual, validAttributes)).toStrictEqual(expectedPatch);
            expect(observations).toStrictEqual(expectedUpdateCalls);
            expect(actual.style).toStrictEqual(expected.style);
            previousExpected = expected;
            previousActual = actual;
          }
        });
      }
    }
  });
}
