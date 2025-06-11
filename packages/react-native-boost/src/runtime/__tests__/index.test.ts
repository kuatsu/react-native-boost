import { vi, describe, it, expect } from 'vitest';
import {
  processTextStyle,
  processAccessibilityProps,
  userSelectToSelectableMap,
  verticalAlignToTextAlignVerticalMap,
} from '..';

vi.mock('../components/native-text', () => ({
  NativeText: () => 'MockedNativeText',
}));

vi.mock('../components/native-view', () => ({
  NativeView: () => 'MockedNativeView',
}));

vi.mock('react-native', () => ({
  View: () => 'View',
  Text: () => 'Text',
  Platform: {
    OS: 'ios',
  },
}));

vi.mock('react-native/Libraries/StyleSheet/flattenStyle', () => ({
  default: (style: any) => style,
}));

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
    expect(result.style.fontWeight).toBe('400');
  });

  it('maps userSelect to selectable and removes userSelect from style', () => {
    const style = { userSelect: 'none', color: 'blue' } as const;
    const result = processTextStyle(style);
    expect(result.selectable).toBe(userSelectToSelectableMap['none']);
    expect(result.style.userSelect).toBeUndefined();
    expect(result.style.color).toBe('blue');
  });

  it('maps verticalAlign to textAlignVertical and removes verticalAlign from style', () => {
    const style = { verticalAlign: 'top', fontSize: 16 } as const;
    const result = processTextStyle(style);
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
    const result = processTextStyle(style);
    expect(result.style.fontWeight).toBe('700');
    expect(result.selectable).toBe(userSelectToSelectableMap['auto']);
    expect(result.style.textAlignVertical).toBe(verticalAlignToTextAlignVerticalMap['middle']);
    expect(result.style.margin).toBe(10);
    expect(result.style.userSelect).toBeUndefined();
    expect(result.style.verticalAlign).toBeUndefined();
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
});
