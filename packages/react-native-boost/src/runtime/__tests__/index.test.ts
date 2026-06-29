import { vi, describe, it, expect, afterEach } from 'vitest';
import {
  processTextStyle,
  processSelectionColor,
  processAccessibilityProps,
  processViewAccessibilityProps,
  processImageAccessibilityProps,
  getDefaultTextAccessible,
  clampNumberOfLines,
  userSelectToSelectableMap,
  verticalAlignToTextAlignVerticalMap,
} from '..';
import { Platform, TextStyle } from 'react-native';

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
  const Platform = {
    OS: 'ios' as 'ios' | 'android',
    select<T>(spec: Record<string, T>): T | undefined {
      return Platform.OS in spec ? spec[Platform.OS] : spec.default;
    },
  };
  return {
    View: () => 'View',
    Text: () => 'Text',
    Platform,
    StyleSheet: {
      flatten: (style: any) => style,
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

describe('processTextStyle', () => {
  it('returns empty object for falsy style', () => {
    expect(processTextStyle(null)).toEqual({});
    expect(processTextStyle()).toEqual({});
  });

  it('caches computed props', () => {
    const style = { color: 'red' };
    const result1 = processTextStyle(style);
    const result2 = processTextStyle(style);
    expect(result1).toBe(result2);
  });

  it('converts numeric fontWeight to string', () => {
    const style = { fontWeight: 400 } as const;
    const result = processTextStyle(style);
    expect(result.style).toBeDefined();
    expect(result.style).toBeInstanceOf(Object);
    expect((result.style as TextStyle).fontWeight).toBe('400');
  });

  it('maps userSelect to selectable and removes userSelect from style', () => {
    const style = { userSelect: 'none', color: 'blue' } as const;
    const result = processTextStyle(style);
    expect(result.selectable).toBe(userSelectToSelectableMap['none']);
    expect(result.style).toBeDefined();
    expect(result.style).toBeInstanceOf(Object);
    expect((result.style as TextStyle).userSelect).toBeUndefined();
    expect((result.style as TextStyle).color).toBe('blue');
  });

  it('maps verticalAlign to textAlignVertical and removes verticalAlign from style', () => {
    const style = { verticalAlign: 'top', fontSize: 16 } as const;
    const result = processTextStyle(style);
    expect(result.style).toBeDefined();
    expect(result.style).toBeInstanceOf(Object);
    expect((result.style as TextStyle).textAlignVertical).toBe(verticalAlignToTextAlignVerticalMap['top']);
    expect((result.style as TextStyle).verticalAlign).toBeUndefined();
  });

  it('handles combination of properties', () => {
    const style = {
      fontWeight: 700,
      userSelect: 'auto',
      verticalAlign: 'middle',
      margin: 10,
    } as const;
    const result = processTextStyle(style);
    expect(result.style).toBeDefined();
    expect(result.style).toBeInstanceOf(Object);
    expect((result.style as TextStyle).fontWeight).toBe('700');
    expect(result.selectable).toBe(userSelectToSelectableMap['auto']);
    expect((result.style as TextStyle).textAlignVertical).toBe(verticalAlignToTextAlignVerticalMap['middle']);
    expect((result.style as TextStyle).margin).toBe(10);
    expect((result.style as TextStyle).userSelect).toBeUndefined();
    expect((result.style as TextStyle).verticalAlign).toBeUndefined();
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

describe('processAccessibilityProps', () => {
  it('sets default accessible to true and has no accessibilityLabel if not provided', () => {
    const props = {};
    const normalized = processAccessibilityProps(props);
    expect(normalized.accessible).toBe(true);
    expect(normalized.accessibilityLabel).toBeUndefined();
    expect(normalized.accessibilityState).toBeUndefined();
  });

  it('defaults accessible to false on Android', () => {
    Platform.OS = 'android';
    expect(processAccessibilityProps({}).accessible).toBe(false);
  });

  it('merges accessibility labels using aria-label over accessibilityLabel', () => {
    const props = {
      'accessibilityLabel': 'Label one',
      'aria-label': 'Label two',
    };
    const normalized = processAccessibilityProps(props);
    expect(normalized.accessibilityLabel).toBe('Label two');
  });

  it('keeps accessibilityLabel if aria-label is not provided', () => {
    const props = {
      accessibilityLabel: 'Only label',
    };
    const normalized = processAccessibilityProps(props);
    expect(normalized.accessibilityLabel).toBe('Only label');
  });

  it('creates accessibilityState from ARIA properties when accessibilityState is not provided', () => {
    const props = {
      'aria-busy': true,
      'aria-disabled': false,
      'aria-selected': true,
    };
    const normalized = processAccessibilityProps(props);
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
    const normalized = processAccessibilityProps(props);
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
    const normalized = processAccessibilityProps(props);
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
    const normalized = processAccessibilityProps(props);
    expect(normalized.accessible).toBe(false);
  });

  it('derives disabled from accessibilityState.disabled when the disabled prop is absent', () => {
    const normalized = processAccessibilityProps({ accessibilityState: { disabled: true } });
    expect(normalized.disabled).toBe(true);
    expect(normalized.accessibilityState).toEqual({ disabled: true });
  });

  it('mirrors a standalone disabled prop into accessibilityState', () => {
    const normalized = processAccessibilityProps({ disabled: true });
    expect(normalized.disabled).toBe(true);
    expect(normalized.accessibilityState).toEqual({ disabled: true });
  });

  it('lets an explicit disabled prop win over accessibilityState.disabled', () => {
    const normalized = processAccessibilityProps({ disabled: true, accessibilityState: { disabled: false } });
    expect(normalized.disabled).toBe(true);
    expect(normalized.accessibilityState).toEqual({ disabled: true });
  });

  it('does not synthesize accessibilityState when disabled is false and state is absent', () => {
    const normalized = processAccessibilityProps({ disabled: false });
    expect(normalized.disabled).toBe(false);
    expect(normalized.accessibilityState).toBeUndefined();
  });

  it('translates aria-hidden true to accessibilityElementsHidden and importantForAccessibility', () => {
    const normalized = processAccessibilityProps({ 'aria-hidden': true });
    expect(normalized.accessibilityElementsHidden).toBe(true);
    expect(normalized.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('translates aria-hidden false without forcing importantForAccessibility', () => {
    const normalized = processAccessibilityProps({ 'aria-hidden': false });
    expect(normalized.accessibilityElementsHidden).toBe(false);
    expect(normalized.importantForAccessibility).toBeUndefined();
  });

  it('lets aria-hidden win over an explicit accessibilityElementsHidden', () => {
    const normalized = processAccessibilityProps({ 'aria-hidden': true, 'accessibilityElementsHidden': false });
    expect(normalized.accessibilityElementsHidden).toBe(true);
    expect(normalized.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('falls back to an explicit accessibilityElementsHidden when aria-hidden is absent', () => {
    const normalized = processAccessibilityProps({
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
