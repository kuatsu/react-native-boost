import { vi, describe, it, expect } from 'vitest';

vi.mock('react-native/Libraries/StyleSheet/flattenStyle', () => ({
  default: (style: any) => style,
}));

import {
  flattenTextStyle,
  normalizeAccessibilityProperties,
  userSelectToSelectableMap,
  verticalAlignToTextAlignVerticalMap,
} from '..';

describe('flattenTextStyle', () => {
  it('returns empty object for falsy style', () => {
    expect(flattenTextStyle(null)).toEqual({});
    expect(flattenTextStyle()).toEqual({});
  });

  it('caches computed props', () => {
    const style = { color: 'red' };
    const result1 = flattenTextStyle(style);
    const result2 = flattenTextStyle(style);
    expect(result1).toBe(result2);
  });

  it('converts numeric fontWeight to string', () => {
    const style = { fontWeight: 400 } as const;
    const result = flattenTextStyle(style);
    expect(result.style.fontWeight).toBe('400');
  });

  it('maps userSelect to selectable and removes userSelect from style', () => {
    const style = { userSelect: 'none', color: 'blue' } as const;
    const result = flattenTextStyle(style);
    expect(result.selectable).toBe(userSelectToSelectableMap['none']);
    expect(result.style.userSelect).toBeUndefined();
    expect(result.style.color).toBe('blue');
  });

  it('maps verticalAlign to textAlignVertical and removes verticalAlign from style', () => {
    const style = { verticalAlign: 'top', fontSize: 16 } as const;
    const result = flattenTextStyle(style);
    expect(result.style.textAlignVertical).toBe(verticalAlignToTextAlignVerticalMap['top']);
    expect(result.style.verticalAlign).toBeUndefined();
  });

  it('handles combination of properties', () => {
    const style = {
      fontWeight: 700,
      userSelect: 'auto',
      verticalAlign: 'middle',
      margin: 10,
    } as const;
    const result = flattenTextStyle(style);
    expect(result.style.fontWeight).toBe('700');
    expect(result.selectable).toBe(userSelectToSelectableMap['auto']);
    expect(result.style.textAlignVertical).toBe(verticalAlignToTextAlignVerticalMap['middle']);
    expect(result.style.margin).toBe(10);
    expect(result.style.userSelect).toBeUndefined();
    expect(result.style.verticalAlign).toBeUndefined();
  });
});

describe('normalizeAccessibilityProperties', () => {
  it('sets default accessible to true and has no accessibilityLabel if not provided', () => {
    const props = {};
    const normalized = normalizeAccessibilityProperties(props);
    expect(normalized.accessible).toBe(true);
    expect(normalized.accessibilityLabel).toBeUndefined();
    expect(normalized.accessibilityState).toBeUndefined();
  });

  it('merges accessibility labels using aria-label over accessibilityLabel', () => {
    const props = {
      'accessibilityLabel': 'Label one',
      'aria-label': 'Label two',
    };
    const normalized = normalizeAccessibilityProperties(props);
    expect(normalized.accessibilityLabel).toBe('Label two');
  });

  it('keeps accessibilityLabel if aria-label is not provided', () => {
    const props = {
      accessibilityLabel: 'Only label',
    };
    const normalized = normalizeAccessibilityProperties(props);
    expect(normalized.accessibilityLabel).toBe('Only label');
  });

  it('creates accessibilityState from ARIA properties when accessibilityState is not provided', () => {
    const props = {
      'aria-busy': true,
      'aria-disabled': false,
      'aria-selected': true,
    };
    const normalized = normalizeAccessibilityProperties(props);
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
    const normalized = normalizeAccessibilityProperties(props);
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
    const normalized = normalizeAccessibilityProperties(props);
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
    const normalized = normalizeAccessibilityProperties(props);
    expect(normalized.accessible).toBe(false);
  });
});
