import { NodePath, types as t } from '@babel/core';
import type { HubFile, JSXOptimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import { BailoutCheck, getFirstBailoutReason } from '../../utils/helpers';
import {
  addFileImportHint,
  createStyleOriginResolver,
  isForcedLine,
  isIgnoredLine,
  isReactNativeComponent,
  isStaticLiteralTree,
  makeAttribute,
  replaceWithNativeComponent,
} from '../../utils/common';
import { RUNTIME_MODULE_NAME } from '../../utils/constants';
import { createJSXOptimizer } from '../../utils/optimizer';

const CONSUMED_PROPS = new Set([
  'animating',
  'children',
  'color',
  'hidesWhenStopped',
  'key',
  'onLayout',
  'ref',
  'size',
  'style',
]);

const optimizeNativeActivityIndicator: JSXOptimizer = (path, { logger, platform, unistylesEnabled, options }) => {
  if (platform === 'web') return;
  if (!isReactNativeComponent(path, 'ActivityIndicator')) return;

  if (platform !== 'ios' && platform !== 'android') {
    logger.skipped({ target: 'ActivityIndicator', path, reason: 'target platform is unknown' });
    return;
  }

  const parent = path.parent as t.JSXElement;
  const forced = isForcedLine(path);
  const getStyleOrigin = createStyleOriginResolver(path, unistylesEnabled);

  const bailoutChecks: BailoutCheck[] = [
    {
      reason: 'has a Unistyles style that cannot be moved to the generated outer host',
      shouldBail: () => getStyleOrigin() === 'unistyles',
    },
    {
      reason: 'has spread props',
      shouldBail: () => path.node.attributes.some((attribute) => t.isJSXSpreadAttribute(attribute)),
    },
    {
      reason: 'contains children',
      shouldBail: () =>
        findAttribute(path.node.attributes, 'children') !== undefined ||
        parent.children.some((child) => !t.isJSXText(child) || child.value.trim() !== ''),
    },
    {
      reason: 'contains an impure prop expression that cannot be safely reordered',
      shouldBail: () => hasImpureAttributeValue(path),
    },
    {
      reason: 'has an unresolved style source that may be a Unistyles style',
      shouldBail: () => getStyleOrigin() === 'unknown',
    },
  ];

  if (forced) {
    const overriddenReason = getFirstBailoutReason(bailoutChecks);
    if (overriddenReason) logger.forced({ target: 'ActivityIndicator', path, reason: overriddenReason });
  } else {
    const skipReason = getFirstBailoutReason([
      {
        reason: 'line is marked with @boost-ignore',
        shouldBail: () => isIgnoredLine(path),
      },
      ...bailoutChecks,
    ]);
    if (skipReason) {
      logger.skipped({ target: 'ActivityIndicator', path, reason: skipReason });
      return;
    }
  }

  const hub = path.hub as unknown;
  const file = typeof hub === 'object' && hub !== null && 'file' in hub ? (hub.file as HubFile) : undefined;
  if (!file) throw new PluginError('No file found in Babel hub');

  if (options?.integrations?.uniwind === 'on') {
    replaceWithNativeComponent(path, parent, file, 'NativeActivityIndicator', {
      moduleName: 'react-native-boost/uniwind',
    });
    logger.optimized({ target: 'ActivityIndicator', path });
    return;
  }

  const view = addRuntimeImport(path, file, 'NativeView');
  const styles = addRuntimeImport(path, file, 'activityIndicatorStyles');
  const host = addRuntimeImport(path, file, 'NativeActivityIndicator');
  const attributes = path.node.attributes;
  const animating = buildDefaultedAttribute(path, file, attributes, 'animating', t.booleanLiteral(true));
  const color = buildDefaultedAttribute(
    path,
    file,
    attributes,
    'color',
    platform === 'ios' ? t.stringLiteral('#999999') : t.nullLiteral()
  );
  const hidesWhenStopped = buildDefaultedAttribute(path, file, attributes, 'hidesWhenStopped', t.booleanLiteral(true));
  const sizeAttributes = buildSizeAttributes(path, file, attributes, styles);
  const outerStyle = buildOuterStyle(path, file, attributes, styles);

  const remaining = attributes
    .filter(
      (attribute) =>
        !t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name) || !CONSUMED_PROPS.has(attribute.name.name)
    )
    .map((attribute) => t.cloneNode(attribute, true));

  const ref = findAttribute(attributes, 'ref');
  const onLayout = findAttribute(attributes, 'onLayout');
  const key = findAttribute(attributes, 'key');

  const innerAttributes: Array<t.JSXAttribute | t.JSXSpreadAttribute> = [
    animating,
    color,
    hidesWhenStopped,
    ...remaining,
    ref ? t.cloneNode(ref, true) : undefined,
    ...sizeAttributes,
    platform === 'android' ? makeAttribute('styleAttr', t.stringLiteral('Normal')) : undefined,
    platform === 'android' ? makeAttribute('indeterminate', t.booleanLiteral(true)) : undefined,
  ].filter((attribute): attribute is t.JSXAttribute | t.JSXSpreadAttribute => attribute !== undefined);

  const inner = t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(host.name), innerAttributes, true), null, [], true);
  const outerAttributes = [
    key ? t.cloneNode(key, true) : undefined,
    onLayout ? t.cloneNode(onLayout, true) : undefined,
    makeAttribute('style', outerStyle),
  ].filter((attribute): attribute is t.JSXAttribute => attribute !== undefined);
  const outer = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier(view.name), outerAttributes, false),
    t.jsxClosingElement(t.jsxIdentifier(view.name)),
    [inner],
    false
  );

  t.inheritsComments(outer, parent);
  logger.optimized({ target: 'ActivityIndicator', path });
  path.parentPath.replaceWith(outer);
};

export const nativeActivityIndicatorOptimizer = createJSXOptimizer(
  'native-activity-indicator',
  optimizeNativeActivityIndicator
);

function addRuntimeImport(path: NodePath<t.JSXOpeningElement>, file: HubFile, importName: string): t.Identifier {
  return addFileImportHint({
    file,
    nameHint: importName,
    path,
    importName,
    moduleName: RUNTIME_MODULE_NAME,
  });
}

function buildDefaultedAttribute(
  path: NodePath<t.JSXOpeningElement>,
  file: HubFile,
  attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>,
  name: string,
  fallback: t.Expression
): t.JSXAttribute {
  const attribute = findAttribute(attributes, name);
  if (!attribute) return makeAttribute(name, fallback);

  const value = getAttributeValueExpression(attribute);
  if (isDefinitelyDefined(value)) return makeAttribute(name, t.cloneNode(value, true));

  const resolver = addRuntimeImport(path, file, 'resolveActivityIndicatorDefault');
  return makeAttribute(
    name,
    t.callExpression(t.identifier(resolver.name), [t.cloneNode(value, true), t.cloneNode(fallback, true)])
  );
}

function buildSizeAttributes(
  path: NodePath<t.JSXOpeningElement>,
  file: HubFile,
  attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>,
  styles: t.Identifier
): Array<t.JSXAttribute | t.JSXSpreadAttribute> {
  const attribute = findAttribute(attributes, 'size');
  if (!attribute) return staticSizeAttributes('small', styles);

  const value = getAttributeValueExpression(attribute);
  if (isStaticLiteralTree(value)) {
    if (t.isStringLiteral(value) && (value.value === 'small' || value.value === 'large')) {
      return staticSizeAttributes(value.value, styles);
    }
    return [
      makeAttribute(
        'style',
        t.objectExpression([
          t.objectProperty(t.identifier('height'), t.cloneNode(value, true)),
          t.objectProperty(t.identifier('width'), t.cloneNode(value, true)),
        ])
      ),
    ];
  }

  const resolver = addRuntimeImport(path, file, 'processActivityIndicatorSize');
  return [t.jsxSpreadAttribute(t.callExpression(t.identifier(resolver.name), [t.cloneNode(value, true)]))];
}

function staticSizeAttributes(size: 'small' | 'large', styles: t.Identifier): t.JSXAttribute[] {
  return [
    makeAttribute('style', t.memberExpression(t.identifier(styles.name), t.identifier(size))),
    makeAttribute('size', t.stringLiteral(size)),
  ];
}

function buildOuterStyle(
  path: NodePath<t.JSXOpeningElement>,
  file: HubFile,
  attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>,
  styles: t.Identifier
): t.Expression {
  const container = t.memberExpression(t.identifier(styles.name), t.identifier('container'));
  const attribute = findAttribute(attributes, 'style');
  if (!attribute) return container;

  const value = getAttributeValueExpression(attribute);
  const truthiness = getStaticTruthiness(value);
  if (truthiness === false) return container;
  if (truthiness === true) return t.arrayExpression([container, t.cloneNode(value, true)]);

  const resolver = addRuntimeImport(path, file, 'processActivityIndicatorStyle');
  return t.callExpression(t.identifier(resolver.name), [t.cloneNode(value, true)]);
}

function findAttribute(
  attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>,
  name: string
): t.JSXAttribute | undefined {
  return attributes.findLast(
    (attribute): attribute is t.JSXAttribute =>
      t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name })
  );
}

function getAttributeValueExpression(attribute: t.JSXAttribute): t.Expression {
  if (!attribute.value) return t.booleanLiteral(true);
  if (t.isStringLiteral(attribute.value)) return attribute.value;
  if (t.isJSXExpressionContainer(attribute.value)) {
    return t.isJSXEmptyExpression(attribute.value.expression) ? t.booleanLiteral(true) : attribute.value.expression;
  }
  return t.nullLiteral();
}

function isDefinitelyDefined(expression: t.Expression): boolean {
  return (
    isStaticLiteralTree(expression) ||
    t.isArrowFunctionExpression(expression) ||
    t.isFunctionExpression(expression) ||
    t.isTemplateLiteral(expression)
  );
}

function getStaticTruthiness(expression: t.Expression): boolean | undefined {
  if (t.isNullLiteral(expression)) return false;
  if (t.isBooleanLiteral(expression)) return expression.value;
  if (t.isStringLiteral(expression)) return expression.value.length > 0;
  if (t.isNumericLiteral(expression)) return expression.value !== 0 && !Number.isNaN(expression.value);
  if (t.isUnaryExpression(expression) && expression.operator === '-' && t.isNumericLiteral(expression.argument)) {
    return expression.argument.value !== 0;
  }
  if (t.isObjectExpression(expression) || t.isArrayExpression(expression)) return true;
  return undefined;
}

function hasImpureAttributeValue(path: NodePath<t.JSXOpeningElement>): boolean {
  return path.node.attributes.some((attribute) => {
    if (!t.isJSXAttribute(attribute) || !t.isJSXExpressionContainer(attribute.value)) return false;
    if (t.isJSXEmptyExpression(attribute.value.expression)) return false;
    return !path.scope.isPure(attribute.value.expression);
  });
}
