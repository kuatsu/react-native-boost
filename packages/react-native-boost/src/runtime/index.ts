import {
  TextProps,
  TextStyle,
  StyleSheet,
  Platform,
  Image as RNImage,
  processColor as rnProcessColor,
} from 'react-native';
import type { ColorValue, ProcessedColorValue } from 'react-native';
// The module exists on the whole supported RN range (>= 0.83); only the individual getters vary by
// version, so each access is guarded. A namespace import (not a named one) keeps a missing getter a
// plain `undefined` property access under strict ESM interop.
import * as ReactNativeFeatureFlags from 'react-native/src/private/featureflags/ReactNativeFeatureFlags';
import { GenericStyleProp } from './types';
import { userSelectToSelectableMap, verticalAlignToTextAlignVerticalMap } from './utils/constants';

const propsCache = new WeakMap();
const imageBaseStyle = { overflow: 'hidden' } as const;
const textDefaultOverflowStyle = { overflow: 'hidden' } as const;
const emptyImageSource = { uri: undefined, width: undefined, height: undefined };

// Resolve RN's `processColor` once. The `typeof` guard degrades to a passthrough on
// a non-RN host that lacks it (see {@link processSelectionColor}); the web build never reaches this — it
// uses the separate `index.web.ts` shim.
const processColor: ((color?: ColorValue | number) => ProcessedColorValue | null | undefined) | undefined =
  typeof rnProcessColor === 'function' ? rnProcessColor : undefined;
const resolveImageAssetSource =
  typeof RNImage.resolveAssetSource === 'function'
    ? RNImage.resolveAssetSource.bind(RNImage)
    : <T>(source: T): T => source;

const objectFitToResizeMode: Record<string, string> = {
  'contain': 'contain',
  'cover': 'cover',
  'fill': 'stretch',
  'none': 'none',
  'scale-down': 'contain',
};

/**
 * Reads RN's `defaultTextToOverflowHidden` feature flag, the switch behind `Text`'s default
 * `overflow: 'hidden'` style (RN ≥ 0.85). The getter does not exist on RN < 0.85, where the wrapper
 * applies no default — so `false` is exact parity there, not a degradation. The try/catch only guards
 * a throwing getter (impossible in a working app: `Text.js` calls it unguarded).
 */
function readDefaultTextToOverflowHidden(): boolean {
  try {
    return (
      typeof ReactNativeFeatureFlags.defaultTextToOverflowHidden === 'function' &&
      ReactNativeFeatureFlags.defaultTextToOverflowHidden()
    );
  } catch {
    return false;
  }
}

let cachedDefaultTextStyle: TextStyle | false | undefined;

/**
 * The default style `Text` prepends to every element's `style` — `{ overflow: 'hidden' }` when
 * `defaultTextToOverflowHidden` is on (RN ≥ 0.85 default), and `undefined` otherwise. The plugin
 * prepends this as the first `style` array entry of every optimized `Text`, so the user's own
 * `overflow` still wins; an `undefined` is ignored by RN's style flattening, so on RN versions
 * without the flag the resolved props are identical to passing no default at all.
 *
 * @remarks
 * The flag is read lazily on first use and memoized, mirroring `Text.js`'s render-time read rather
 * than locking the flag at import: RN's `ReactNativeFeatureFlags.override` throws once a flag has been
 * accessed, so a module-load read would break apps that legitimately override flags during startup.
 * Memoizing cannot diverge from RN — an override after the first `Text` render throws in stock RN too.
 */
export function getDefaultTextStyle(): TextStyle | undefined {
  // `false` (not `undefined`) is the memoized flag-off state so the flag is only ever read once.
  cachedDefaultTextStyle ??= readDefaultTextToOverflowHidden() ? textDefaultOverflowStyle : false;
  return cachedDefaultTextStyle || undefined;
}

/**
 * Normalizes `Text` style values for `NativeText`.
 *
 * @param style - Style prop passed to a text-like component.
 * @returns Native-friendly text props. Returns an empty object when `style` is falsy or cannot be normalized.
 * @remarks
 * - Flattens style arrays via `StyleSheet.flatten`
 * - Converts numeric `fontWeight` values to string values
 * - Maps `userSelect` and `verticalAlign` to native-compatible props
 * - Prepends {@link getDefaultTextStyle} so the flag-gated `overflow: 'hidden'` default applies to
 *   dynamically-styled (and falsy-styled) `Text` exactly as the wrapper applies it
 */
export function processTextStyle(style: GenericStyleProp<TextStyle>): Partial<TextProps> {
  const defaultTextStyle = getDefaultTextStyle();

  if (!style) return defaultTextStyle ? { style: defaultTextStyle } : {};

  // Cache the computed props
  let props = propsCache.get(style);
  if (props) return props;

  props = {};
  propsCache.set(style, props);

  style = StyleSheet.flatten(style) as TextStyle;

  if (!style) {
    if (defaultTextStyle) props.style = defaultTextStyle;
    return props;
  }

  if (typeof style?.fontWeight === 'number') {
    style.fontWeight = style.fontWeight.toString() as TextStyle['fontWeight'];
  }

  if (style?.userSelect != null) {
    props.selectable = userSelectToSelectableMap[style.userSelect];
    delete style.userSelect;
  }

  if (style?.verticalAlign != null) {
    style.textAlignVertical = verticalAlignToTextAlignVerticalMap[
      style.verticalAlign
    ] as TextStyle['textAlignVertical'];
    delete style.verticalAlign;
  }

  props.style = defaultTextStyle ? [defaultTextStyle, style] : style;
  return props;
}

/**
 * Mirrors the `selectionColor` normalization `Text` performs before handing off to its native host:
 * `selectionColor != null ? processColor(selectionColor) : undefined` (Text.js). Returns a spreadable
 * prop bag so the plugin can inline it at the JSX call site like {@link processTextStyle}.
 *
 * @param selectionColor - The raw `selectionColor` prop (CSS color string, int, or `PlatformColor`).
 * @returns `{ selectionColor }` with the processed value, or an empty object when nothing should be
 *   emitted: a `null`/`undefined` input collapses to `{}`, and a value `processColor` rejects (returns
 *   `undefined`, e.g. an unparseable color string) is likewise omitted, mirroring `Text`'s
 *   `if (_selectionColor !== undefined)` guard. A `null` from `processColor` (a rejected `PlatformColor`)
 *   is preserved, since `Text` forwards that.
 * @remarks
 * No caching: keys are commonly primitives (`'red'`, `0xff0000ff`) that a `WeakMap` rejects, and
 * `processColor` is already cheap. When `processColor` is unavailable (a non-RN host) the raw value is
 * passed through rather than dropped, the least-surprising degradation.
 */
export function processSelectionColor(selectionColor?: ColorValue | number | null): {
  selectionColor?: ColorValue | ProcessedColorValue | null;
} {
  if (selectionColor == null) return {};
  if (processColor === undefined) return { selectionColor };
  const processed = processColor(selectionColor);
  return processed === undefined ? {} : { selectionColor: processed };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ImageSourceHelperProps = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ImageSource = Record<string, any>;

function getImageSourcesFromProps(props: ImageSourceHelperProps): ImageSource | ImageSource[] | undefined {
  const source = resolveImageAssetSource(props.source);
  const headers: Record<string, string> = {};

  if (props.crossOrigin === 'use-credentials') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  if (props.referrerPolicy != null) {
    headers['Referrer-Policy'] = props.referrerPolicy;
  }

  if (props.src != null) {
    return [{ uri: props.src, headers, width: props.width, height: props.height }];
  }
  if (source != null && source.uri && Object.keys(headers).length > 0) {
    return [{ ...source, headers }];
  }
  return source;
}

/**
 * Normalizes dynamic `Image` source/style props for `NativeImage`.
 *
 * @remarks
 * Static Image cases are still rewritten at build time. This helper is only emitted when the source
 * or style cannot be safely flattened by Babel, so it mirrors the RN wrapper's runtime work:
 * `resolveAssetSource`, `src`/request-header synthesis, object-vs-array source style construction,
 * `objectFit`/`resizeMode`, and iOS tint fallback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processImageSourceProps(props: ImageSourceHelperProps): Record<string, any> {
  const source = (getImageSourcesFromProps(props) || emptyImageSource) as ImageSource | ImageSource[];
  let style;
  let sources;
  let headers;

  if (Array.isArray(source)) {
    // Android's wrapper propagates a single-entry array source's intrinsic width/height into the
    // layout style (flag-gated on RN 0.85, unconditional since 0.86); iOS never does. Applying it on
    // RN 0.83/0.84 adopts that bug-fix early — a deliberate, benign divergence (user style still wins).
    const singleSource = source.length === 1 ? source[0] : undefined;
    style = [
      Platform.OS === 'android' && singleSource != null && { width: singleSource.width, height: singleSource.height },
      imageBaseStyle,
      props.style,
    ];
    sources = source;
    headers = source[0]?.headers;
  } else {
    const width = source.width ?? props.width;
    const height = source.height ?? props.height;
    style = [{ width, height }, imageBaseStyle, props.style];
    sources = [source];
    // No top-level Android `headers` for an object source: since RN 0.85 the wrapper only lifts them
    // from ARRAY sources (an object source's inline headers stay in the source entry). RN 0.83/0.84's
    // default wrapper still lifted them; see the plugin's `buildStaticNativeSource` for the rationale
    // of adopting the newer semantics on the whole supported range.
  }

  const flattenedStyle = StyleSheet.flatten(style);
  const objectFit = flattenedStyle?.objectFit;
  const resizeMode =
    (typeof objectFit === 'string' ? objectFitToResizeMode[objectFit] : undefined) ||
    props.resizeMode ||
    flattenedStyle?.resizeMode ||
    'cover';
  const tintColor = Platform.OS === 'android' ? props.tintColor : (props.tintColor ?? flattenedStyle?.tintColor);
  const result: Record<string, unknown> = {
    style,
    source: sources,
    resizeMode,
  };
  Object.assign(result, tintColor === undefined ? {} : { tintColor });

  if (Platform.OS === 'android') {
    Object.assign(result, headers === null || headers === undefined ? {} : { headers });
  }

  return result;
}

/**
 * The default value `Text` resolves for `accessible` when the prop is omitted: `true` on iOS (text is
 * an accessibility element unless opted out), `false` on Android, and `undefined` elsewhere.
 *
 * @remarks
 * Runtime fallback for the common optimized `<Text>` path (no accessibility props) when the target
 * platform is unknown at build time. When it is known (Metro reports it on the Babel caller), the
 * plugin inlines the literal instead and this is not emitted. Evaluated per render — like `Text`'s own
 * `Platform.select` — rather than hoisted to a constant, so it always reflects the current platform.
 */
export const getDefaultTextAccessible = (): boolean | undefined => Platform.select({ ios: true, android: false });

/**
 * Translates `aria-hidden` into its native counterparts for the `Text` helper, mirroring `Text.js`'s
 * legacy path: `aria-hidden` supplies `accessibilityElementsHidden`, falling back to an explicit value
 * when it is nullish (`??`), and forces `importantForAccessibility` to `'no-hide-descendants'` only when
 * it is strictly `true` (otherwise the explicit value is preserved). The `??` fallback is the legacy
 * superset of the two RN `Text` implementations, so this is correct regardless of which path a given RN
 * version runs.
 *
 * The `View` helper deliberately does NOT reuse this: `View.js` assigns `accessibilityElementsHidden`
 * directly under an `=== undefined` guard (no `??`), so the two diverge for a nullish `aria-hidden` and
 * must stay separate.
 */
function applyAriaHidden(
  ariaHidden: unknown,
  accessibilityElementsHidden?: unknown,
  importantForAccessibility?: unknown
): { accessibilityElementsHidden: unknown; importantForAccessibility: unknown } {
  return {
    accessibilityElementsHidden: ariaHidden ?? accessibilityElementsHidden,
    importantForAccessibility: ariaHidden === true ? 'no-hide-descendants' : importantForAccessibility,
  };
}

/**
 * Normalizes accessibility and ARIA props for runtime native components, mirroring the reconciliation
 * `Text` performs before handing off to its native host.
 *
 * @param props - Accessibility and ARIA props.
 * @returns Props with normalized accessibility fields.
 * @remarks
 * - Merges `aria-label` with `accessibilityLabel`
 * - Merges ARIA state fields into `accessibilityState`
 * - Reconciles `disabled` with `accessibilityState.disabled` (the explicit `disabled` prop wins)
 * - Translates `aria-hidden` into `accessibilityElementsHidden` / `importantForAccessibility` (see
 *   {@link applyAriaHidden}); `aria-hidden` wins over an explicitly-passed value
 * - Resolves the platform-specific `accessible` default (see {@link getDefaultTextAccessible})
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processTextAccessibilityProps(props: Record<string, any>): Record<string, any> {
  const {
    accessibilityLabel,
    ['aria-label']: ariaLabel,
    accessibilityState,
    ['aria-busy']: ariaBusy,
    ['aria-checked']: ariaChecked,
    ['aria-disabled']: ariaDisabled,
    ['aria-expanded']: ariaExpanded,
    ['aria-selected']: ariaSelected,
    ['aria-hidden']: ariaHidden,
    accessibilityElementsHidden,
    importantForAccessibility,
    accessible,
    disabled,
    ...restProperties
  } = props;

  // Merge label props: prefer the aria-label if defined.
  const normalizedLabel = ariaLabel ?? accessibilityLabel;

  // Merge the accessibilityState with any provided ARIA properties.
  let normalizedState = accessibilityState;
  if (ariaBusy != null || ariaChecked != null || ariaDisabled != null || ariaExpanded != null || ariaSelected != null) {
    normalizedState =
      normalizedState == null
        ? {
            busy: ariaBusy,
            checked: ariaChecked,
            disabled: ariaDisabled,
            expanded: ariaExpanded,
            selected: ariaSelected,
          }
        : {
            busy: ariaBusy ?? normalizedState.busy,
            checked: ariaChecked ?? normalizedState.checked,
            disabled: ariaDisabled ?? normalizedState.disabled,
            expanded: ariaExpanded ?? normalizedState.expanded,
            selected: ariaSelected ?? normalizedState.selected,
          };
  }

  // Reconcile `disabled` with `accessibilityState.disabled`. When the two are out of sync (and not
  // both falsy) the explicit `disabled` prop wins and is mirrored back into the state object, so the
  // native host receives a consistent value on both fields.
  const stateDisabled = normalizedState?.disabled;
  const normalizedDisabled = disabled ?? stateDisabled;
  if (
    normalizedDisabled !== stateDisabled &&
    ((normalizedDisabled != null && normalizedDisabled !== false) || (stateDisabled != null && stateDisabled !== false))
  ) {
    normalizedState = { ...normalizedState, disabled: normalizedDisabled };
  }

  // `aria-hidden` → `accessibilityElementsHidden` / `importantForAccessibility`. The explicit native
  // props are consumed (destructured out of `restProperties`) so `aria-hidden` wins over them, matching
  // the wrapper; the plugin routes both into this call when `aria-hidden` is present.
  const { accessibilityElementsHidden: normalizedElementsHidden, importantForAccessibility: normalizedImportant } =
    applyAriaHidden(ariaHidden, accessibilityElementsHidden, importantForAccessibility);

  // Resolve `accessible` exactly as `Text` does: opt-out on iOS, off by default on Android. The
  // Android pressable case (`onPress`/`onLongPress`) never applies — press handlers bail out of
  // optimization — so an omitted prop falls back to the platform default.
  const normalizedAccessible = Platform.select({
    ios: accessible !== false,
    android: accessible ?? false,
    default: accessible,
  });

  return {
    ...restProperties,
    accessibilityLabel: normalizedLabel,
    accessibilityState: normalizedState,
    accessibilityElementsHidden: normalizedElementsHidden,
    importantForAccessibility: normalizedImportant,
    accessible: normalizedAccessible,
    disabled: normalizedDisabled,
  };
}

/**
 * Normalizes accessibility and ARIA props for an optimized `NativeView`, mirroring the reconciliation
 * the `View` wrapper performs before handing off to its native host.
 *
 * @param props - Accessibility and ARIA props.
 * @returns Props with the ARIA cluster translated/aggregated into their native counterparts.
 * @remarks
 * Unlike {@link processTextAccessibilityProps} (the `Text` helper) there is no `accessible` default and no
 * `disabled` reconciliation — the `View` wrapper does neither. A static `tabIndex` is folded to
 * `focusable` at build time; only a dynamic `tabIndex` reaches this helper.
 * - `aria-labelledby` → `accessibilityLabelledBy` (comma-split into a string array)
 * - `aria-label` → `accessibilityLabel`
 * - `aria-live` → `accessibilityLiveRegion` (`'off'` → `'none'`)
 * - `aria-hidden` → `accessibilityElementsHidden` (+ `importantForAccessibility` when strictly `true`)
 * - `tabIndex` → `focusable` (`!tabIndex`)
 * - ARIA state fields aggregated into `accessibilityState` (`ariaX ?? accessibilityState?.x`)
 * - ARIA value fields aggregated into `accessibilityValue` (`ariaX ?? accessibilityValue?.x`)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processViewAccessibilityProps(props: Record<string, any>): Record<string, any> {
  const {
    accessibilityState,
    accessibilityValue,
    ['aria-busy']: ariaBusy,
    ['aria-checked']: ariaChecked,
    ['aria-disabled']: ariaDisabled,
    ['aria-expanded']: ariaExpanded,
    ['aria-hidden']: ariaHidden,
    ['aria-label']: ariaLabel,
    ['aria-labelledby']: ariaLabelledBy,
    ['aria-live']: ariaLive,
    ['aria-selected']: ariaSelected,
    ['aria-valuemax']: ariaValueMax,
    ['aria-valuemin']: ariaValueMin,
    ['aria-valuenow']: ariaValueNow,
    ['aria-valuetext']: ariaValueText,
    tabIndex,
    ...restProperties
  } = props;

  const result = restProperties;

  // Optional chaining (not a bare `!== undefined` guard) so a runtime-null `aria-labelledby` is
  // skipped rather than throwing on `.split`, exactly as the wrapper does.
  const parsedAriaLabelledBy = ariaLabelledBy?.split(/\s*,\s*/g);
  if (parsedAriaLabelledBy !== undefined) result.accessibilityLabelledBy = parsedAriaLabelledBy;
  if (ariaLabel !== undefined) result.accessibilityLabel = ariaLabel;
  if (ariaLive !== undefined) result.accessibilityLiveRegion = ariaLive === 'off' ? 'none' : ariaLive;
  // Direct assignment under an `!== undefined` guard, matching `View.js` exactly. This is NOT the
  // `Text` helper's `applyAriaHidden` rule (which uses `??`): the two diverge for a nullish value, so
  // they must stay separate.
  if (ariaHidden !== undefined) {
    result.accessibilityElementsHidden = ariaHidden;
    if (ariaHidden === true) result.importantForAccessibility = 'no-hide-descendants';
  }
  if (tabIndex !== undefined) result.focusable = !tabIndex;

  if (
    accessibilityState != null ||
    ariaBusy != null ||
    ariaChecked != null ||
    ariaDisabled != null ||
    ariaExpanded != null ||
    ariaSelected != null
  ) {
    result.accessibilityState = {
      busy: ariaBusy ?? accessibilityState?.busy,
      checked: ariaChecked ?? accessibilityState?.checked,
      disabled: ariaDisabled ?? accessibilityState?.disabled,
      expanded: ariaExpanded ?? accessibilityState?.expanded,
      selected: ariaSelected ?? accessibilityState?.selected,
    };
  }

  if (
    accessibilityValue != null ||
    ariaValueMax != null ||
    ariaValueMin != null ||
    ariaValueNow != null ||
    ariaValueText != null
  ) {
    result.accessibilityValue = {
      max: ariaValueMax ?? accessibilityValue?.max,
      min: ariaValueMin ?? accessibilityValue?.min,
      now: ariaValueNow ?? accessibilityValue?.now,
      text: ariaValueText ?? accessibilityValue?.text,
    };
  }

  return result;
}

/**
 * Normalizes the Image wrapper's accessibility aliases before props reach `NativeImage`.
 *
 * @remarks
 * Image's rules are close to View's ARIA merge, but not identical: `alt` is an accessibilityLabel
 * fallback and also forces `accessible` on. Keep this separate from `processViewAccessibilityProps`
 * so those Image-only precedence rules stay explicit.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processImageAccessibilityProps(props: Record<string, any>): Record<string, any> {
  const {
    alt,
    accessible,
    accessibilityLabel,
    accessibilityLabelledBy,
    accessibilityState,
    importantForAccessibility,
    ['aria-label']: ariaLabel,
    ['aria-labelledby']: ariaLabelledBy,
    ['aria-busy']: ariaBusy,
    ['aria-checked']: ariaChecked,
    ['aria-disabled']: ariaDisabled,
    ['aria-expanded']: ariaExpanded,
    ['aria-hidden']: ariaHidden,
    ['aria-selected']: ariaSelected,
    ...restProperties
  } = props;

  const result = restProperties;
  const normalizedLabel = ariaLabel ?? accessibilityLabel ?? alt;
  if (normalizedLabel !== undefined) result.accessibilityLabel = normalizedLabel;

  if (Platform.OS === 'android') {
    const normalizedLabelledBy = ariaLabelledBy ?? accessibilityLabelledBy;
    if (normalizedLabelledBy !== undefined) result.accessibilityLabelledBy = normalizedLabelledBy;
  } else if (accessibilityLabelledBy !== undefined) {
    result.accessibilityLabelledBy = accessibilityLabelledBy;
  }

  // The two wrappers resolve `accessible` with DIFFERENT nullish semantics: iOS computes
  // `ariaHidden !== true && (alt !== undefined ? true : accessible)`, while Android (RN >= 0.85)
  // skips a nullish `alt`/`accessible` entirely (`!= null`), so an `alt={null}` forces `accessible`
  // on iOS only.
  if (Platform.OS === 'ios') {
    if (ariaHidden === true) {
      result.accessible = false;
    } else if (alt !== undefined) {
      result.accessible = true;
    } else if (accessible !== undefined) {
      result.accessible = accessible;
    }
  } else if (alt != null) {
    result.accessible = true;
  } else if (accessible != null) {
    result.accessible = accessible;
  }

  if (ariaHidden === true && Platform.OS !== 'ios') {
    result.importantForAccessibility = 'no-hide-descendants';
  } else if (importantForAccessibility !== undefined) {
    result.importantForAccessibility = importantForAccessibility;
  }

  if (Platform.OS === 'ios' && accessibilityState !== undefined) {
    result.accessibilityState = accessibilityState;
  } else if (
    accessibilityState != null ||
    ariaBusy != null ||
    ariaChecked != null ||
    ariaDisabled != null ||
    ariaExpanded != null ||
    ariaSelected != null
  ) {
    result.accessibilityState = {
      busy: ariaBusy ?? accessibilityState?.busy,
      checked: ariaChecked ?? accessibilityState?.checked,
      disabled: ariaDisabled ?? accessibilityState?.disabled,
      expanded: ariaExpanded ?? accessibilityState?.expanded,
      selected: ariaSelected ?? accessibilityState?.selected,
    };
  }

  return result;
}

export * from './types';
export * from './utils/constants';
export * from './components/native-text';
export * from './components/native-view';
export { NativeImage } from './components/native-image';
