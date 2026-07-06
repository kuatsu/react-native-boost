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

import { captureWrapper, captureWrapperHosts } from './wrapper';
import { captureBoost, boostOptimizes } from './boost';
import { normalize } from './normalize';

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
  // `aria-hidden` → accessibilityElementsHidden (+ importantForAccessibility when strictly true); the
  // last case has both present, so `aria-hidden` must win over the explicit `accessibilityElementsHidden`.
  '<Text aria-hidden>hello</Text>',
  '<Text aria-hidden={true}>hello</Text>',
  '<Text aria-hidden={false}>hello</Text>',
  '<Text aria-hidden accessibilityElementsHidden={false}>hello</Text>',
  '<Text style={{ color: "red" }}>hello</Text>', // styled, no a11y: `accessible` default must survive the build-time style
  '<Text style={null} adjustsFontSizeToFit={false}>hello</Text>',
  '<Text style={{ color: "red" }} accessibilityLabel="x">hello</Text>',
  // `selectionColor` runs through `processColor` (a non-identity mock packs "red" → an int), so both
  // sides must emit the packed value — proving Boost calls processColor, not a raw forward.
  '<Text selectionColor="red">hello</Text>',
  // Fully static styles are normalized at build time (object literal, no `processTextStyle`). Each
  // exercises a conversion the wrapper does at runtime; the flattened prop bags must still match.
  '<Text style={{ fontWeight: 700 }}>hello</Text>', // numeric fontWeight → string
  '<Text style={{ verticalAlign: "middle" }}>hello</Text>', // verticalAlign → textAlignVertical
  '<Text style={{ userSelect: "none", color: "red" }}>hello</Text>', // userSelect → selectable
  '<Text style={{ userSelect: "xyz", fontWeight: 400 }} selectable={true}>hello</Text>',
  '<Text style={[{ color: "red" }, { fontSize: 16 }]}>hello</Text>', // array merged (last wins)
  // `id` → `nativeID` build-time rename; `id` wins over an explicit `nativeID`.
  '<Text id="x">hello</Text>',
  '<Text id="x" nativeID="y">hello</Text>',
  '<Text nativeID="y">hello</Text>',
  // Bailed (deferred to the wrapper): `id`/`nativeID` via spread, and a dynamic `id` alongside `nativeID`.
  '<Text {...{ id: "x" }}>hello</Text>',
  '<Text id={dynamicId} nativeID="y">hello</Text>',
];

// Text cases Boost is expected to bail on. Asserting the bail explicitly stops an unexpected bailout —
// a silent loss of optimization — from masquerading as a passing parity test.
const BAILED_TEXT_CASES = new Set([
  '<Text {...{ id: "x" }}>hello</Text>',
  '<Text id={dynamicId} nativeID="y">hello</Text>',
]);

const VIEW_CASES = [
  '<View testID="v" />',
  '<View accessibilityRole="button" />',
  '<View accessibilityValue={{ now: 5 }} />',
  '<View pointerEvents="none" />',
  // `style` is an identity pass-through (the wrapper does no style work) → Boost optimizes and must
  // match the wrapper byte-for-byte across shapes.
  '<View style={{ width: 1 }} />',
  '<View style={[{ width: 1 }, { height: 2 }]} />',
  '<View style={{ width: 1 }} testID="v" pointerEvents="none" collapsable={false} />',
  // props the wrapper passes through untouched now optimize instead of bailing.
  '<View accessible />',
  '<View accessibilityLabel="x" />',
  '<View nativeID="x" />',
  '<View accessibilityState={{ disabled: true }} />',
  '<View accessible accessibilityLabel="x" testID="v" />',
  // `id` → `nativeID`; `id` wins over an explicit `nativeID`.
  '<View id="x" />',
  '<View id="x" nativeID="y" />',
  // ARIA cluster + `tabIndex` translated/aggregated to native props.
  '<View aria-label="x" />',
  '<View aria-label="x" accessibilityLabel="y" />', // collision: aria-label overwrites accessibilityLabel
  '<View aria-labelledby="a, b" />',
  '<View aria-live="off" />',
  '<View aria-live="polite" />',
  '<View aria-hidden={true} />',
  '<View aria-hidden={false} />',
  '<View tabIndex={0} />',
  '<View tabIndex={1} />',
  '<View aria-busy={true} />',
  '<View aria-checked={true} aria-disabled={false} aria-expanded={true} aria-selected={false} />',
  '<View accessibilityState={{ busy: true }} aria-disabled={true} />',
  '<View aria-valuenow={5} aria-valuemax={10} aria-valuemin={0} aria-valuetext="50%" />',
  '<View accessibilityValue={{ now: 1 }} aria-valuenow={5} />',
  '<View aria-hidden={true} aria-label="hello" tabIndex={0} aria-valuenow={5} aria-live="polite" />',
];

// View cases Boost is expected to bail on. Asserting the bail explicitly stops an unexpected bailout —
// a silent loss of optimization — from masquerading as a passing parity test.
const BAILED_VIEW_CASES = new Set(['<View {...{ id: "x" }} />', '<View id={dynamicId} nativeID="y" />']);

describe('differential parity', () => {
  describe.each(PLATFORMS)('Platform.OS=%s', (os) => {
    it.each(TEXT_CASES)('Text: %s', async (jsx) => {
      const boost = await captureBoost(os, jsx);
      expect(boost.optimized).toBe(!BAILED_TEXT_CASES.has(jsx));
      if (!boost.optimized) return; // bailed → defers to the wrapper, equivalent by construction
      const wrapper = await captureWrapper(os, jsx);
      expect(boost.which).toEqual(wrapper.which); // same native host kind
      expect(normalize(boost.props)).toEqual(normalize(wrapper.props));
    });

    it('Text: mixed dynamic style preserves userSelect flatten order', async () => {
      const jsx = '<Text style={[dynamicStyle, { userSelect: "text" }]} selectable={true}>hello</Text>';
      const preamble = 'const dynamicStyle = { userSelect: "none" };';
      const boost = await captureBoost(os, jsx, preamble);
      expect(boost.optimized).toBe(true);
      if (!boost.optimized) throw new Error('expected Text mixed style case to optimize');
      const wrapper = await captureWrapper(os, jsx, preamble);
      expect(boost.which).toEqual(wrapper.which);
      expect(normalize(boost.props)).toEqual(normalize(wrapper.props));
    });

    it('Text: invalid userSelect clobbers selectable with shadowed undefined', async () => {
      const jsx = '<Text style={{ userSelect: "xyz" }} selectable={true}>hello</Text>';
      const preamble = 'const undefined = true;';
      const boost = await captureBoost(os, jsx, preamble);
      expect(boost.optimized).toBe(true);
      if (!boost.optimized) throw new Error('expected Text shadowed undefined case to optimize');
      const wrapper = await captureWrapper(os, jsx, preamble);
      expect(boost.which).toEqual(wrapper.which);
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

    // A string-only `<Text>` nested under another `<Text>` is rendered by the wrapper as the inline
    // host `NativeVirtualText` (the outer provides `TextAncestorContext`), NOT `NativeText`. Optimizing
    // it (pre-fix) emits `NativeText` — a host-kind divergence. Boost must instead defer the whole
    // snippet to the wrapper. The wrapper-side render is the oracle proving the inner host kind; the
    // Boost-side compile check proves Boost no longer optimizes the nested inner.
    it('nested Text defers to the wrapper (inner host is NativeVirtualText)', async () => {
      const jsx = '<Text>Hello <Text>World</Text></Text>';
      const hosts = await captureWrapperHosts(os, jsx);
      expect(hosts.map((host) => host.which)).toEqual(['NativeText', 'NativeVirtualText']);
      expect(boostOptimizes(os, jsx)).toBe(false);
    });
  });
});
