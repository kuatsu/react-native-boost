import { TextProps, TextStyle, StyleSheet, Platform, processColor as rnProcessColor } from 'react-native';
import type { ColorValue, ProcessedColorValue } from 'react-native';
import { GenericStyleProp } from './types';
import { userSelectToSelectableMap, verticalAlignToTextAlignVerticalMap } from './utils/constants';

const propsCache = new WeakMap();

// Resolve RN's `processColor` once. The `typeof` guard degrades to a passthrough on
// a non-RN host that lacks it (see {@link processSelectionColor}); the web build never reaches this — it
// uses the separate `index.web.ts` shim.
const processColor: ((color?: ColorValue | number) => ProcessedColorValue | null | undefined) | undefined =
  typeof rnProcessColor === 'function' ? rnProcessColor : undefined;

/**
 * Normalizes `Text` style values for `NativeText`.
 *
 * @param style - Style prop passed to a text-like component.
 * @returns Native-friendly text props. Returns an empty object when `style` is falsy or cannot be normalized.
 * @remarks
 * - Flattens style arrays via `StyleSheet.flatten`
 * - Converts numeric `fontWeight` values to string values
 * - Maps `userSelect` and `verticalAlign` to native-compatible props
 */
export function processTextStyle(style: GenericStyleProp<TextStyle>): Partial<TextProps> {
  if (!style) return {};

  // Cache the computed props
  let props = propsCache.get(style);
  if (props) return props;

  props = {};
  propsCache.set(style, props);

  style = StyleSheet.flatten(style) as TextStyle;

  if (!style) return {};

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

  props.style = style;
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
export function processAccessibilityProps(props: Record<string, any>): Record<string, any> {
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
 * Unlike {@link processAccessibilityProps} (the `Text` helper) there is no `accessible` default and no
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

export * from './types';
export * from './utils/constants';
export * from './components/native-text';
export * from './components/native-view';
export * from './components/native-image';
