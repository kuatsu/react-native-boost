import { NodePath, types as t } from '@babel/core';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import { BailoutCheck, getFirstBailoutReason } from '../../utils/helpers';
import {
  addFileImportHint,
  buildPropertiesFromAttributes,
  hasAmbiguousIdNativeID,
  hasBlacklistedPropertyInSpread,
  isForcedLine,
  isIgnoredLine,
  isValidJSXComponent,
  isReactNativeImport,
  replaceWithNativeComponent,
  ancestorBailoutChecks,
  createStyleOriginResolver,
  UNISTYLES_VIEW_HOST,
} from '../../utils/common';
import { RUNTIME_MODULE_NAME } from '../../utils/constants';

/**
 * Props the `View` wrapper destructures and transforms before handing off to its native host. The
 * optimizer reproduces each translation for direct attributes, but it cannot reach inside a spread —
 * so a spread that might carry any of these forces a bail (an unresolvable spread bails
 * unconditionally). `nativeID` is intentionally absent: the wrapper does not destructure it (it passes
 * through verbatim), and the `id` → `nativeID` precedence is preserved by emitting the rename last.
 */
const VIEW_SPREAD_GUARD_KEYS = new Set([
  'accessibilityState',
  'accessibilityValue',
  'aria-busy',
  'aria-checked',
  'aria-disabled',
  'aria-expanded',
  'aria-hidden',
  'aria-label',
  'aria-labelledby',
  'aria-live',
  'aria-selected',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
  'id',
  'tabIndex',
]);

// In Unistyles mode a `style` arriving through a resolvable spread must also bail (it could be a
// Unistyles style), so the guard set additionally includes `style`. Precomputed to avoid rebuilding it
// per element.
const VIEW_SPREAD_GUARD_KEYS_UNISTYLES = new Set([...VIEW_SPREAD_GUARD_KEYS, 'style']);

// ARIA siblings that trigger aggregation. Their presence routes the whole matching group (including a
// passed `accessibilityState`/`accessibilityValue`) through the runtime helper, because the wrapper
// merges them (`ariaX ?? source?.x`) and a partial literal translation could not reproduce that.
const ARIA_STATE_PROPERTIES = new Set(['aria-busy', 'aria-checked', 'aria-disabled', 'aria-expanded', 'aria-selected']);
const ARIA_VALUE_PROPERTIES = new Set(['aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-valuetext']);

export const viewOptimizer: Optimizer = (path, logger, options, _platform, unistylesEnabled) => {
  if (!isValidJSXComponent(path, 'View')) return;
  if (!isReactNativeImport(path, 'View')) return;

  const forced = isForcedLine(path);

  // In Unistyles mode, classify the direct `style` origin (lazily, once). A `style` carried by a
  // resolvable spread is guarded too (`style` is in the Unistyles spread keys); an unresolvable spread
  // already bails. See {@link classifyStyleOrigin}.
  const getStyleOrigin = createStyleOriginResolver(path, unistylesEnabled);

  const spreadGuardKeys = unistylesEnabled ? VIEW_SPREAD_GUARD_KEYS_UNISTYLES : VIEW_SPREAD_GUARD_KEYS;

  const overridableChecks: BailoutCheck[] = [
    {
      reason: 'has a spread that may carry a translated prop',
      shouldBail: () => hasBlacklistedPropertyInSpread(path, spreadGuardKeys),
    },
    {
      reason: 'has an unresolved style source that may be a Unistyles style',
      shouldBail: () => getStyleOrigin() === 'unknown',
    },
    {
      reason: 'has both a dynamic `id` and a `nativeID` (ambiguous precedence)',
      shouldBail: () => hasAmbiguousIdNativeID(path),
    },
    ...ancestorBailoutChecks(
      path,
      options?.dangerouslyOptimizeViewWithUnknownAncestors === true,
      options?.transparentWrappers
    ),
  ];

  if (forced) {
    const overriddenReason = getFirstBailoutReason(overridableChecks);

    if (overriddenReason) {
      logger.forced({ component: 'View', path, reason: overriddenReason });
    }
  } else {
    const skipReason = getFirstBailoutReason([
      {
        reason: 'line is marked with @boost-ignore',
        shouldBail: () => isIgnoredLine(path),
      },
      ...overridableChecks,
    ]);

    if (skipReason) {
      logger.skipped({ component: 'View', path, reason: skipReason });
      return;
    }
  }

  const hub = path.hub as unknown;
  const file = typeof hub === 'object' && hub !== null && 'file' in hub ? (hub.file as HubFile) : undefined;

  if (!file) {
    throw new PluginError('No file found in Babel hub');
  }

  logger.optimized({
    component: 'View',
    path,
  });

  const parent = path.parent as t.JSXElement;

  processViewProps(path, file);

  // A Unistyles-styled View routes to Unistyles' lean host (a registering wrapper around `RCTView`) so
  // its shadow-tree registration survives; the `style` already passes through verbatim. Everything else
  // optimizes to Boost's own raw host as usual.
  const viewHost = getStyleOrigin() === 'unistyles' ? UNISTYLES_VIEW_HOST : undefined;
  replaceWithNativeComponent(path, parent, file, 'NativeView', viewHost);
};

/**
 * Reproduces the `View` wrapper's ergonomic-prop translation for an optimized element: renames
 * `id` → `nativeID`, translates the ARIA cluster / `tabIndex` into their native counterparts, and
 * aggregates ARIA state/value fields. Static literals are translated at build time (no runtime call);
 * dynamic values and aggregated groups are routed through `processViewAccessibilityProps`.
 *
 * Translated props are emitted LAST so they win over any pass-through spread carrying the same native
 * key — mirroring the wrapper, which applies its translations on top of `...otherProps`.
 */
function processViewProps(path: NodePath<t.JSXOpeningElement>, file: HubFile) {
  const currentAttributes = [...path.node.attributes];

  const stateGroupTriggered = currentAttributes.some((attribute) => isAriaStateAttribute(attribute));
  const valueGroupTriggered = currentAttributes.some((attribute) => isAriaValueAttribute(attribute));

  const literalReplacements: t.JSXAttribute[] = [];
  const helperBag: t.JSXAttribute[] = [];
  const consumed = new Set<t.JSXAttribute>();

  for (const attribute of currentAttributes) {
    if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)) continue;
    const name = attribute.name.name;

    // Aggregation groups → route every present member (including a passed base prop) through the
    // helper, but only when an ARIA sibling forces the merge. A lone `accessibilityState`/
    // `accessibilityValue` is value-equal to a pass-through after normalization, so it is left alone.
    if ((name === 'accessibilityState' || ARIA_STATE_PROPERTIES.has(name)) && stateGroupTriggered) {
      helperBag.push(attribute);
      consumed.add(attribute);
      continue;
    }
    if ((name === 'accessibilityValue' || ARIA_VALUE_PROPERTIES.has(name)) && valueGroupTriggered) {
      helperBag.push(attribute);
      consumed.add(attribute);
      continue;
    }

    // `id` → `nativeID`, emitted with the other translations (LAST) so it wins over a pass-through
    // spread carrying `nativeID` — mirroring the wrapper's `if (id !== undefined) nativeID = id`. The
    // `nativeID` target key then drops a colliding direct `nativeID` via the dedup below, so `id` wins.
    if (name === 'id') {
      literalReplacements.push(makeAttribute('nativeID', getAttributeValueExpression(attribute)));
      consumed.add(attribute);
      continue;
    }

    // `tabIndex` → `focusable = !tabIndex`. A static numeric/boolean literal folds to a constant; a
    // dynamic value routes through the helper, which omits `focusable` when `tabIndex` is `undefined`
    // (a build-time `!tabIndex` would wrongly emit `focusable={true}`, diverging from the wrapper).
    if (name === 'tabIndex') {
      const value = getAttributeValueExpression(attribute);
      if (t.isNumericLiteral(value) || t.isBooleanLiteral(value)) {
        literalReplacements.push(makeAttribute('focusable', t.booleanLiteral(!value.value)));
      } else {
        helperBag.push(attribute);
      }
      consumed.add(attribute);
      continue;
    }

    // Remaining single-prop translations: literal fast path when static, else the runtime helper.
    const literal = tryLiteralTranslate(name, attribute);
    if (literal) {
      literalReplacements.push(...literal);
      consumed.add(attribute);
      continue;
    }
    if (name === 'aria-label' || name === 'aria-live' || name === 'aria-hidden' || name === 'aria-labelledby') {
      helperBag.push(attribute);
      consumed.add(attribute);
    }
  }

  const spreadAttributes: t.JSXSpreadAttribute[] = [];
  if (helperBag.length > 0) {
    const helperIdentifier = addFileImportHint({
      file,
      nameHint: 'processViewAccessibilityProps',
      path,
      importName: 'processViewAccessibilityProps',
      moduleName: RUNTIME_MODULE_NAME,
    });
    const bag = buildPropertiesFromAttributes(helperBag);
    spreadAttributes.push(t.jsxSpreadAttribute(t.callExpression(t.identifier(helperIdentifier.name), [bag])));
  }

  // A pass-through direct attribute whose key a literal translation also sets would be superseded by
  // that translation (emitted last); drop it so the output carries no duplicate attribute.
  const literalTargetKeys = new Set(literalReplacements.map((attribute) => (attribute.name as t.JSXIdentifier).name));

  const remaining = currentAttributes.filter((attribute) => {
    if (t.isJSXAttribute(attribute) && consumed.has(attribute)) return false;
    if (
      t.isJSXAttribute(attribute) &&
      t.isJSXIdentifier(attribute.name) &&
      literalTargetKeys.has(attribute.name.name)
    ) {
      return false;
    }
    return true;
  });

  path.node.attributes = [...remaining, ...literalReplacements, ...spreadAttributes];
}

const isAriaStateAttribute = (attribute: t.JSXAttribute | t.JSXSpreadAttribute): attribute is t.JSXAttribute =>
  t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name) && ARIA_STATE_PROPERTIES.has(attribute.name.name);

const isAriaValueAttribute = (attribute: t.JSXAttribute | t.JSXSpreadAttribute): attribute is t.JSXAttribute =>
  t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name) && ARIA_VALUE_PROPERTIES.has(attribute.name.name);

/**
 * Translates a single non-aggregated ARIA prop to its native counterpart when its value is a static
 * literal, returning the attribute(s) to emit. Returns `undefined` when the value is dynamic, so the
 * caller routes it through the runtime helper instead.
 */
function tryLiteralTranslate(name: string, attribute: t.JSXAttribute): t.JSXAttribute[] | undefined {
  const value = getAttributeValueExpression(attribute);

  switch (name) {
    case 'aria-label': {
      if (t.isStringLiteral(value)) return [makeAttribute('accessibilityLabel', value)];
      return undefined;
    }
    case 'aria-live': {
      if (t.isStringLiteral(value)) {
        const region = value.value === 'off' ? 'none' : value.value;
        return [makeAttribute('accessibilityLiveRegion', t.stringLiteral(region))];
      }
      return undefined;
    }
    case 'aria-hidden': {
      if (t.isBooleanLiteral(value)) {
        const attributes = [makeAttribute('accessibilityElementsHidden', value)];
        if (value.value === true) {
          attributes.push(makeAttribute('importantForAccessibility', t.stringLiteral('no-hide-descendants')));
        }
        return attributes;
      }
      return undefined;
    }
    case 'aria-labelledby': {
      if (t.isStringLiteral(value)) {
        const parts = value.value.split(/\s*,\s*/g).map((part) => t.stringLiteral(part));
        return [makeAttribute('accessibilityLabelledBy', t.arrayExpression(parts))];
      }
      return undefined;
    }
  }

  return undefined;
}

/**
 * Resolves a JSX attribute's value to an expression: a shorthand attribute (or empty expression
 * container) becomes boolean `true`; a string literal and a non-empty expression container carry
 * through unchanged.
 */
function getAttributeValueExpression(attribute: t.JSXAttribute): t.Expression {
  if (!attribute.value) return t.booleanLiteral(true);
  if (t.isStringLiteral(attribute.value)) return attribute.value;
  if (t.isJSXExpressionContainer(attribute.value)) {
    return t.isJSXEmptyExpression(attribute.value.expression) ? t.booleanLiteral(true) : attribute.value.expression;
  }
  return t.nullLiteral();
}

/**
 * Builds a JSX attribute, emitting a string literal directly as the value (`name="x"`) and wrapping
 * any other expression in a container (`name={expr}`).
 */
function makeAttribute(name: string, value: t.Expression): t.JSXAttribute {
  return t.jsxAttribute(t.jsxIdentifier(name), t.isStringLiteral(value) ? value : t.jsxExpressionContainer(value));
}
