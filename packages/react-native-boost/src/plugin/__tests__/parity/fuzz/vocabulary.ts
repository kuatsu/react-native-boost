import fc from 'fast-check';

// Broad curated vocabulary, seeded from the wrapper's destructure sets + the optimizers' handled/
// blacklisted props + pass-throughs + uncurated probes. Each entry is `{ name, arb,
// disposition }`, where `arb` produces ONLY type-valid value source (a value that would
// throw on both sides is a harness error, not a finding) and `disposition` documents the expected
// optimizer behavior (a triage aid; not asserted).

export interface PropSpec {
  name: string;
  arb: fc.Arbitrary<string>;
  disposition: string;
}

// ── Type-valid value building blocks ──────────────────────────────────────────────────────────────
const str = fc.constantFrom('"x"', '"hello"', '"a b"', '""', '"123"');
const bool = fc.constantFrom('true', 'false');
const nullish = fc.constantFrom('null', 'undefined');
// `aria-labelledby` is `.split()` on both sides → string only (a number/boolean would throw on both).
const labelledBy = fc.constantFrom('"a"', '"a, b"', '"a ,  b , c"', '""');
const checked = fc.constantFrom('true', 'false', '"mixed"');

/** Most values, with the occasional `null`/`undefined` edge value mixed in. */
const withNullish = (arb: fc.Arbitrary<string>) =>
  fc.oneof({ weight: 5, arbitrary: arb }, { weight: 1, arbitrary: nullish });

const a11yStateObject = fc.constantFrom(
  '{}',
  '{ disabled: true }',
  '{ disabled: false }',
  '{ busy: true }',
  '{ checked: true }',
  '{ checked: "mixed" }',
  '{ expanded: true, selected: false }',
  '{ disabled: true, busy: true }'
);

const a11yValueObject = fc.constantFrom(
  '{}',
  '{ now: 5 }',
  '{ min: 0, max: 10 }',
  '{ now: 5, min: 0, max: 10 }',
  '{ now: 50, min: 0, max: 100, text: "50%" }',
  '{ text: "half" }'
);

// Rich style generator. Covers plain keys, the three conversions (numeric fontWeight →
// string, verticalAlign → textAlignVertical incl. an unknown key, userSelect → selectable incl. an
// unknown key), arrays with nesting + last-key-wins overrides + falsy elements that StyleSheet.flatten
// skips, and the edge values. The static/dynamic axis (applied by the generator) drives a fully-static
// style through the build-time merge (tryBuildStaticTextStyle) and a hoisted one through the runtime
// helper (processTextStyle); `flattenStyle` in `normalize` reconciles array-vs-merged shape.
const styleKeyValue = fc.oneof(
  fc.constantFrom(
    'color: "red"',
    'color: "blue"',
    'fontSize: 16',
    'width: 10',
    'height: 20',
    'opacity: 0.5',
    'margin: 0'
  ),
  fc.constantFrom('fontWeight: 700', 'fontWeight: 400', 'fontWeight: "bold"', 'fontWeight: "600"'),
  fc.constantFrom(
    'verticalAlign: "auto"',
    'verticalAlign: "top"',
    'verticalAlign: "bottom"',
    'verticalAlign: "middle"',
    'verticalAlign: "sub"'
  ),
  fc.constantFrom(
    'userSelect: "auto"',
    'userSelect: "text"',
    'userSelect: "none"',
    'userSelect: "all"',
    'userSelect: "contain"',
    'userSelect: "xyz"'
  )
);

const styleObject = fc
  .uniqueArray(styleKeyValue, { selector: (kv) => kv.slice(0, kv.indexOf(':')), maxLength: 4 })
  .map((kvs) => `{ ${kvs.join(', ')} }`);

const styleValue = fc.oneof(
  { weight: 4, arbitrary: styleObject },
  {
    weight: 2,
    arbitrary: fc
      .array(
        fc.oneof(
          { weight: 3, arbitrary: styleObject },
          { weight: 1, arbitrary: fc.constantFrom('null', 'false', '0', 'undefined') }
        ),
        {
          minLength: 1,
          maxLength: 3,
        }
      )
      .map((elements) => `[${elements.join(', ')}]`),
  },
  { weight: 1, arbitrary: fc.constantFrom('null', 'undefined', '[]', '{}') }
);

const imageStyleKeyValue = fc.constantFrom(
  'width: 16',
  'height: 16',
  'objectFit: "contain"',
  'objectFit: "cover"',
  'objectFit: "fill"',
  'resizeMode: "contain"',
  'resizeMode: "cover"',
  'resizeMode: ""',
  'tintColor: "red"',
  'borderRadius: 4'
);

const imageStyleObject = fc
  .uniqueArray(imageStyleKeyValue, { selector: (kv) => kv.slice(0, kv.indexOf(':')), maxLength: 3 })
  .map((kvs) => `{ ${kvs.join(', ')} }`);

const imageStyleValue = fc.oneof(
  { weight: 4, arbitrary: imageStyleObject },
  {
    weight: 2,
    arbitrary: fc
      .array(
        fc.oneof(
          { weight: 3, arbitrary: imageStyleObject },
          { weight: 1, arbitrary: fc.constantFrom('null', 'false', '0') }
        ),
        {
          minLength: 1,
          maxLength: 3,
        }
      )
      .map((elements) => `[${elements.join(', ')}]`),
  },
  { weight: 1, arbitrary: fc.constantFrom('{}', 'null') }
);

// ── Text ────────────────────────────────────────────────────────────────────────────────────────
export const TEXT_VOCAB: PropSpec[] = [
  // Accessibility / normalized → always routed through `processTextAccessibilityProps` at runtime.
  { name: 'accessibilityLabel', arb: withNullish(str), disposition: 'a11y; merged with aria-label' },
  { name: 'aria-label', arb: withNullish(str), disposition: 'a11y; wins over accessibilityLabel' },
  { name: 'accessibilityState', arb: a11yStateObject, disposition: 'a11y; aria-state merge target' },
  { name: 'aria-busy', arb: withNullish(bool), disposition: 'a11y state merge' },
  { name: 'aria-checked', arb: withNullish(checked), disposition: 'a11y state merge' },
  { name: 'aria-disabled', arb: withNullish(bool), disposition: 'a11y state merge' },
  { name: 'aria-expanded', arb: withNullish(bool), disposition: 'a11y state merge' },
  { name: 'aria-selected', arb: withNullish(bool), disposition: 'a11y state merge' },
  { name: 'accessible', arb: withNullish(bool), disposition: 'a11y; platform default applied' },
  { name: 'disabled', arb: withNullish(bool), disposition: 'a11y; reconciled with state.disabled' },
  // Scalars / ids.
  {
    name: 'numberOfLines',
    arb: fc.constantFrom('0', '1', '2', '5', '-1', '-3'),
    disposition: 'negative → clamped to 0',
  },
  { name: 'style', arb: styleValue, disposition: 'static → build-time merge; dynamic → processTextStyle' },
  { name: 'id', arb: str, disposition: 'renamed → nativeID' },
  { name: 'nativeID', arb: str, disposition: 'pass-through; id wins if both present' },
  {
    name: 'selectionColor',
    arb: withNullish(fc.constantFrom('"red"', '"blue"')),
    disposition: 'translate → processColor; null/undefined omitted',
  },
  // Pure pass-throughs.
  { name: 'testID', arb: withNullish(str), disposition: 'pass-through' },
  {
    name: 'ellipsizeMode',
    arb: fc.constantFrom('"head"', '"middle"', '"tail"', '"clip"'),
    disposition: 'pass-through; default tail',
  },
  { name: 'allowFontScaling', arb: bool, disposition: 'pass-through; default true' },
  { name: 'selectable', arb: withNullish(bool), disposition: 'pass-through' },
  {
    name: 'lineBreakMode',
    arb: fc.constantFrom('"head"', '"middle"', '"tail"', '"clip"'),
    disposition: 'pass-through',
  },
  {
    name: 'maxFontSizeMultiplier',
    arb: withNullish(fc.constantFrom('0', '1', '1.5', '2')),
    disposition: 'pass-through',
  },
  { name: 'minimumFontScale', arb: fc.constantFrom('0', '0.5', '1'), disposition: 'pass-through' },
  { name: 'adjustsFontSizeToFit', arb: bool, disposition: 'pass-through' },
  // Uncurated broad probes — pass-through equivalence (regression guard).
  {
    name: 'role',
    arb: fc.constantFrom('"button"', '"link"', '"text"', '"header"'),
    disposition: 'probe; native-layer translate, expect parity',
  },
  {
    name: 'dataDetectorType',
    arb: fc.constantFrom('"phoneNumber"', '"link"', '"none"', '"all"'),
    disposition: 'probe pass-through',
  },
  {
    name: 'dynamicTypeRamp',
    arb: fc.constantFrom('"body"', '"callout"', '"title1"'),
    disposition: 'probe pass-through',
  },
  {
    name: 'lineBreakStrategyIOS',
    arb: fc.constantFrom('"none"', '"standard"', '"push-out"'),
    disposition: 'probe pass-through',
  },
  {
    name: 'textBreakStrategy',
    arb: fc.constantFrom('"simple"', '"highQuality"', '"balanced"'),
    disposition: 'probe pass-through',
  },
];

// Blacklisted Text props — every one must bail (skip). Added with low probability so they don't tank
// the optimize rate; their values only need to be syntactically valid (the element bails before render).
export const TEXT_BLACKLIST_SAMPLE: PropSpec[] = [
  { name: 'aria-hidden', arb: bool, disposition: 'bail; wrapper translates, helper does not' },
  { name: 'onPress', arb: fc.constant('() => {}'), disposition: 'bail; press handler' },
  { name: 'onPressIn', arb: fc.constant('() => {}'), disposition: 'bail; press handler' },
  { name: 'onLongPress', arb: fc.constant('() => {}'), disposition: 'bail; press handler' },
  { name: 'suppressHighlighting', arb: bool, disposition: 'bail' },
  { name: 'pressRetentionOffset', arb: fc.constant('{ top: 1, bottom: 1, left: 1, right: 1 }'), disposition: 'bail' },
];

// ── View ──────────────────────────────────────────────────────────────────────────────────────────
export const VIEW_VOCAB: PropSpec[] = [
  // Wrapper-translated: static literal → build-time translate; dynamic → processViewAccessibilityProps.
  { name: 'aria-label', arb: withNullish(str), disposition: 'translate → accessibilityLabel' },
  {
    name: 'aria-labelledby',
    arb: withNullish(labelledBy),
    disposition: 'translate → accessibilityLabelledBy (comma split)',
  },
  {
    name: 'aria-live',
    arb: withNullish(fc.constantFrom('"off"', '"polite"', '"assertive"', '"none"')),
    disposition: 'translate → accessibilityLiveRegion (off→none)',
  },
  {
    name: 'aria-hidden',
    arb: withNullish(bool),
    disposition: 'translate → accessibilityElementsHidden (+importantForA11y when true)',
  },
  {
    name: 'tabIndex',
    arb: withNullish(fc.constantFrom('0', '1', '-1')),
    disposition: 'translate → focusable=!tabIndex',
  },
  { name: 'id', arb: str, disposition: 'rename → nativeID' },
  // ARIA state group — any present member routes the whole group (incl. accessibilityState) to the helper.
  { name: 'aria-busy', arb: withNullish(bool), disposition: 'aggregate → accessibilityState' },
  { name: 'aria-checked', arb: withNullish(checked), disposition: 'aggregate → accessibilityState' },
  { name: 'aria-disabled', arb: withNullish(bool), disposition: 'aggregate → accessibilityState' },
  { name: 'aria-expanded', arb: withNullish(bool), disposition: 'aggregate → accessibilityState' },
  { name: 'aria-selected', arb: withNullish(bool), disposition: 'aggregate → accessibilityState' },
  { name: 'accessibilityState', arb: a11yStateObject, disposition: 'lone pass-through / aggregation base' },
  // ARIA value group.
  {
    name: 'aria-valuemax',
    arb: withNullish(fc.constantFrom('0', '10', '100')),
    disposition: 'aggregate → accessibilityValue',
  },
  { name: 'aria-valuemin', arb: withNullish(fc.constantFrom('0', '5')), disposition: 'aggregate → accessibilityValue' },
  {
    name: 'aria-valuenow',
    arb: withNullish(fc.constantFrom('0', '5', '50')),
    disposition: 'aggregate → accessibilityValue',
  },
  { name: 'aria-valuetext', arb: withNullish(str), disposition: 'aggregate → accessibilityValue' },
  { name: 'accessibilityValue', arb: a11yValueObject, disposition: 'lone pass-through / aggregation base' },
  // Pure pass-throughs.
  { name: 'testID', arb: withNullish(str), disposition: 'pass-through' },
  { name: 'nativeID', arb: str, disposition: 'pass-through; not guarded' },
  {
    name: 'pointerEvents',
    arb: fc.constantFrom('"none"', '"auto"', '"box-none"', '"box-only"'),
    disposition: 'pass-through',
  },
  { name: 'collapsable', arb: bool, disposition: 'pass-through' },
  {
    name: 'accessibilityRole',
    arb: fc.constantFrom('"button"', '"link"', '"none"', '"header"'),
    disposition: 'pass-through',
  },
  { name: 'accessible', arb: withNullish(bool), disposition: 'pass-through; no View default' },
  { name: 'accessibilityLabel', arb: withNullish(str), disposition: 'pass-through; overwritten by aria-label' },
  { name: 'hitSlop', arb: fc.constantFrom('5', '{ top: 5, bottom: 5 }'), disposition: 'pass-through' },
  { name: 'removeClippedSubviews', arb: bool, disposition: 'pass-through' },
  { name: 'style', arb: styleValue, disposition: 'identity pass-through (View does no style work)' },
  // Uncurated broad probes.
  {
    name: 'role',
    arb: fc.constantFrom('"button"', '"link"', '"none"'),
    disposition: 'probe; native-layer, expect parity',
  },
  { name: 'focusable', arb: bool, disposition: 'probe pass-through' },
  {
    name: 'importantForAccessibility',
    arb: fc.constantFrom('"auto"', '"yes"', '"no"', '"no-hide-descendants"'),
    disposition: 'probe pass-through',
  },
  { name: 'needsOffscreenAlphaCompositing', arb: bool, disposition: 'probe pass-through' },
  { name: 'renderToHardwareTextureAndroid', arb: bool, disposition: 'probe pass-through' },
  { name: 'shouldRasterizeIOS', arb: bool, disposition: 'probe pass-through' },
];

// ── Image ─────────────────────────────────────────────────────────────────────────────────────────
export const IMAGE_SOURCE_VOCAB: PropSpec[] = [
  {
    name: 'source',
    arb: fc.constantFrom(
      '{ uri: "logo.png", width: 16, height: 16 }',
      '{ uri: "logo.png", width: 16, height: 16, headers: { Authorization: "Bearer object" } }',
      '{ uri: "", width: 16, height: 16 }',
      '{ uri: "logo.png", width: null, height: 16 }',
      '{ uri: "logo.png" }',
      '[{ uri: "logo.png", width: 16, height: 16 }, { uri: "logo@2x.png", width: 32, height: 32, scale: 2 }]',
      '[{ uri: "logo.png", width: 16, height: 16, headers: { Authorization: "Bearer first" } }, { uri: "logo@2x.png", width: 32, height: 32, scale: 2, headers: { Authorization: "Bearer second" } }]'
    ),
    disposition: 'required static source',
  },
  {
    name: 'src',
    arb: fc.constantFrom('"https://example.com/logo.png"'),
    disposition: 'required static src',
  },
];

export const IMAGE_VOCAB: PropSpec[] = [
  { name: 'width', arb: withNullish(fc.constantFrom('16', '20')), disposition: 'source/style size fallback' },
  { name: 'height', arb: withNullish(fc.constantFrom('16', '20')), disposition: 'source/style size fallback' },
  { name: 'style', arb: imageStyleValue, disposition: 'static image style synthesis' },
  {
    name: 'resizeMode',
    arb: withNullish(fc.constantFrom('"contain"', '"cover"', '"stretch"', '""')),
    disposition: 'resize mode fallback',
  },
  { name: 'tintColor', arb: withNullish(fc.constantFrom('"red"', '"blue"')), disposition: 'tintColor fallback' },
  {
    name: 'crossOrigin',
    arb: withNullish(fc.constantFrom('"anonymous"', '"use-credentials"')),
    disposition: 'request headers',
  },
  {
    name: 'referrerPolicy',
    arb: withNullish(fc.constantFrom('"origin"', '"no-referrer"', '"same-origin"')),
    disposition: 'request headers',
  },
  { name: 'alt', arb: withNullish(str), disposition: 'translate → accessibilityLabel + accessible' },
  { name: 'aria-label', arb: withNullish(str), disposition: 'translate → accessibilityLabel' },
  { name: 'aria-hidden', arb: withNullish(bool), disposition: 'platform accessibility hiding' },
  { name: 'aria-labelledby', arb: withNullish(labelledBy), disposition: 'android labelledBy translation' },
  { name: 'aria-busy', arb: withNullish(bool), disposition: 'aggregate → accessibilityState' },
  { name: 'aria-checked', arb: withNullish(checked), disposition: 'aggregate → accessibilityState' },
  { name: 'aria-disabled', arb: withNullish(bool), disposition: 'aggregate → accessibilityState' },
  { name: 'aria-expanded', arb: withNullish(bool), disposition: 'aggregate → accessibilityState' },
  { name: 'aria-selected', arb: withNullish(bool), disposition: 'aggregate → accessibilityState' },
  { name: 'accessibilityLabel', arb: withNullish(str), disposition: 'a11y label fallback' },
  { name: 'accessibilityState', arb: a11yStateObject, disposition: 'a11y state merge target' },
  { name: 'accessible', arb: withNullish(bool), disposition: 'a11y pass-through / alt override' },
  {
    name: 'importantForAccessibility',
    arb: fc.constantFrom('"auto"', '"yes"', '"no"', '"no-hide-descendants"'),
    disposition: 'a11y pass-through / aria-hidden override',
  },
  { name: 'testID', arb: withNullish(str), disposition: 'pass-through' },
  { name: 'blurRadius', arb: fc.constantFrom('0', '2'), disposition: 'native pass-through' },
  { name: 'borderRadius', arb: fc.constantFrom('0', '4'), disposition: 'native pass-through' },
];
