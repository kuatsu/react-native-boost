import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parseSync, traverse, types as t } from '@babel/core';

/**
 * The set of attributes the native host components (`RCTView` / `RCTText`) actually understand —
 * the keys of their `validAttributes` view config. Any prop the plugin leaves on an optimized host
 * element that is NOT in this set is silently dropped from the native attribute payload, which is
 * exactly the bug class the conformance test guards against (e.g. a wrapper-only `aria-*` /
 * `tabIndex` prop passed through unchanged).
 *
 * The set is derived from the *installed* React Native's view-config source so it tracks the RN
 * version instead of being hand-maintained. These are static object literals, so we parse them and
 * read the `validAttributes` keys directly — no React Native runtime required. The View set unions
 * both platforms (a prop valid on either is understood by the native side on that platform); the
 * Text set adds the text-component attributes on top of the base view attributes (which RCTText
 * inherits natively).
 *
 * The extraction only assumes the stable `validAttributes: { ... }` view-config shape with same-file
 * spreads; it does not hardcode attribute names. A drastic RN restructure shows up as a too-small
 * set, which the conformance test asserts against.
 */

const resolveReactNative = createRequire(import.meta.url).resolve;

const VIEW_CONFIG_SOURCES = {
  viewIos: 'Libraries/NativeComponent/BaseViewConfig.ios.js',
  viewAndroid: 'Libraries/NativeComponent/BaseViewConfig.android.js',
  text: 'Libraries/Text/TextNativeComponent.js',
  image: 'Libraries/Image/ImageViewNativeComponent.js',
} as const;

/**
 * React Native's own Flow parser (which emits Babel-compatible ASTs in `babel` mode), resolved
 * through the installed react-native's dependency chain so its supported syntax always matches the
 * RN sources we parse. Undefined when the chain no longer ships it.
 */
const hermesParser = (() => {
  try {
    const requireFromReactNative = createRequire(resolveReactNative('react-native/package.json'));
    const requireFromHermesPlugin = createRequire(
      requireFromReactNative.resolve('babel-plugin-syntax-hermes-parser/package.json')
    );
    return requireFromHermesPlugin('hermes-parser') as {
      parse(source: string, options: Record<string, unknown>): t.File;
    };
  } catch {
    return undefined;
  }
})();

/**
 * Reads and parses a React Native source file. The configs are `@flow` and use Flow `as` casts,
 * which no Babel dialect fully accepts (`flow` rejects the casts, `typescript` rejects object-type
 * spreads), so we parse with RN's own hermes-parser and keep the Babel dialects as a fallback for
 * RN versions that don't ship it (or hypothetically move these files to TypeScript).
 */
function parseReactNativeSource(subpath: string): t.File {
  const source = readFileSync(resolveReactNative(`react-native/${subpath}`), 'utf8');

  let lastError: unknown;
  if (hermesParser) {
    try {
      return hermesParser.parse(source, { babel: true, sourceType: 'module' });
    } catch (error) {
      lastError = error;
    }
  }

  const dialects = [['flow'], ['flow', 'jsx'], ['typescript'], ['typescript', 'jsx']] as const;
  for (const plugins of dialects) {
    try {
      const ast = parseSync(source, {
        configFile: false,
        babelrc: false,
        parserOpts: { sourceType: 'module', plugins: [...plugins] },
      });
      if (ast) return ast;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `react-native-boost: could not parse React Native source "${subpath}" with any known dialect ` +
      `(last error: ${lastError instanceof Error ? lastError.message : String(lastError)}).`
  );
}

/**
 * Extracts the union of all `validAttributes` keys declared in a view-config file, resolving same-
 * file `...spread` references (an object literal, or a call wrapping one such as
 * `ConditionallyIgnoredEventHandlers({ ... })`) and peeling `as const` casts.
 */
function extractValidAttributeKeys(subpath: string): Set<string> {
  const ast = parseReactNativeSource(subpath);

  const topLevelConsts = new Map<string, t.Expression>();
  for (const statement of ast.program.body) {
    const declaration =
      t.isExportNamedDeclaration(statement) && statement.declaration ? statement.declaration : statement;
    if (t.isVariableDeclaration(declaration)) {
      for (const declarator of declaration.declarations) {
        if (t.isIdentifier(declarator.id) && declarator.init) {
          topLevelConsts.set(declarator.id.name, declarator.init);
        }
      }
    }
  }

  const keys = new Set<string>();

  // Peel type-cast / parenthesized wrappers (e.g. `{ ... } as const`) to reach the underlying object.
  const unwrap = (node: t.Node | undefined | null): t.Node | undefined | null => {
    let current = node;
    while (
      current &&
      (t.isTSAsExpression(current) ||
        t.isTSSatisfiesExpression(current) ||
        t.isTSTypeAssertion(current) ||
        t.isTypeCastExpression(current) ||
        t.isParenthesizedExpression(current))
    ) {
      current = current.expression;
    }
    return current;
  };

  const collectFromExpression = (node: t.Node | undefined | null, seen: Set<t.Node>): void => {
    const expression = unwrap(node);
    if (t.isObjectExpression(expression)) collectKeys(expression, seen);
    else if (t.isCallExpression(expression)) collectFromExpression(expression.arguments[0], seen);
  };

  function collectKeys(object: t.ObjectExpression, seen: Set<t.Node>): void {
    if (seen.has(object)) return;
    seen.add(object);

    for (const property of object.properties) {
      if (t.isObjectProperty(property) && !property.computed) {
        if (t.isIdentifier(property.key)) keys.add(property.key.name);
        else if (t.isStringLiteral(property.key)) keys.add(property.key.value);
      } else if (t.isSpreadElement(property) && t.isIdentifier(property.argument)) {
        collectFromExpression(topLevelConsts.get(property.argument.name), seen);
      }
    }
  }

  traverse(ast, {
    ObjectProperty(path) {
      if (!path.node.computed && t.isIdentifier(path.node.key, { name: 'validAttributes' })) {
        collectFromExpression(path.node.value, new Set());
      }
    },
  });

  return keys;
}

const viewAttributesIos = extractValidAttributeKeys(VIEW_CONFIG_SOURCES.viewIos);
const viewAttributesAndroid = extractValidAttributeKeys(VIEW_CONFIG_SOURCES.viewAndroid);
const textComponentAttributes = extractValidAttributeKeys(VIEW_CONFIG_SOURCES.text);
const imageComponentAttributes = extractValidAttributeKeys(VIEW_CONFIG_SOURCES.image);

export const NATIVE_VIEW_ATTRIBUTES: ReadonlySet<string> = new Set([...viewAttributesIos, ...viewAttributesAndroid]);

export const NATIVE_TEXT_ATTRIBUTES: ReadonlySet<string> = new Set([
  ...NATIVE_VIEW_ATTRIBUTES,
  ...textComponentAttributes,
]);

export const NATIVE_IMAGE_ATTRIBUTES: ReadonlySet<string> = new Set([
  ...NATIVE_VIEW_ATTRIBUTES,
  ...imageComponentAttributes,
]);
