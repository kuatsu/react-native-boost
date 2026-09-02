import { vi, describe, it, expect, afterEach } from 'vitest';
import {
  processTextStyle,
  processSelectionColor,
  processTextAccessibilityProps,
  processViewAccessibilityProps,
  processImageAccessibilityProps,
  processImageSourceProps,
  getDefaultTextAccessible,
  clampNumberOfLines,
  userSelectToSelectableMap,
  verticalAlignToTextAlignVerticalMap,
} from '..';
import { Platform, StyleSheet, TextStyle } from 'react-native';

vi.mock('../components/native-text', () => ({
  NativeText: () => 'MockedNativeText',
}));

vi.mock('../components/native-view', () => ({
  NativeView: () => 'MockedNativeView',
}));

vi.mock('../components/native-image', () => ({
  NativeImage: () => 'MockedNativeImage',
}));

// Switchable Platform mock so platform-specific defaults can be asserted for both OSes. `select`
// reads the live `OS`, mirroring react-native's own implementation; tests flip `Platform.OS` and the
// shared `afterEach` resets it.
vi.mock('react-native', () => {
  const flattenStyle = (style: unknown): unknown => {
    if (!Array.isArray(style)) return style;
    const result: Record<string, unknown> = {};
    for (const entry of style) {
      const flat = flattenStyle(entry);
      if (flat && typeof flat === 'object') Object.assign(result, flat);
    }
    return result;
  };
  const Platform = {
    OS: 'ios' as 'ios' | 'android',
    // Backs the runtime's wrapper-version gates. Defaults to the RN this repo builds against;
    // the version-dependent tests re-import this mock after `vi.resetModules()` and overwrite it.
    constants: { reactNativeVersion: { major: 0, minor: 86, patch: 0 } },
    select<T>(spec: Record<string, T>): T | undefined {
      return Platform.OS in spec ? spec[Platform.OS] : spec.default;
    },
  };
  return {
    View: () => 'View',
    Text: () => 'Text',
    Image: Object.assign(() => 'Image', {
      resolveAssetSource: <T>(source: T): T => source,
    }),
    Platform,
    StyleSheet: {
      flatten: flattenStyle,
    },
    // Distinguishable stand-in for RN's `processColor` so `processSelectionColor` can be asserted to
    // actually call it (a named color → packed int) rather than passing the value through unchanged.
    // `'invalid'` → `undefined` models RN rejecting an unparseable color.
    processColor: (color: unknown) => (color === 'red' ? 0xffff0000 : color === 'invalid' ? undefined : color),
  };
});

afterEach(() => {
  Platform.OS = 'ios';
});

type PlatformMock = { OS: string; constants?: { reactNativeVersion?: unknown } };

const DEFAULT_MOCK_RN_VERSION = { major: 0, minor: 86, patch: 0 };

/**
 * Reloads the runtime against a specific installed RN version, for the branches that mirror a
 * wrapper behavior that changed across the supported range. `vi.resetModules()` re-evaluates the
 * runtime (clearing its memoized version read) but NOT the `react-native` mock factory, so the mock
 * is mutated in place and restored by {@link restorePlatformMock}. Pass `undefined` to model a host
 * that exposes no version at all.
 */
const loadRuntime = async (minor: number | undefined, os: 'ios' | 'android' = 'android') => {
  vi.resetModules();
  const { Platform: platformMock } = (await import('react-native')) as unknown as { Platform: PlatformMock };
  platformMock.OS = os;
  platformMock.constants = minor === undefined ? undefined : { reactNativeVersion: { major: 0, minor, patch: 0 } };
  return await import('..');
};

const restorePlatformMock = async () => {
  const { Platform: platformMock } = (await import('react-native')) as unknown as { Platform: PlatformMock };
  platformMock.OS = 'ios';
  platformMock.constants = { reactNativeVersion: DEFAULT_MOCK_RN_VERSION };
  vi.resetModules();
};

describe('processTextStyle', () => {
  it('returns the RN 0.86 default style for falsy style', () => {
    expect(processTextStyle(null)).toEqual({ style: { overflow: 'hidden' } });
    expect(processTextStyle()).toEqual({ style: { overflow: 'hidden' } });
  });

  it('caches computed props', () => {
    const style = { color: 'red' };
    const result1 = processTextStyle(style);
    const result2 = processTextStyle(style);
    expect(result1).toBe(result2);
  });

  it('converts numeric fontWeight to string', () => {
    const style = { fontWeight: 400 } as const;
    const result = StyleSheet.flatten(processTextStyle(style).style) as TextStyle;
    expect(result.fontWeight).toBe('400');
  });

  it('maps userSelect to selectable and removes userSelect from style', () => {
    const style = { userSelect: 'none', color: 'blue' } as const;
    const result = processTextStyle(style);
    const resultStyle = StyleSheet.flatten(result.style) as TextStyle;
    expect(result.selectable).toBe(userSelectToSelectableMap['none']);
    expect(resultStyle.userSelect).toBeUndefined();
    expect(resultStyle.color).toBe('blue');
  });

  it('maps verticalAlign to textAlignVertical and removes verticalAlign from style', () => {
    const style = { verticalAlign: 'top', fontSize: 16 } as const;
    const result = StyleSheet.flatten(processTextStyle(style).style) as TextStyle;
    expect(result.textAlignVertical).toBe(verticalAlignToTextAlignVerticalMap['top']);
    expect(result.verticalAlign).toBeUndefined();
  });

  it('handles combination of properties', () => {
    const style = {
      fontWeight: 700,
      userSelect: 'auto',
      verticalAlign: 'middle',
      margin: 10,
    } as const;
    const result = processTextStyle(style);
    const resultStyle = StyleSheet.flatten(result.style) as TextStyle;
    expect(resultStyle.fontWeight).toBe('700');
    expect(result.selectable).toBe(userSelectToSelectableMap['auto']);
    expect(resultStyle.textAlignVertical).toBe(verticalAlignToTextAlignVerticalMap['middle']);
    expect(resultStyle.margin).toBe(10);
    expect(resultStyle.userSelect).toBeUndefined();
    expect(resultStyle.verticalAlign).toBeUndefined();
  });
});

describe('processSelectionColor', () => {
  it('omits the prop for null/undefined input', () => {
    expect(processSelectionColor(null)).toEqual({});
    expect(processSelectionColor(undefined)).toEqual({});
    expect(processSelectionColor()).toEqual({});
  });

  it('runs the value through processColor', () => {
    expect(processSelectionColor('red')).toEqual({ selectionColor: 0xffff0000 });
  });

  it('forwards the processColor result for an already-processed value', () => {
    expect(processSelectionColor(0x12345678)).toEqual({ selectionColor: 0x12345678 });
  });

  it('omits the prop when processColor rejects the value', () => {
    expect(processSelectionColor('invalid')).toEqual({});
  });
});

describe('getDefaultTextAccessible', () => {
  it('returns true on iOS', () => {
    Platform.OS = 'ios';
    expect(getDefaultTextAccessible()).toBe(true);
  });

  it('returns false on Android', () => {
    Platform.OS = 'android';
    expect(getDefaultTextAccessible()).toBe(false);
  });
});

describe('getDefaultTextStyle follows the installed RN version', () => {
  afterEach(restorePlatformMock);

  it.each([83, 84])('returns no default on RN 0.%i', async (minor) => {
    const runtime = await loadRuntime(minor);
    expect(runtime.getDefaultTextStyle()).toBeUndefined();
    expect(runtime.processTextStyle({ color: 'red' })).toEqual({ style: { color: 'red' } });
    expect(runtime.processTextStyle(null)).toEqual({});
  });

  it.each([85, 86, 87])('prepends overflow hidden on RN 0.%i', async (minor) => {
    const runtime = await loadRuntime(minor);
    expect(runtime.getDefaultTextStyle()).toEqual({ overflow: 'hidden' });
    expect(runtime.processTextStyle({ color: 'red' })).toEqual({
      style: [{ overflow: 'hidden' }, { color: 'red' }],
    });
    expect(runtime.processTextStyle(null)).toEqual({ style: { overflow: 'hidden' } });
  });

  it('uses the current default when the version cannot be read', async () => {
    const runtime = await loadRuntime(undefined);
    expect(runtime.getDefaultTextStyle()).toEqual({ overflow: 'hidden' });
  });

  it('keeps the user overflow value', async () => {
    const runtime = await loadRuntime(86);
    expect(StyleSheet.flatten([runtime.getDefaultTextStyle(), { overflow: 'visible' }])).toEqual({
      overflow: 'visible',
    });
  });
});

describe('processTextAccessibilityProps', () => {
  it('sets default accessible to true and has no accessibilityLabel if not provided', () => {
    const props = {};
    const normalized = processTextAccessibilityProps(props);
    expect(normalized.accessible).toBe(true);
    expect(normalized.accessibilityLabel).toBeUndefined();
    expect(normalized.accessibilityState).toBeUndefined();
  });

  it('defaults accessible to false on Android', () => {
    Platform.OS = 'android';
    expect(processTextAccessibilityProps({}).accessible).toBe(false);
  });

  it('merges accessibility labels using aria-label over accessibilityLabel', () => {
    const props = {
      'accessibilityLabel': 'Label one',
      'aria-label': 'Label two',
    };
    const normalized = processTextAccessibilityProps(props);
    expect(normalized.accessibilityLabel).toBe('Label two');
  });

  it('keeps accessibilityLabel if aria-label is not provided', () => {
    const props = {
      accessibilityLabel: 'Only label',
    };
    const normalized = processTextAccessibilityProps(props);
    expect(normalized.accessibilityLabel).toBe('Only label');
  });

  it('creates accessibilityState from ARIA properties when accessibilityState is not provided', () => {
    const props = {
      'aria-busy': true,
      'aria-disabled': false,
      'aria-selected': true,
    };
    const normalized = processTextAccessibilityProps(props);
    expect(normalized.accessibilityState).toEqual({
      busy: true,
      checked: undefined,
      disabled: false,
      expanded: undefined,
      selected: true,
    });
  });

  it('merges ARIA properties with existing accessibilityState', () => {
    const props = {
      'accessibilityState': { busy: false, checked: false },
      'aria-busy': true, // should override busy
      'aria-disabled': true, // new property
    };
    const normalized = processTextAccessibilityProps(props);
    expect(normalized.accessibilityState).toEqual({
      busy: true,
      checked: false,
      disabled: true,
      expanded: undefined,
      selected: undefined,
    });
  });

  it('retains additional properties', () => {
    const props = {
      'foo': 'bar',
      'aria-expanded': false,
    };
    const normalized = processTextAccessibilityProps(props);
    expect(normalized.foo).toBe('bar');
    expect(normalized.accessibilityState).toEqual({
      busy: undefined,
      checked: undefined,
      disabled: undefined,
      expanded: false,
      selected: undefined,
    });
  });

  it('uses provided accessible if it exists', () => {
    const props = {
      accessible: false,
    };
    const normalized = processTextAccessibilityProps(props);
    expect(normalized.accessible).toBe(false);
  });

  it('derives disabled from accessibilityState.disabled when the disabled prop is absent', () => {
    const normalized = processTextAccessibilityProps({ accessibilityState: { disabled: true } });
    expect(normalized.disabled).toBe(true);
    expect(normalized.accessibilityState).toEqual({ disabled: true });
  });

  it('mirrors a standalone disabled prop into accessibilityState', () => {
    const normalized = processTextAccessibilityProps({ disabled: true });
    expect(normalized.disabled).toBe(true);
    expect(normalized.accessibilityState).toEqual({ disabled: true });
  });

  it('lets an explicit disabled prop win over accessibilityState.disabled', () => {
    const normalized = processTextAccessibilityProps({ disabled: true, accessibilityState: { disabled: false } });
    expect(normalized.disabled).toBe(true);
    expect(normalized.accessibilityState).toEqual({ disabled: true });
  });

  it('does not synthesize accessibilityState when disabled is false and state is absent', () => {
    const normalized = processTextAccessibilityProps({ disabled: false });
    expect(normalized.disabled).toBe(false);
    expect(normalized.accessibilityState).toBeUndefined();
  });

  it('translates aria-hidden true to accessibilityElementsHidden and importantForAccessibility', () => {
    const normalized = processTextAccessibilityProps({ 'aria-hidden': true });
    expect(normalized.accessibilityElementsHidden).toBe(true);
    expect(normalized.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('translates aria-hidden false without forcing importantForAccessibility', () => {
    const normalized = processTextAccessibilityProps({ 'aria-hidden': false });
    expect(normalized.accessibilityElementsHidden).toBe(false);
    expect(normalized.importantForAccessibility).toBeUndefined();
  });

  it('lets aria-hidden win over an explicit accessibilityElementsHidden', () => {
    const normalized = processTextAccessibilityProps({ 'aria-hidden': true, 'accessibilityElementsHidden': false });
    expect(normalized.accessibilityElementsHidden).toBe(true);
    expect(normalized.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('falls back to an explicit accessibilityElementsHidden when aria-hidden is absent', () => {
    const normalized = processTextAccessibilityProps({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no',
    });
    expect(normalized.accessibilityElementsHidden).toBe(true);
    expect(normalized.importantForAccessibility).toBe('no');
  });
});

describe('processViewAccessibilityProps', () => {
  it('passes non-aria props through untouched', () => {
    const normalized = processViewAccessibilityProps({ testID: 'v', pointerEvents: 'none' });
    expect(normalized).toEqual({ testID: 'v', pointerEvents: 'none' });
  });

  it('translates aria-label to accessibilityLabel', () => {
    expect(processViewAccessibilityProps({ 'aria-label': 'hello' }).accessibilityLabel).toBe('hello');
  });

  it('splits aria-labelledby on commas into accessibilityLabelledBy', () => {
    expect(processViewAccessibilityProps({ 'aria-labelledby': 'a,  b , c' }).accessibilityLabelledBy).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('skips a null aria-labelledby instead of throwing (matches the wrapper)', () => {
    const normalized = processViewAccessibilityProps({ 'aria-labelledby': null });
    expect(normalized.accessibilityLabelledBy).toBeUndefined();
  });

  it('translates a dynamic tabIndex to focusable, omitting it when undefined', () => {
    expect(processViewAccessibilityProps({ tabIndex: 0 }).focusable).toBe(true);
    expect(processViewAccessibilityProps({ tabIndex: 2 }).focusable).toBe(false);
    expect('focusable' in processViewAccessibilityProps({ tabIndex: undefined })).toBe(false);
  });

  it('maps aria-live "off" to "none" and passes other values through', () => {
    expect(processViewAccessibilityProps({ 'aria-live': 'off' }).accessibilityLiveRegion).toBe('none');
    expect(processViewAccessibilityProps({ 'aria-live': 'polite' }).accessibilityLiveRegion).toBe('polite');
  });

  it('sets importantForAccessibility only when aria-hidden is strictly true', () => {
    const hidden = processViewAccessibilityProps({ 'aria-hidden': true });
    expect(hidden.accessibilityElementsHidden).toBe(true);
    expect(hidden.importantForAccessibility).toBe('no-hide-descendants');

    const notHidden = processViewAccessibilityProps({ 'aria-hidden': false });
    expect(notHidden.accessibilityElementsHidden).toBe(false);
    expect(notHidden.importantForAccessibility).toBeUndefined();

    const truthy = processViewAccessibilityProps({ 'aria-hidden': 1 });
    expect(truthy.accessibilityElementsHidden).toBe(1);
    expect(truthy.importantForAccessibility).toBeUndefined();
  });

  it('aggregates aria state fields into accessibilityState', () => {
    expect(processViewAccessibilityProps({ 'aria-busy': true, 'aria-disabled': false }).accessibilityState).toEqual({
      busy: true,
      checked: undefined,
      disabled: false,
      expanded: undefined,
      selected: undefined,
    });
  });

  it('merges aria state fields over a passed accessibilityState (aria wins)', () => {
    expect(
      processViewAccessibilityProps({ 'accessibilityState': { busy: false, checked: true }, 'aria-busy': true })
        .accessibilityState
    ).toEqual({ busy: true, checked: true, disabled: undefined, expanded: undefined, selected: undefined });
  });

  it('does not synthesize accessibilityState without a state field', () => {
    expect(processViewAccessibilityProps({ 'aria-label': 'x' }).accessibilityState).toBeUndefined();
  });

  it('rebuilds accessibilityState from a lone passed accessibilityState', () => {
    expect(processViewAccessibilityProps({ accessibilityState: { disabled: true } }).accessibilityState).toEqual({
      busy: undefined,
      checked: undefined,
      disabled: true,
      expanded: undefined,
      selected: undefined,
    });
  });

  it('aggregates aria value fields over a passed accessibilityValue (aria wins)', () => {
    expect(
      processViewAccessibilityProps({ 'accessibilityValue': { now: 1, min: 0 }, 'aria-valuenow': 5 }).accessibilityValue
    ).toEqual({ max: undefined, min: 0, now: 5, text: undefined });
  });

  it('does not reconcile disabled or apply an accessible default (unlike the Text helper)', () => {
    const normalized = processViewAccessibilityProps({ disabled: true });
    expect(normalized.disabled).toBe(true);
    expect(normalized.accessibilityState).toBeUndefined();
    expect('accessible' in normalized).toBe(false);
  });
});

describe('processImageAccessibilityProps', () => {
  it('uses alt as the fallback accessibilityLabel and forces accessible on', () => {
    expect(processImageAccessibilityProps({ alt: 'Logo', accessible: false })).toEqual({
      accessibilityLabel: 'Logo',
      accessible: true,
    });
  });

  it('keeps accessibilityLabel ahead of alt while still forcing accessible on', () => {
    expect(processImageAccessibilityProps({ alt: 'Logo', accessibilityLabel: 'Fallback' })).toEqual({
      accessibilityLabel: 'Fallback',
      accessible: true,
    });
  });

  it('lets aria-label win over accessibilityLabel and alt', () => {
    expect(
      processImageAccessibilityProps({
        'aria-label': 'ARIA',
        'accessibilityLabel': 'Fallback',
        'alt': 'Alt',
      }).accessibilityLabel
    ).toBe('ARIA');
  });

  it('falls back to explicit accessible when a dynamic alt is undefined', () => {
    expect(processImageAccessibilityProps({ alt: undefined, accessible: false }).accessible).toBe(false);
  });

  describe('Android null handling follows the installed RN version', () => {
    afterEach(restorePlatformMock);

    it.each([
      [84, { accessibilityLabel: 'Label', accessible: true }],
      [85, { accessibilityLabel: 'Label' }],
    ])('handles a null alt on RN 0.%i', async (minor, expected) => {
      const runtime = await loadRuntime(minor);
      expect(runtime.processImageAccessibilityProps({ 'alt': null, 'aria-label': 'Label' })).toEqual(expected);
    });

    it.each([
      [84, { accessible: null }],
      [85, {}],
    ])('handles a null accessible prop on RN 0.%i', async (minor, expected) => {
      const runtime = await loadRuntime(minor);
      expect(runtime.processImageAccessibilityProps({ accessible: null })).toEqual(expected);
    });
  });

  it('uses aria-hidden to force accessible off on iOS while preserving importantForAccessibility', () => {
    Platform.OS = 'ios';
    expect(
      processImageAccessibilityProps({
        'aria-hidden': true,
        'accessible': true,
        'importantForAccessibility': 'yes',
      })
    ).toEqual({
      accessible: false,
      importantForAccessibility: 'yes',
    });
  });

  it('uses aria-hidden to force importantForAccessibility on Android', () => {
    Platform.OS = 'android';
    expect(
      processImageAccessibilityProps({
        'aria-hidden': true,
        'accessible': true,
        'importantForAccessibility': 'yes',
      })
    ).toEqual({
      accessible: true,
      importantForAccessibility: 'no-hide-descendants',
    });
  });

  it('maps aria-labelledby to accessibilityLabelledBy on Android without splitting', () => {
    Platform.OS = 'android';
    expect(
      processImageAccessibilityProps({
        'aria-labelledby': 'a, b',
        'accessibilityLabelledBy': 'fallback',
      }).accessibilityLabelledBy
    ).toBe('a, b');
  });

  it('preserves explicit accessibilityState over aria state fields on iOS', () => {
    Platform.OS = 'ios';
    expect(
      processImageAccessibilityProps({
        'accessibilityState': { busy: false, checked: true },
        'aria-busy': true,
        'aria-disabled': false,
      }).accessibilityState
    ).toEqual({ busy: false, checked: true });
  });

  it('aggregates aria state fields over a passed accessibilityState on Android', () => {
    Platform.OS = 'android';
    expect(
      processImageAccessibilityProps({
        'accessibilityState': { busy: false, checked: true },
        'aria-busy': true,
        'aria-disabled': false,
      }).accessibilityState
    ).toEqual({
      busy: true,
      checked: true,
      disabled: false,
      expanded: undefined,
      selected: undefined,
    });
  });
});

describe('processImageSourceProps', () => {
  it('resolves object sources into native source/style/resize props', () => {
    expect(processImageSourceProps({ source: { uri: 'logo.png', width: 16, height: 8 } })).toEqual({
      style: [{ width: 16, height: 8 }, { overflow: 'hidden' }, undefined],
      source: [{ uri: 'logo.png', width: 16, height: 8 }],
      resizeMode: 'cover',
    });
  });

  it('keeps array sources as arrays and never synthesizes style dimensions on iOS', () => {
    expect(
      processImageSourceProps({
        source: [{ uri: 'logo.png', width: 16, height: 8 }],
        width: 20,
        height: 10,
      }).style
    ).toEqual([false, { overflow: 'hidden' }, undefined]);
  });

  it('propagates single-entry array source dimensions (not the props) into style on Android', () => {
    Platform.OS = 'android';
    expect(
      processImageSourceProps({
        source: [{ uri: 'logo.png', width: 16, height: 8 }],
        width: 20,
        height: 10,
      }).style
    ).toEqual([{ width: 16, height: 8 }, { overflow: 'hidden' }, undefined]);
    expect(
      processImageSourceProps({
        source: [
          { uri: 'logo.png', width: 16, height: 8 },
          { uri: 'logo@2x.png', width: 32, height: 16, scale: 2 },
        ],
      }).style
    ).toEqual([false, { overflow: 'hidden' }, undefined]);
  });

  it('synthesizes source (never the legacy src duplicate) and request headers on Android', () => {
    Platform.OS = 'android';
    const result = processImageSourceProps({
      src: 'https://example.com/logo.png',
      width: 16,
      height: 8,
      crossOrigin: 'use-credentials',
      referrerPolicy: 'origin',
    });
    expect(result).toMatchObject({
      source: [
        {
          uri: 'https://example.com/logo.png',
          headers: {
            'Access-Control-Allow-Credentials': 'true',
            'Referrer-Policy': 'origin',
          },
          width: 16,
          height: 8,
        },
      ],
      style: [{ width: 16, height: 8 }, { overflow: 'hidden' }, undefined],
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Referrer-Policy': 'origin',
      },
    });
    expect('src' in result).toBe(false);
  });

  it('derives resizeMode and iOS tintColor from dynamic style', () => {
    expect(
      processImageSourceProps({
        source: { uri: 'logo.png' },
        style: [{ objectFit: 'fill' }, { tintColor: 'red' }],
      })
    ).toMatchObject({
      resizeMode: 'stretch',
      tintColor: 'red',
    });
  });

  // RN's Android wrapper lifts a plain OBJECT source's inline `headers` onto the top-level `headers`
  // prop — the only prop Android reads for HTTP headers — on RN <= 0.84 and >= 0.87, but not on
  // 0.85/0.86 (react-native#55291 dropped it, react-native#56905 restored it). The runtime reads the
  // installed version once, so each case reloads it against a fresh mock.
  describe('object-source headers follow the installed RN version', () => {
    afterEach(restorePlatformMock);

    it.each([83, 84, 87, 88])('lifts them on RN 0.%i', async (minor) => {
      const runtime = await loadRuntime(minor);
      const source = { uri: 'logo.png', headers: { Authorization: 'Bearer object' } };
      expect(runtime.processImageSourceProps({ source }).headers).toEqual({ Authorization: 'Bearer object' });
      expect(runtime.processImageObjectSourceHeaders({ Authorization: 'Bearer object' })).toEqual({
        Authorization: 'Bearer object',
      });
    });

    it.each([85, 86])('drops them on RN 0.%i, matching the wrapper of that version', async (minor) => {
      const runtime = await loadRuntime(minor);
      const source = { uri: 'logo.png', headers: { Authorization: 'Bearer object' } };
      expect('headers' in runtime.processImageSourceProps({ source })).toBe(false);
      expect(runtime.processImageObjectSourceHeaders({ Authorization: 'Bearer object' })).toBeUndefined();
    });

    it('lifts them when the version cannot be read (the safe direction)', async () => {
      const runtime = await loadRuntime(undefined);
      expect(
        runtime.processImageSourceProps({ source: { uri: 'logo.png', headers: { Authorization: 'x' } } }).headers
      ).toEqual({ Authorization: 'x' });
    });

    // An ARRAY source's `source[0].headers` is lifted by every supported version, gate or not.
    it.each([84, 86, 87])('always lifts array-source headers on RN 0.%i', async (minor) => {
      const runtime = await loadRuntime(minor);
      expect(
        runtime.processImageSourceProps({ source: [{ uri: 'logo.png', headers: { Authorization: 'Bearer first' } }] })
          .headers
      ).toEqual({ Authorization: 'Bearer first' });
    });
  });

  // Propagating a single-entry ARRAY source's intrinsic dimensions into the layout style arrived as
  // an enabled-by-default behavior in RN 0.85 and is unconditional since 0.86.
  describe('array-source dimension propagation follows the installed RN version', () => {
    afterEach(restorePlatformMock);

    const source = [{ uri: 'logo.png', width: 16, height: 8 }];

    it.each([83, 84])('does not propagate on RN 0.%i', async (minor) => {
      const runtime = await loadRuntime(minor);
      expect(runtime.processImageSourceProps({ source }).style).toEqual([false, { overflow: 'hidden' }, undefined]);
      expect(runtime.processImageArraySourceDimensions({ width: 16, height: 8 })).toBeUndefined();
    });

    it.each([85, 86, 87])('propagates on RN 0.%i', async (minor) => {
      const runtime = await loadRuntime(minor);
      expect(runtime.processImageSourceProps({ source }).style).toEqual([
        { width: 16, height: 8 },
        { overflow: 'hidden' },
        undefined,
      ]);
      expect(runtime.processImageArraySourceDimensions({ width: 16, height: 8 })).toEqual({ width: 16, height: 8 });
    });
  });

  it('preserves Android tintColor wrapper semantics', () => {
    Platform.OS = 'android';
    expect(
      processImageSourceProps({
        source: { uri: 'logo.png' },
        style: { tintColor: 'red' },
      }).tintColor
    ).toBeUndefined();
    expect(processImageSourceProps({ source: { uri: 'logo.png' }, tintColor: null }).tintColor).toBeNull();
  });
});

describe('clampNumberOfLines', () => {
  it('clamps negative values to 0', () => {
    expect(clampNumberOfLines(-1)).toBe(0);
    expect(clampNumberOfLines(-10)).toBe(0);
  });

  it('clamps NaN to 0 (RN uses !(value >= 0))', () => {
    expect(clampNumberOfLines(Number.NaN)).toBe(0);
  });

  it('passes non-negative values through untouched', () => {
    expect(clampNumberOfLines(0)).toBe(0);
    expect(clampNumberOfLines(5)).toBe(5);
  });

  it('passes null/undefined through untouched (RN guards with != null)', () => {
    expect(clampNumberOfLines(null)).toBeNull();
    expect(clampNumberOfLines(undefined)).toBeUndefined();
  });
});
