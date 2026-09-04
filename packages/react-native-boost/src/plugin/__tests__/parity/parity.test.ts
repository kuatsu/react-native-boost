import { describe, it, expect, vi } from 'vitest';

// Mock the runtime's host COMPONENTS to the shared capturers, keeping the real runtime HELPERS
// (`processTextAccessibilityProps` / `processTextStyle`) under test. This is also what stops
// native-text.tsx / native-view.tsx from running their CJS `require('react-native')` (see §4.5 of
// the implementation plan), which would otherwise pull raw Flow source into node.
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

import { captureWrapper, captureWrapperHosts } from './wrapper';
import { captureBoost, captureBoostHosts, boostOptimizes, boostUsesRuntimeSelectionColor } from './boost';
import { reactNativeVersion } from './mocks/Platform';
import { normalize, normalizeImage } from './normalize';

const PLATFORMS = ['ios', 'android'] as const;
const REACT_NATIVE_MINOR = reactNativeVersion.minor;

const STATIC_SELECTION_COLOR_CASES = [
  '<Text selectionColor="red">hello</Text>',
  '<Text selectionColor="transparent">hello</Text>',
  '<Text selectionColor="#f00">hello</Text>',
  '<Text selectionColor="#66339980">hello</Text>',
  '<Text selectionColor="rebeccapurple">hello</Text>',
  '<Text selectionColor="rgb(102, 51, 153)">hello</Text>',
  '<Text selectionColor="rgb(102 51 153 / 0.5)">hello</Text>',
  '<Text selectionColor="rgb(102, 51, 153, 0.5)">hello</Text>',
  '<Text selectionColor="rgba(102, 51, 153)">hello</Text>',
  '<Text selectionColor="hsl(270, 50%, 40%)">hello</Text>',
  '<Text selectionColor="hwb(270 20% 40% / 0.5)">hello</Text>',
  '<Text selectionColor={0x663399ff}>hello</Text>',
  '<Text selectionColor="invalid">hello</Text>',
  '<Text selectionColor={null}>hello</Text>',
  '<Text selectionColor>hello</Text>',
];

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
  // RN 0.85+ prepends `overflow: 'hidden'`, so the user's own overflow must win.
  '<Text style={{ overflow: "visible" }}>hello</Text>',
  '<Text style={{ color: "red" }} accessibilityLabel="x">hello</Text>',
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

const ANIMATED_WRAPPER_REMOVAL_CASES = [
  '<Animated.View testID="card" style={[{ width: 12, opacity: 1 }, null, { opacity: 0.5 }]} />',
  '<Animated.Text style={[{ fontWeight: 700 }, { verticalAlign: "middle" }]}>hello</Animated.Text>',
];

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
  '<View {...{ id: "x" }} />',
  '<View id={dynamicId} nativeID="y" />',
];

// View cases Boost is expected to bail on. Asserting the bail explicitly stops an unexpected bailout —
// a silent loss of optimization — from masquerading as a passing parity test.
const BAILED_VIEW_CASES = new Set(['<View {...{ id: "x" }} />', '<View id={dynamicId} nativeID="y" />']);

const ACTIVITY_INDICATOR_CASES: Array<[string, string?]> = [
  ['<ActivityIndicator />'],
  ['<ActivityIndicator animating={false} />'],
  ['<ActivityIndicator animating={null} color={null} hidesWhenStopped={null} size={null} />'],
  ['<ActivityIndicator color="red" hidesWhenStopped={false} />'],
  ['<ActivityIndicator size="large" />'],
  ['<ActivityIndicator size={24} />'],
  ['<ActivityIndicator style={{ margin: 4 }} />'],
  ['<ActivityIndicator onLayout={() => {}} testID="spinner" accessibilityLabel="Loading" />'],
  ['<ActivityIndicator key="spinner" size="small" style={false} />'],
  [
    '<ActivityIndicator animating={animating} color={color} hidesWhenStopped={hides} size={size} style={style} />',
    'const animating = undefined; const color = undefined; const hides = undefined; const size = 28; const style = { margin: 3 };',
  ],
  ['<ActivityIndicator {...{ size: "large" }} />'],
  ['<ActivityIndicator>child</ActivityIndicator>'],
  ['<Text><ActivityIndicator /></Text>'],
];

const BAILED_ACTIVITY_INDICATOR_CASES = new Set([
  '<ActivityIndicator {...{ size: "large" }} />',
  '<ActivityIndicator>child</ActivityIndicator>',
  '<Text><ActivityIndicator /></Text>',
]);

const IMAGE_CASES = [
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16, headers: { Authorization: "Bearer object" } }} />',
  '<Image source={{ uri: "", width: 16, height: 16 }} referrerPolicy="origin" />',
  '<Image source={{ uri: "logo.png" }} width={16} height={16} />',
  '<Image src="https://example.com/logo.png" width={16} height={16} />',
  '<Image src="https://example.com/src.png" source={{ uri: "source.png", width: 16, height: 16 }} width={20} />',
  '<Image srcSet="logo.png 1x, logo@2x.png 2x" />',
  '<Image src="logo.png" srcSet="logo@2x.png 2x, logo@3x.png 3x" width={16} height={8} />',
  '<Image srcSet="logo.png, logo@1.5x.png 1.5x" crossOrigin="use-credentials" referrerPolicy="origin" />',
  '<Image source={{ uri: "fallback.png" }} srcSet="logo.png 1x" />',
  '<Image source={[{ uri: "logo.png", width: 16, height: 16 }, { uri: "logo@2x.png", width: 32, height: 32, scale: 2 }]} style={{ width: 16, height: 16 }} />',
  '<Image source={[{ uri: "logo.png", width: 16, height: 16, headers: { Authorization: "Bearer first" } }, { uri: "logo@2x.png", width: 32, height: 32, scale: 2, headers: { Authorization: "Bearer second" } }]} style={{ width: 16, height: 16 }} />',
  '<Image source={{ uri: "logo.png", width: null, height: 16 }} width={20} />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} resizeMode={null} style={{ resizeMode: "contain" }} />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} resizeMode="" style={{ resizeMode: "contain" }} />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} resizeMode="contain" style={{ objectFit: "fill" }} />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} tintColor={null} style={{ tintColor: "red" }} />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} crossOrigin="use-credentials" referrerPolicy="origin" />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} alt="Logo" />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} alt={null} aria-label="Logo" />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} accessible={null} />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} aria-label="Logo" accessibilityLabel="Fallback" />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} aria-hidden={true} accessible={true} />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} aria-busy={true} accessibilityState={{ selected: true }} />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} {...{ alt: "Logo" }} />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} {...{ source: { uri: "override.png" } }} />',
  '<Text><Image source={{ uri: "logo.png", width: 16, height: 16 }} /></Text>',
];

const BAILED_IMAGE_CASES = new Set([
  '<Image source={{ uri: "fallback.png" }} srcSet="logo.png 1x" />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} {...{ alt: "Logo" }} />',
  '<Image source={{ uri: "logo.png", width: 16, height: 16 }} {...{ source: { uri: "override.png" } }} />',
  '<Text><Image source={{ uri: "logo.png", width: 16, height: 16 }} /></Text>',
]);

const DYNAMIC_IMAGE_CASES: Array<[string, string]> = [
  ['<Image source={asset} />', 'const asset = { uri: "asset.png", width: 11, height: 12 };'],
  ['<Image source={require("./asset.png")} />', 'const require = () => ({ uri: "asset.png", width: 11, height: 12 });'],
  [
    '<Image src={url} width={16} height={8} crossOrigin={crossOrigin} referrerPolicy={policy} />',
    'const url = "https://example.com/logo.png"; const crossOrigin = "use-credentials"; const policy = "origin";',
  ],
  [
    '<Image source={{ uri: "logo.png" }} style={imageStyle} resizeMode={mode} tintColor={tint} />',
    'const imageStyle = [{ width: 16, height: 8 }, { objectFit: "fill", tintColor: "red" }]; const mode = ""; const tint = undefined;',
  ],
];

const getFirstImageSource = (props: Record<string, unknown>) => {
  const source = props.source;
  if (!Array.isArray(source)) throw new Error('expected Image source to be normalized to an array');
  return source[0] as Record<string, unknown>;
};

const IMAGE_PROP_ASSERTIONS = new Map<string, (props: Record<string, unknown>, os: (typeof PLATFORMS)[number]) => void>(
  [
    [
      '<Image source={{ uri: "logo.png" }} width={16} height={16} />',
      (props) => expect(normalize(props).style).toMatchObject({ width: 16, height: 16 }),
    ],
    [
      '<Image src="https://example.com/logo.png" width={16} height={16} />',
      (props) => expect(getFirstImageSource(props)).toMatchObject({ width: 16, height: 16 }),
    ],
    [
      '<Image srcSet="logo.png 1x, logo@2x.png 2x" />',
      (props) =>
        expect(props.source).toMatchObject([
          { uri: 'logo.png', scale: 1 },
          { uri: 'logo@2x.png', scale: 2 },
        ]),
    ],
    [
      '<Image src="logo.png" srcSet="logo@2x.png 2x, logo@3x.png 3x" width={16} height={8} />',
      (props) =>
        expect(props.source).toMatchObject([
          { uri: 'logo@2x.png', scale: 2, width: 16, height: 8 },
          { uri: 'logo@3x.png', scale: 3, width: 16, height: 8 },
          { uri: 'logo.png', scale: 1, width: 16, height: 8 },
        ]),
    ],
    [
      '<Image srcSet="logo.png, logo@1.5x.png 1.5x" crossOrigin="use-credentials" referrerPolicy="origin" />',
      (props) => {
        expect(getFirstImageSource(props)).toMatchObject({ uri: 'logo.png', scale: 1 });
        expect(getFirstImageSource(props).headers).toEqual({
          'Access-Control-Allow-Credentials': 'true',
          'Referrer-Policy': 'origin',
        });
      },
    ],
    [
      '<Image source={{ uri: "logo.png", width: 16, height: 16 }} crossOrigin="use-credentials" referrerPolicy="origin" />',
      (props) =>
        expect(getFirstImageSource(props).headers).toEqual({
          'Access-Control-Allow-Credentials': 'true',
          'Referrer-Policy': 'origin',
        }),
    ],
    [
      '<Image source={{ uri: "logo.png", width: 16, height: 16 }} alt="Logo" />',
      (props) => expect(props).toMatchObject({ accessibilityLabel: 'Logo', accessible: true }),
    ],
    [
      '<Image source={{ uri: "logo.png", width: 16, height: 16 }} aria-label="Logo" accessibilityLabel="Fallback" />',
      (props) => expect(props.accessibilityLabel).toBe('Logo'),
    ],
    [
      '<Image source={{ uri: "logo.png", width: 16, height: 16 }} aria-hidden={true} accessible={true} />',
      (props, os) => {
        if (os === 'android') expect(props.importantForAccessibility).toBe('no-hide-descendants');
      },
    ],
    [
      '<Image source={{ uri: "logo.png", width: 16, height: 16 }} aria-busy={true} accessibilityState={{ selected: true }} />',
      (props, os) => {
        if (os === 'android') expect(props.accessibilityState).toEqual({ selected: true, busy: true });
        else expect(props.accessibilityState).toEqual({ selected: true });
      },
    ],
  ]
);

const DYNAMIC_IMAGE_PROP_ASSERTIONS = new Map<string, (props: Record<string, unknown>) => void>([
  [
    '<Image src={url} width={16} height={8} crossOrigin={crossOrigin} referrerPolicy={policy} />',
    (props) => {
      expect(getFirstImageSource(props)).toMatchObject({
        width: 16,
        height: 8,
        headers: {
          'Access-Control-Allow-Credentials': 'true',
          'Referrer-Policy': 'origin',
        },
      });
    },
  ],
]);

describe('Image parity normalization', () => {
  it('ignores duplicate source aliases only on RN 0.85 and earlier', () => {
    const source = [{ uri: 'logo.png' }];
    expect(normalizeImage({ src: source, source }, 85)).toEqual({ source });
    expect(normalizeImage({ src: source, source }, 86)).toEqual({ src: source, source });
  });
});

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

    it.each(ANIMATED_WRAPPER_REMOVAL_CASES)('Animated wrapper removal: %s', async (jsx) => {
      const boost = await captureBoost(os, jsx);
      if (!boost.optimized) throw new Error('expected animated wrapper removal case to optimize');
      const wrapper = await captureWrapper(os, jsx);
      expect(boost.which).toEqual(wrapper.which);
      expect(normalize(boost.props)).toEqual(normalize(wrapper.props));
    });

    it.each(ACTIVITY_INDICATOR_CASES)('ActivityIndicator: %s', async (jsx, preamble = '') => {
      const boost = await captureBoostHosts(os, jsx, preamble);
      expect(boost.optimized).toBe(!BAILED_ACTIVITY_INDICATOR_CASES.has(jsx));
      if (!boost.optimized) return;

      const wrapper = await captureWrapperHosts(os, jsx, preamble);
      expect(boost.hosts.map((host) => host.which)).toEqual(['NativeView', 'NativeActivityIndicator']);
      expect(boost.hosts.map((host) => host.which)).toEqual(wrapper.map((host) => host.which));
      if (jsx.includes('onLayout')) {
        expect(typeof boost.hosts[0].props.onLayout).toBe('function');
        expect(typeof wrapper[0].props.onLayout).toBe('function');
        expect(boost.hosts[1].props.onLayout).toBeUndefined();
        expect(wrapper[1].props.onLayout).toBeUndefined();
      }
      expect(boost.hosts.map((host) => normalize(host.props))).toEqual(wrapper.map((host) => normalize(host.props)));
    });

    it.each(IMAGE_CASES)('Image: %s', async (jsx) => {
      const boost = await captureBoost(os, jsx);
      expect(boost.optimized).toBe(!BAILED_IMAGE_CASES.has(jsx));
      if (!boost.optimized) return; // bailed → defers to the wrapper, equivalent by construction
      const wrapper = await captureWrapper(os, jsx);
      expect(boost.which).toEqual(wrapper.which);
      expect(normalizeImage(boost.props, REACT_NATIVE_MINOR)).toEqual(
        normalizeImage(wrapper.props, REACT_NATIVE_MINOR)
      );
      IMAGE_PROP_ASSERTIONS.get(jsx)?.(boost.props, os);
    });

    it.each(DYNAMIC_IMAGE_CASES)('Image dynamic: %s', async (jsx, preamble) => {
      const boost = await captureBoost(os, jsx, preamble);
      if (!boost.optimized) throw new Error('expected Image dynamic case to optimize');
      const wrapper = await captureWrapper(os, jsx, preamble);
      expect(boost.which).toEqual(wrapper.which);
      expect(normalizeImage(boost.props, REACT_NATIVE_MINOR)).toEqual(
        normalizeImage(wrapper.props, REACT_NATIVE_MINOR)
      );
      DYNAMIC_IMAGE_PROP_ASSERTIONS.get(jsx)?.(boost.props);
    });

    it.each(STATIC_SELECTION_COLOR_CASES)('Text: precomputes selectionColor: %s', async (jsx) => {
      expect(boostUsesRuntimeSelectionColor(os, jsx)).toBe(false);
      const boost = await captureBoost(os, jsx);
      if (!boost.optimized) throw new Error('expected static Text selectionColor case to optimize');
      const wrapper = await captureWrapper(os, jsx);
      expect(boost.which).toBe(wrapper.which);
      expect(normalize(boost.props)).toEqual(normalize(wrapper.props));
    });

    it('Text: dynamic selectionColor uses runtime processing', async () => {
      const jsx = '<Text selectionColor={accent}>hello</Text>';
      const preamble = 'const accent = getAccent(); function getAccent() { return "red"; }';
      expect(boostUsesRuntimeSelectionColor(os, jsx, preamble)).toBe(true);
      const boost = await captureBoost(os, jsx, preamble);
      if (!boost.optimized) throw new Error('expected Text dynamic selectionColor case to optimize');
      const wrapper = await captureWrapper(os, jsx, preamble);
      expect(normalize(boost.props)).toEqual(normalize(wrapper.props));
    });

    it('Text: mixed dynamic style preserves userSelect flatten order', async () => {
      const jsx = '<Text style={[dynamicStyle, { userSelect: "text" }]} selectable={true}>hello</Text>';
      const preamble = 'const dynamicStyle = { userSelect: "none" };';
      const boost = await captureBoost(os, jsx, preamble);
      if (!boost.optimized) throw new Error('expected Text mixed style case to optimize');
      const wrapper = await captureWrapper(os, jsx, preamble);
      expect(boost.which).toEqual(wrapper.which);
      expect(normalize(boost.props)).toEqual(normalize(wrapper.props));
    });

    it('Text: invalid userSelect clobbers selectable with shadowed undefined', async () => {
      const jsx = '<Text style={{ userSelect: "xyz" }} selectable={true}>hello</Text>';
      const preamble = 'const undefined = true;';
      const boost = await captureBoost(os, jsx, preamble);
      if (!boost.optimized) throw new Error('expected Text shadowed undefined case to optimize');
      const wrapper = await captureWrapper(os, jsx, preamble);
      expect(boost.which).toEqual(wrapper.which);
      expect(normalize(boost.props)).toEqual(normalize(wrapper.props));
    });

    it('Text: static userSelect overrides selectable from a later spread', async () => {
      const jsx =
        '<Text aria-disabled={_b0} style={{ verticalAlign: "middle", fontWeight: 400, userSelect: "none", width: 10 }} selectionColor={"blue"} {..._s0}>hello</Text>';
      const preamble = 'const _b0 = false;\nconst _s0 = { selectable: true };';
      const boost = await captureBoost(os, jsx, preamble);
      if (!boost.optimized) throw new Error('expected Text static userSelect spread case to optimize');
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

    it('Text returned by a renderer defers when mounted under Text', async () => {
      const jsx = '<Text>{renderBreak()}</Text>';
      const preamble = String.raw`const renderBreak = () => <Text>{'\n'}</Text>;`;
      const hosts = await captureWrapperHosts(os, jsx, preamble);
      expect(hosts.map((host) => host.which)).toEqual(['NativeText', 'NativeVirtualText']);

      const boost = await captureBoostHosts(os, jsx, preamble, false);
      expect(boost.optimized).toBe(false);
    });
  });
});
