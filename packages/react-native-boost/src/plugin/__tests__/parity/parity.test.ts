import { describe, it, expect, vi } from 'vitest';

// Mock the runtime's host COMPONENTS to the shared capturers, keeping the real runtime HELPERS
// (`processAccessibilityProps` / `processTextStyle`) under test. This is also what stops
// native-text.tsx / native-view.tsx from running their CJS `require('react-native')` (see §4.5 of
// the implementation plan), which would otherwise pull raw Flow source into node.
vi.mock('../../../runtime/components/native-text', async () => ({
  NativeText: (await import('./capture')).NativeTextCapturer,
}));
vi.mock('../../../runtime/components/native-view', async () => ({
  NativeView: (await import('./capture')).NativeViewCapturer,
}));

import { captureWrapper } from './wrapper';
import { captureBoost } from './boost';

const PLATFORMS = ['ios', 'android'] as const;

// `<Text>` cases use a primitive child (string, number, or template literal) so they render to
// NativeText (not NativeVirtualText).
const TEXT_CASES = [
  '<Text>hello</Text>',
  '<Text>{42}</Text>',
  '<Text>{`a${1}`}</Text>',
  '<Text aria-label="x">hello</Text>',
  '<Text accessibilityLabel="x">hello</Text>',
  '<Text accessible={false}>hello</Text>',
  '<Text disabled={true}>hello</Text>',
  '<Text accessibilityState={{ disabled: true }}>hello</Text>',
  '<Text numberOfLines={2}>hello</Text>',
  '<Text aria-busy={true}>hello</Text>',
  '<Text style={{ color: "red" }}>hello</Text>', // styled, no a11y: `accessible` default must survive the style spread
  '<Text style={{ color: "red" }} accessibilityLabel="x">hello</Text>',
];

const VIEW_CASES = [
  '<View testID="v" />',
  '<View accessibilityRole="button" />',
  '<View accessibilityValue={{ now: 5 }} />',
  '<View pointerEvents="none" />',
  '<View aria-label="x" />', // blacklisted → Boost bails → defers to wrapper
  '<View tabIndex={0} />', //   blacklisted → Boost bails → defers to wrapper
  // `style` is an identity pass-through (the wrapper does no style work) → Boost optimizes and must
  // match the wrapper byte-for-byte across shapes.
  '<View style={{ width: 1 }} />',
  '<View style={[{ width: 1 }, { height: 2 }]} />',
  '<View style={{ width: 1 }} testID="v" pointerEvents="none" collapsable={false} />',
];

// Cases Boost is expected to bail on (blacklisted props). Asserting the bail explicitly stops an
// unexpected bailout — a silent loss of optimization — from masquerading as a passing parity test.
const BAILED_VIEW_CASES = new Set(['<View aria-label="x" />', '<View tabIndex={0} />']);

// Treat `undefined`-valued keys as absent and deep-clean nested objects (also drops function values
// such as event handlers) so the comparison is a clean structural prop-bag equality.
const normalize = (props: Record<string, unknown>) => JSON.parse(JSON.stringify(props));

describe('differential parity', () => {
  describe.each(PLATFORMS)('Platform.OS=%s', (os) => {
    it.each(TEXT_CASES)('Text: %s', async (jsx) => {
      const boost = await captureBoost(os, jsx);
      expect(boost.optimized).toBe(true); // every Text case here is expected to optimize
      if (!boost.optimized) return;
      const wrapper = await captureWrapper(os, jsx);
      expect(boost.which).toEqual(wrapper.which); // same native host kind
      expect(normalize(boost.props)).toEqual(normalize(wrapper.props));
    });

    it.each(VIEW_CASES)('View: %s', async (jsx) => {
      const boost = await captureBoost(os, jsx);
      expect(boost.optimized).toBe(!BAILED_VIEW_CASES.has(jsx));
      if (!boost.optimized) return; // bailed → defers to the wrapper, equivalent by construction
      const wrapper = await captureWrapper(os, jsx);
      expect(boost.which).toEqual(wrapper.which); // same native host kind
      expect(normalize(boost.props)).toEqual(normalize(wrapper.props));
    });
  });
});
