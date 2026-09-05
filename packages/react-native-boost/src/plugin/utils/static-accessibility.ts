import { type NodePath, types as t } from '@babel/core';
import { buildPropertiesFromAttributes, makeAttribute } from './common/attributes';

type Primitive = string | number | boolean | null | undefined;
type Literal = Primitive | { [key: string]: Primitive } | string[];
type Props = Record<string, Literal>;
const unknown = Symbol('unknown');
const stateKeys = ['busy', 'checked', 'disabled', 'expanded', 'selected'];
const valueKeys = ['max', 'min', 'now', 'text'];

// Only syntax-owned scalar fields qualify. Never follow bindings or invoke Babel's evaluator.
function readLiteral(node: t.Node, path: NodePath<t.JSXOpeningElement>, object = true): Literal | typeof unknown {
  if (t.isNullLiteral(node)) return null;
  if (t.isStringLiteral(node) || t.isBooleanLiteral(node) || t.isNumericLiteral(node)) return node.value;
  if (t.isIdentifier(node, { name: 'undefined' }) && !path.scope.getBinding('undefined')) return undefined;
  if (t.isUnaryExpression(node) && t.isNumericLiteral(node.argument)) {
    if (node.operator === '-') return -node.argument.value;
    if (node.operator === 'void') return undefined;
  }
  if (object && t.isArrayExpression(node) && node.elements.every((element) => t.isStringLiteral(element)))
    return node.elements.map((element) => (element as t.StringLiteral).value);
  if (!object || !t.isObjectExpression(node)) return unknown;
  const result: Record<string, Primitive> = {};
  for (const property of node.properties) {
    if (!t.isObjectProperty(property) || property.computed) return unknown;
    const key = t.isIdentifier(property.key)
      ? property.key.name
      : t.isStringLiteral(property.key)
        ? property.key.value
        : undefined;
    if (key === undefined || key === '__proto__' || Object.hasOwn(result, key)) return unknown;
    const value = readLiteral(property.value, path, false);
    if (value === unknown || (value !== null && typeof value === 'object')) return unknown;
    result[key] = value;
  }
  return result;
}

function expression(value: Literal): t.Expression {
  if (value === undefined) return t.unaryExpression('void', t.numericLiteral(0));
  if (Array.isArray(value)) return t.arrayExpression(value.map((item) => t.stringLiteral(item)));
  if (value !== null && typeof value === 'object') {
    return t.objectExpression(
      Object.entries(value).map(([key, field]) => t.objectProperty(t.stringLiteral(key), expression(field)))
    );
  }
  return t.valueToNode(value);
}

/** Returns direct props only when the entire helper input is closed and its native target is known. */
export function foldAccessibility(
  path: NodePath<t.JSXOpeningElement>,
  attributes: t.JSXAttribute[],
  component: 'Text' | 'View' | 'Image',
  platform?: string,
  minor?: number
): t.JSXAttribute[] | undefined {
  if ((platform !== 'ios' && platform !== 'android') || minor === undefined || minor < 83 || minor > 87) return;
  const names = new Set<string>();
  for (const attribute of path.node.attributes) {
    if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name) || names.has(attribute.name.name)) return;
    names.add(attribute.name.name);
  }
  if (
    attributes.some(
      (attribute) =>
        attribute.value !== null &&
        !t.isStringLiteral(attribute.value) &&
        !(t.isJSXExpressionContainer(attribute.value) && t.isExpression(attribute.value.expression))
    )
  )
    return;
  const props: Props = {};
  for (const property of buildPropertiesFromAttributes(attributes).properties) {
    if (!t.isObjectProperty(property)) return;
    const key = t.isIdentifier(property.key) ? property.key.name : (property.key as t.StringLiteral).value;
    const value = readLiteral(property.value, path);
    if (value === unknown) return;
    if (Array.isArray(value)) {
      if (key !== 'accessibilityLabelledBy') return;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      key !== 'accessibilityState' &&
      key !== 'accessibilityValue'
    )
      return;
    if ((key === 'accessibilityState' || key === 'accessibilityValue') && value != null && typeof value !== 'object')
      return;
    props[key] = value;
  }
  const result =
    component === 'Text'
      ? textProps(props, platform, minor)
      : component === 'Image'
        ? imageProps(props, platform, minor)
        : viewProps(props);
  if (!result) return;
  return Object.entries(result).map(([key, value]) => makeAttribute(key, expression(value)));
}

function merge(props: Props, name: string, keys: string[], prefix = 'aria-') {
  const base = props[name] as Record<string, Primitive> | null | undefined;
  return Object.fromEntries(keys.map((key) => [key, props[prefix + key] ?? base?.[key]])) as Record<string, Primitive>;
}

function textProps(props: Props, platform: string, minor: number): Props {
  const result = { ...props };
  for (const key of [
    'accessibilityLabel',
    'accessibilityState',
    'accessible',
    'disabled',
    'aria-label',
    'aria-hidden',
    ...stateKeys.map((key) => 'aria-' + key),
  ])
    delete result[key];
  let state = props.accessibilityState as Record<string, Primitive> | null | undefined;
  if (stateKeys.some((key) => props['aria-' + key] != null)) {
    state =
      state == null
        ? (Object.fromEntries(stateKeys.map((key) => [key, props['aria-' + key]])) as Record<string, Primitive>)
        : merge(props, 'accessibilityState', stateKeys);
  }
  const disabled = (props.disabled ?? state?.disabled) as Primitive;
  if (
    disabled !== state?.disabled &&
    ((disabled != null && disabled !== false) || (state?.disabled != null && state.disabled !== false))
  )
    state = { ...state, disabled };
  if (minor >= 84) {
    delete result.accessibilityRole;
    delete result.role;
    if (minor === 84 || props.accessibilityRole != null)
      result.accessibilityRole = props.accessibilityRole ?? undefined;
    if (minor === 84 || props.role !== undefined) result.role = props.role;
  }
  const label = props['aria-label'] ?? props.accessibilityLabel;
  if (minor < 85 || label !== undefined) result.accessibilityLabel = label;
  if (minor < 85 || state !== undefined) result.accessibilityState = state;
  // The renderer can flatten state.disabled onto disabled; Text writes its reconciled prop last.
  result.accessible = platform === 'ios' ? props.accessible !== false : (props.accessible ?? false);
  result.disabled = disabled;
  const hidden = props['aria-hidden'];
  if (minor < 85 || hidden !== undefined)
    result.accessibilityElementsHidden = minor < 85 ? (hidden ?? props.accessibilityElementsHidden) : hidden;
  if (minor < 85 || hidden === true)
    result.importantForAccessibility = hidden === true ? 'no-hide-descendants' : props.importantForAccessibility;
  return result;
}

function viewProps(props: Props): Props | undefined {
  const result = { ...props };
  for (const key of Object.keys(result))
    if (key.startsWith('aria-') || key === 'tabIndex' || key === 'accessibilityState' || key === 'accessibilityValue')
      delete result[key];
  const labelledBy = props['aria-labelledby'];
  // Array output belongs to View's existing single-alias fast path.
  if (labelledBy != null) return;
  if (props['aria-label'] !== undefined) result.accessibilityLabel = props['aria-label'];
  if (props['aria-live'] !== undefined)
    result.accessibilityLiveRegion = props['aria-live'] === 'off' ? 'none' : props['aria-live'];
  if (props['aria-hidden'] !== undefined) result.accessibilityElementsHidden = props['aria-hidden'];
  if (props['aria-hidden'] === true) result.importantForAccessibility = 'no-hide-descendants';
  if (props.tabIndex !== undefined) result.focusable = !props.tabIndex;
  for (const [name, keys, prefix] of [
    ['accessibilityState', stateKeys, 'aria-'],
    ['accessibilityValue', valueKeys, 'aria-value'],
  ] as const) {
    if (props[name] != null || keys.some((key) => props[prefix + key] != null))
      result[name] = merge(props, name, keys, prefix);
  }
  return result;
}

function imageProps(props: Props, platform: string, minor: number): Props {
  const result = { ...props };
  const legacy = minor < 85;
  if (platform === 'android' && !legacy) {
    for (const key of Object.keys(result))
      if (
        key.startsWith('aria-') ||
        ['alt', 'accessible', 'accessibilityLabel', 'accessibilityLabelledBy', 'accessibilityState'].includes(key)
      )
        delete result[key];
  } else if (platform === 'ios') {
    for (const key of ['aria-hidden', ...stateKeys.map((key) => 'aria-' + key)]) delete result[key];
  }
  const label = props['aria-label'] ?? props.accessibilityLabel ?? props.alt;
  const labelledBy = props['aria-labelledby'] ?? props.accessibilityLabelledBy;
  if (platform === 'ios' || legacy || label != null) result.accessibilityLabel = label;
  if (platform === 'android' && (legacy || labelledBy != null)) result.accessibilityLabelledBy = labelledBy;
  if (platform === 'ios')
    result.accessible = props['aria-hidden'] !== true && (props.alt === undefined ? props.accessible : true);
  else if (legacy) result.accessible = props.alt === undefined ? props.accessible : true;
  else if (props.alt != null || props.accessible != null)
    result.accessible = props.alt == null ? props.accessible : true;
  if (platform === 'android' && (legacy || props['aria-hidden'] === true))
    result.importantForAccessibility =
      props['aria-hidden'] === true ? 'no-hide-descendants' : props.importantForAccessibility;
  if (platform === 'ios')
    result.accessibilityState = Object.hasOwn(props, 'accessibilityState')
      ? props.accessibilityState
      : merge(props, 'accessibilityState', stateKeys);
  else if (legacy || props.accessibilityState != null || stateKeys.some((key) => props['aria-' + key] != null))
    result.accessibilityState = merge(props, 'accessibilityState', stateKeys);
  return result;
}
