import { NodePath, types as t } from '@babel/core';
import { ACCESSIBILITY_PROPERTIES } from '../constants';
import { USER_SELECT_STYLE_TO_SELECTABLE_PROP, VERTICAL_ALIGN_TO_TEXT_ALIGN_VERTICAL } from '../constants';

// A key that matches this can be emitted as a bare `t.identifier`; anything else (e.g. `aria-label`)
// must become a string-literal property key.
const VALID_JS_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * Checks if the JSX element has a blacklisted property.
 *
 * @param path - The path to the JSXOpeningElement.
 * @param blacklist - The set of blacklisted properties.
 * @returns true if the JSX element has a blacklisted property.
 */
export const hasBlacklistedProperty = (path: NodePath<t.JSXOpeningElement>, blacklist: Set<string>): boolean => {
  return path.node.attributes.some((attribute) => {
    // Check direct attributes (e.g., onPress={handler})
    if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name) && blacklist.has(attribute.name.name)) {
      return true;
    }

    // Check spread attributes (e.g., {...props})
    if (t.isJSXSpreadAttribute(attribute)) {
      if (t.isIdentifier(attribute.argument)) {
        const binding = path.scope.getBinding(attribute.argument.name);
        let objectExpression: t.ObjectExpression | undefined;
        if (binding) {
          // If the binding node is a VariableDeclarator, use its initializer
          if (t.isVariableDeclarator(binding.path.node)) {
            objectExpression = binding.path.node.init as t.ObjectExpression;
          } else if (t.isObjectExpression(binding.path.node)) {
            objectExpression = binding.path.node;
          }
        }
        if (objectExpression && t.isObjectExpression(objectExpression)) {
          return objectExpression.properties.some((property) => {
            if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
              return blacklist.has(property.key.name);
            }
            return false;
          });
        }
      }
      // Bail if we can't resolve the spread attribute
      return true;
    }

    // For other attribute types, assume no blacklisting
    return false;
  });
};

/**
 * Like {@link hasBlacklistedProperty}, but only inspects spread attributes — direct attributes are
 * ignored. Callers that can rewrite a direct attribute (e.g. the `id` → `nativeID` rename) handle it
 * separately, but still need the conservative spread bail: an unresolvable spread, or a resolvable
 * spread whose object contains a guarded key, could smuggle the prop through untranslated. The spread
 * resolution semantics mirror {@link hasBlacklistedProperty} exactly.
 *
 * @param path - The path to the JSXOpeningElement.
 * @param keys - The set of guarded keys.
 * @returns true if any spread attribute could contribute one of `keys`.
 */
export const hasBlacklistedPropertyInSpread = (path: NodePath<t.JSXOpeningElement>, keys: Set<string>): boolean => {
  return path.node.attributes.some((attribute) => {
    if (!t.isJSXSpreadAttribute(attribute)) return false;

    if (t.isIdentifier(attribute.argument)) {
      const binding = path.scope.getBinding(attribute.argument.name);
      let objectExpression: t.ObjectExpression | undefined;
      if (binding) {
        if (t.isVariableDeclarator(binding.path.node)) {
          objectExpression = binding.path.node.init as t.ObjectExpression;
        } else if (t.isObjectExpression(binding.path.node)) {
          objectExpression = binding.path.node;
        }
      }
      if (objectExpression && t.isObjectExpression(objectExpression)) {
        return objectExpression.properties.some((property) => {
          if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
            return keys.has(property.key.name);
          }
          if (t.isObjectProperty(property) && t.isStringLiteral(property.key)) {
            return keys.has(property.key.value);
          }
          return false;
        });
      }
    }

    // Bail if we can't resolve the spread attribute.
    return true;
  });
};

/**
 * Mirrors the `Text` wrapper's `id ?? nativeID` precedence: renames a direct `id` JSX attribute to
 * `nativeID`, and when both are present drops the explicit `nativeID` so `id` wins. Only direct
 * attributes are touched — `id`/`nativeID` arriving via a spread are left for the caller's bailout
 * logic (see {@link hasBlacklistedPropertyInSpread}). The ambiguous "both present and `id` is not
 * statically non-null" case is expected to have already bailed (see {@link hasAmbiguousIdNativeID}).
 * Mutates `path.node.attributes` in place. (The `View` optimizer emits its rename last instead, to
 * win over a pass-through spread, so it does not use this helper.)
 */
export const renameIdToNativeID = (path: NodePath<t.JSXOpeningElement>): void => {
  let idAttribute: t.JSXAttribute | undefined;
  let nativeIdAttribute: t.JSXAttribute | undefined;

  for (const attribute of path.node.attributes) {
    if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)) continue;
    if (attribute.name.name === 'id') idAttribute = attribute;
    else if (attribute.name.name === 'nativeID') nativeIdAttribute = attribute;
  }

  // A lone `nativeID` is already the native key — nothing to do.
  if (!idAttribute) return;

  idAttribute.name = t.jsxIdentifier('nativeID');
  if (nativeIdAttribute) {
    path.node.attributes = path.node.attributes.filter((attribute) => attribute !== nativeIdAttribute);
  }
};

/**
 * Returns true when both a direct `id` and a direct `nativeID` attribute are present and the `id`
 * value is not statically provable to be non-null. The wrapper precedence is `id ?? nativeID`, so a
 * runtime-null `id` falls back to `nativeID`; a static rename cannot replicate that fallback, so the
 * caller must bail. When only `id` is present the rename is always safe (a null `id` yields
 * `nativeID={null}`, equivalent to omitted for the native host), so this guards the both-present
 * intersection only.
 */
export const hasAmbiguousIdNativeID = (path: NodePath<t.JSXOpeningElement>): boolean => {
  let idAttribute: t.JSXAttribute | undefined;
  let hasNativeId = false;

  for (const attribute of path.node.attributes) {
    if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)) continue;
    if (attribute.name.name === 'id') idAttribute = attribute;
    else if (attribute.name.name === 'nativeID') hasNativeId = true;
  }

  if (!idAttribute || !hasNativeId) return false;

  return !isStaticallyNonNullValue(idAttribute.value);
};

/**
 * Whether a JSX attribute value is statically provable to be non-null (and non-undefined). A shorthand
 * boolean attribute (no value), a string literal, or an expression container wrapping a string/number/
 * boolean/bigint/template literal qualifies. Anything that could evaluate to `null`/`undefined` at
 * runtime (identifiers, member/call expressions, `null`, `undefined`) does not.
 */
const isStaticallyNonNullValue = (value: t.JSXAttribute['value']): boolean => {
  if (!value) return true; // shorthand attribute → boolean `true`
  if (t.isStringLiteral(value)) return true;
  if (t.isJSXExpressionContainer(value)) {
    const { expression } = value;
    return (
      t.isStringLiteral(expression) ||
      t.isNumericLiteral(expression) ||
      t.isBooleanLiteral(expression) ||
      t.isBigIntLiteral(expression) ||
      t.isTemplateLiteral(expression)
    );
  }
  return false;
};

/**
 * Adds a default property to a JSX element if it's not already defined. It avoids adding a default
 * if it cannot statically determine whether the property is already set.
 *
 * @param path - The path to the JSXOpeningElement.
 * @param key - The property key.
 * @param value - The default value expression.
 */
export const addDefaultProperty = (path: NodePath<t.JSXOpeningElement>, key: string, value: t.Expression) => {
  let propertyIsFound = false;
  let hasUnresolvableSpread = false;

  for (const attribute of path.node.attributes) {
    if (t.isJSXAttribute(attribute) && attribute.name.name === key) {
      propertyIsFound = true;
      break;
    }

    if (t.isJSXSpreadAttribute(attribute)) {
      if (t.isObjectExpression(attribute.argument)) {
        const propertyInSpread = attribute.argument.properties.some(
          (p) =>
            (t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === key) ||
            (t.isObjectProperty(p) && t.isStringLiteral(p.key) && p.key.value === key)
        );
        if (propertyInSpread) {
          propertyIsFound = true;
          break;
        }
      } else if (t.isIdentifier(attribute.argument)) {
        const binding = path.scope.getBinding(attribute.argument.name);
        if (
          binding?.path.node &&
          t.isVariableDeclarator(binding.path.node) &&
          t.isObjectExpression(binding.path.node.init)
        ) {
          const propertyInSpread = binding.path.node.init.properties.some(
            (p) =>
              (t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === key) ||
              (t.isObjectProperty(p) && t.isStringLiteral(p.key) && p.key.value === key)
          );
          if (propertyInSpread) {
            propertyIsFound = true;
            break;
          }
        } else {
          hasUnresolvableSpread = true;
          break;
        }
      } else {
        hasUnresolvableSpread = true;
        break;
      }
    }
  }

  if (!propertyIsFound && !hasUnresolvableSpread) {
    path.node.attributes.push(t.jsxAttribute(t.jsxIdentifier(key), t.jsxExpressionContainer(value)));
  }
};

/**
 * Builds an `ObjectProperty` from a single plain JSX attribute. A shorthand attribute (or empty
 * expression container) resolves to boolean `true`. A key that is not a valid JS identifier (e.g.
 * `aria-label`) becomes a string-literal property key.
 */
const buildObjectPropertyFromAttribute = (attribute: t.JSXAttribute): t.ObjectProperty => {
  const key = attribute.name.name;
  let value: t.Expression;
  if (!attribute.value) {
    value = t.booleanLiteral(true);
  } else if (t.isStringLiteral(attribute.value)) {
    value = attribute.value;
  } else if (t.isJSXExpressionContainer(attribute.value)) {
    value = t.isJSXEmptyExpression(attribute.value.expression) ? t.booleanLiteral(true) : attribute.value.expression;
  } else {
    value = t.nullLiteral();
  }

  const keyNode =
    typeof key === 'string' && VALID_JS_IDENTIFIER.test(key) ? t.identifier(key) : t.stringLiteral(key.toString());

  return t.objectProperty(keyNode, value);
};

/**
 * Builds an expression that merges the given JSX attributes into a single props object. When none of
 * the attributes is a spread (the common case) the result is a plain `ObjectExpression` literal — every
 * attribute becomes one property, including the empty case which yields `{}`. When at least one spread
 * is present the result is `Object.assign({}, …)` (one single-key object per plain attribute, each
 * spread's argument as a bare merge source), because reproducing object-spread merge semantics requires
 * the call. Either shape produces a structurally-equal object; only the construction differs.
 *
 * @param attributes - The attributes to build the expression from.
 * @returns An `ObjectExpression` (no spread) or an `Object.assign` `CallExpression` (spread present).
 */
export const buildPropertiesFromAttributes = (attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[]): t.Expression => {
  if (!attributes.some((attribute) => t.isJSXSpreadAttribute(attribute))) {
    const properties = attributes
      .filter((attribute): attribute is t.JSXAttribute => t.isJSXAttribute(attribute))
      .map((attribute) => buildObjectPropertyFromAttribute(attribute));
    return t.objectExpression(properties);
  }

  const arguments_: t.Expression[] = [];
  for (const attribute of attributes) {
    if (t.isJSXSpreadAttribute(attribute)) {
      arguments_.push(attribute.argument);
    } else if (t.isJSXAttribute(attribute)) {
      arguments_.push(t.objectExpression([buildObjectPropertyFromAttribute(attribute)]));
    }
  }

  return t.callExpression(t.memberExpression(t.identifier('Object'), t.identifier('assign')), [
    t.objectExpression([]),
    ...arguments_,
  ]);
};

/**
 * Checks if the JSX element has an accessibility property.
 *
 * @param path - The NodePath for the JSXOpeningElement, used for scope lookup.
 * @param attributes - The attributes to check.
 * @returns true if the JSX element has an accessibility property.
 */
export const hasAccessibilityProperty = (
  path: NodePath<t.JSXOpeningElement>,
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[]
): boolean => {
  for (const attribute of attributes) {
    if (t.isJSXAttribute(attribute)) {
      const key = attribute.name.name;
      if (typeof key === 'string' && ACCESSIBILITY_PROPERTIES.has(key)) {
        return true;
      }
    } else if (t.isJSXSpreadAttribute(attribute)) {
      if (t.isObjectExpression(attribute.argument)) {
        for (const property of attribute.argument.properties) {
          if (
            t.isObjectProperty(property) &&
            t.isIdentifier(property.key) &&
            ACCESSIBILITY_PROPERTIES.has(property.key.name)
          ) {
            return true;
          }
        }
      } else if (t.isIdentifier(attribute.argument)) {
        const binding = path.scope.getBinding(attribute.argument.name);
        if (binding && t.isVariableDeclarator(binding.path.node)) {
          const declarator = binding.path.node as t.VariableDeclarator;
          if (declarator.init && t.isObjectExpression(declarator.init)) {
            for (const property of declarator.init.properties) {
              if (
                t.isObjectProperty(property) &&
                t.isIdentifier(property.key) &&
                ACCESSIBILITY_PROPERTIES.has(property.key.name)
              ) {
                return true;
              }
            }
            continue;
          }
        }
        return true;
      } else {
        return true;
      }
    }
  }
  return false;
};

/**
 * Extracts the `style` attribute from a JSX attributes list.
 *
 * @returns An object containing the attribute node itself (if found) and the expression inside
 */
export function extractStyleAttribute(attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>): {
  styleAttribute?: t.JSXAttribute;
  styleExpr?: t.Expression;
} {
  for (const attribute of attributes) {
    if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'style' })) {
      if (
        attribute.value &&
        t.isJSXExpressionContainer(attribute.value) &&
        !t.isJSXEmptyExpression(attribute.value.expression)
      ) {
        return {
          styleAttribute: attribute,
          styleExpr: attribute.value.expression,
        };
      }
      return { styleAttribute: attribute };
    }
  }
  return {};
}

/**
 * Extracts a direct `selectionColor` JSX attribute and the expression to run through the runtime
 * `processSelectionColor` helper. A string literal (`selectionColor="red"`), a non-empty expression
 * container (`selectionColor={expr}`), or a valueless `selectionColor` (the boolean `true`) yields both
 * the attribute and its color expression. `Text` runs even a `true` through `processColor` (which yields
 * `undefined`, omitting the prop), so routing it through the helper matches that rather than forwarding
 * a raw `true` to the native host. A `selectionColor={}` (empty container) has no expression and is left
 * verbatim (returns `{}`); React resolves it to `undefined`, which the native host omits — already
 * matching `Text`.
 *
 * @returns The attribute node and its color expression when extractable; otherwise an empty object.
 */
export function extractSelectionColor(attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>): {
  selectionColorAttribute?: t.JSXAttribute;
  selectionColorExpr?: t.Expression;
} {
  for (const attribute of attributes) {
    if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'selectionColor' })) {
      const value = attribute.value;
      if (t.isStringLiteral(value)) {
        return { selectionColorAttribute: attribute, selectionColorExpr: value };
      }
      if (t.isJSXExpressionContainer(value) && !t.isJSXEmptyExpression(value.expression)) {
        return { selectionColorAttribute: attribute, selectionColorExpr: value.expression };
      }
      if (value === null) {
        return { selectionColorAttribute: attribute, selectionColorExpr: t.booleanLiteral(true) };
      }
      return {};
    }
  }
  return {};
}

type SelectableExtraction = { value: boolean | undefined };

const isUserSelectProperty = (property: t.ObjectProperty): boolean =>
  t.isIdentifier(property.key, { name: 'userSelect' }) ||
  (t.isStringLiteral(property.key) && property.key.value === 'userSelect');

const isNullishExpression = (expression: t.Expression): boolean =>
  t.isNullLiteral(expression) || t.isIdentifier(expression, { name: 'undefined' });

const canResolveUserSelect = (expression: t.Expression): boolean =>
  t.isStringLiteral(expression) || t.isNumericLiteral(expression) || t.isBooleanLiteral(expression);

const removeUserSelectProperties = (objectExpr: t.ObjectExpression) => {
  objectExpr.properties = objectExpr.properties.filter(
    (property) => !t.isObjectProperty(property) || !isUserSelectProperty(property)
  );
};

/**
 * Attempts to statically extract the final flattened `userSelect` style value from a style expression.
 *
 * A non-null `userSelect` always overrides the direct `selectable` prop in RN, even when the value is
 * unknown to RN's map and therefore resolves to `undefined`. Dynamic/nullish values are left for the
 * runtime helper so it can preserve RN's `processedStyle.userSelect != null` check.
 */
export function extractSelectableAndUpdateStyle(styleExpr: t.Expression): SelectableExtraction | undefined {
  const candidates: Array<{ object: t.ObjectExpression; value: t.Expression }> = [];
  const collect = (objectExpr: t.ObjectExpression) => {
    for (const property of objectExpr.properties) {
      if (t.isObjectProperty(property) && isUserSelectProperty(property) && t.isExpression(property.value)) {
        candidates.push({ object: objectExpr, value: property.value });
      }
    }
  };

  if (t.isObjectExpression(styleExpr)) {
    collect(styleExpr);
  } else if (t.isArrayExpression(styleExpr)) {
    for (const element of styleExpr.elements) {
      if (element && t.isObjectExpression(element)) collect(element);
    }
  } else {
    return undefined;
  }

  const last = candidates.at(-1);
  if (!last || isNullishExpression(last.value) || !canResolveUserSelect(last.value)) return undefined;

  for (const { object } of candidates) removeUserSelectProperties(object);

  return {
    value: t.isStringLiteral(last.value) ? USER_SELECT_STYLE_TO_SELECTABLE_PROP[last.value.value] : undefined,
  };
}

/**
 * Whether a node is a fully static literal tree — a value the plugin can resolve and reproduce at
 * build time without evaluating anything at runtime. Primitives (string/number/boolean/null and a
 * unary-minus numeric) qualify, as do object/array literals whose every leaf is itself such a tree.
 * Anything that could only be known at runtime (identifiers, member/call/template/conditional/logical
 * expressions, spreads, computed keys, getters/setters/methods) makes the whole tree non-static.
 *
 * Used by {@link tryBuildStaticTextStyle} to decide whether a `style` value can be normalized at
 * build time. Nested object/array values (e.g. `transform`, `shadowOffset`) are carried verbatim —
 * they are not flattened, only validated as static.
 */
export const isStaticLiteralTree = (node: t.Node): boolean => {
  if (t.isStringLiteral(node) || t.isNumericLiteral(node) || t.isBooleanLiteral(node) || t.isNullLiteral(node)) {
    return true;
  }

  if (t.isUnaryExpression(node) && node.operator === '-' && t.isNumericLiteral(node.argument)) {
    return true;
  }

  if (t.isObjectExpression(node)) {
    return node.properties.every(
      (property) =>
        t.isObjectProperty(property) &&
        !property.computed &&
        (t.isIdentifier(property.key) || t.isStringLiteral(property.key)) &&
        t.isExpression(property.value) &&
        isStaticLiteralTree(property.value)
    );
  }

  if (t.isArrayExpression(node)) {
    // A hole (`[1, , 2]`) yields `null`; treat its presence as non-static and bail.
    return node.elements.every((element) => element != null && isStaticLiteralTree(element));
  }

  return false;
};

const staticPropertyName = (property: t.ObjectProperty): string =>
  t.isIdentifier(property.key) ? property.key.name : (property.key as t.StringLiteral).value;

/**
 * Whether an array element of a `style` value flattens to a falsy result at runtime and therefore
 * contributes nothing, matching `StyleSheet.flatten`'s `if (computedStyle)` skip. Limited to the
 * literal forms that provably flatten to falsy (`null` / `false` / `undefined` / `0`); any other
 * primitive literal element is left for the caller to bail on rather than guessing.
 */
const isSkippableFalsyElement = (element: t.Expression | t.SpreadElement): boolean =>
  t.isNullLiteral(element) ||
  (t.isBooleanLiteral(element) && element.value === false) ||
  t.isIdentifier(element, { name: 'undefined' }) ||
  (t.isNumericLiteral(element) && element.value === 0);

/**
 * Attempts to reproduce, at build time, exactly what the runtime `processTextStyle` helper would
 * compute for a `style` value — but only when the value is fully static. On success it returns a
 * single normalized `ObjectExpression` (the merged, converted style) the caller emits as a direct
 * `style={...}` attribute, dropping the per-render helper call. On any dynamic or uncertain input it
 * returns `undefined`, leaving the caller to fall back to `{...processTextStyle(styleExpr)}`.
 *
 * The merge mirrors `StyleSheet.flatten` (top-level array flattened left-to-right, last key wins;
 * nested value arrays/objects kept verbatim; falsy literal elements skipped) followed by the helper's
 * three conversions (numeric `fontWeight` → string, `verticalAlign` → `textAlignVertical`,
 * `userSelect` already lifted to `selectable` upstream). It biases toward bailing: any case it cannot
 * prove equivalent to the runtime result yields `undefined`. It never mutates `styleExpr` (it builds
 * fresh nodes), so a late bail still hands the original expression to the helper.
 */
export function tryBuildStaticTextStyle(styleExpr: t.Expression): t.ObjectExpression | undefined {
  const collected: t.ObjectExpression[] = [];

  // Flatten the top-level style into an ordered list of fully-static object literals, replicating
  // `StyleSheet.flatten`'s recursion. Returns false to bail the whole style.
  const collect = (expr: t.Expression | t.SpreadElement): boolean => {
    if (t.isObjectExpression(expr)) {
      if (!isStaticLiteralTree(expr)) return false;
      collected.push(expr);
      return true;
    }

    if (t.isArrayExpression(expr)) {
      for (const element of expr.elements) {
        if (element == null) continue; // hole → flattens to falsy → skipped
        if (t.isObjectExpression(element) || t.isArrayExpression(element)) {
          if (!collect(element)) return false;
        } else if (isSkippableFalsyElement(element)) {
          continue;
        } else {
          return false; // identifier, logical, member, call, non-falsy literal, spread → bail
        }
      }
      return true;
    }

    return false; // top-level identifier / member / call / conditional / etc. → bail
  };

  if (!collect(styleExpr)) return undefined;

  // Merge left-to-right (last key wins), exactly as `flattenStyle` does.
  const merged = new Map<string, t.Expression>();
  for (const object of collected) {
    for (const property of object.properties) {
      const objectProperty = property as t.ObjectProperty;
      merged.set(staticPropertyName(objectProperty), t.cloneNode(objectProperty.value as t.Expression, true));
    }
  }

  // `userSelect` is removed from literals by `extractSelectableAndUpdateStyle` before this runs. If a
  // key remains, the extractor could not resolve its value, so the style is not fully static — bail.
  if (merged.has('userSelect')) return undefined;

  const fontWeight = merged.get('fontWeight');
  if (fontWeight) {
    if (t.isNumericLiteral(fontWeight)) {
      merged.set('fontWeight', t.stringLiteral(String(fontWeight.value)));
    } else if (t.isUnaryExpression(fontWeight) && fontWeight.operator === '-') {
      return undefined; // negative weight is implausible; bail rather than guess
    }
    // A string-literal `fontWeight` is already in its native form and is left untouched.
  }

  const verticalAlign = merged.get('verticalAlign');
  if (verticalAlign !== undefined) {
    if (!t.isStringLiteral(verticalAlign)) return undefined;
    const mapped = VERTICAL_ALIGN_TO_TEXT_ALIGN_VERTICAL[verticalAlign.value];
    if (mapped === undefined) return undefined; // unknown key → defer to the runtime map
    merged.delete('verticalAlign');
    merged.set('textAlignVertical', t.stringLiteral(mapped));
  }

  const properties = [...merged].map(([key, value]) =>
    t.objectProperty(VALID_JS_IDENTIFIER.test(key) ? t.identifier(key) : t.stringLiteral(key), value)
  );

  return t.objectExpression(properties);
}

/**
 * Determines whether an expression is statically provable to evaluate to a `string` or `number`
 * primitive — and therefore can never be a React element.
 */
const isPrimitiveExpression = (
  path: NodePath<t.JSXOpeningElement>,
  expression: t.Expression,
  // Identifier names already resolved along this chain, to break circular `const` references
  // (`const a = b; const b = a;`) that would otherwise recurse forever.
  resolved: Set<string> = new Set()
): boolean => {
  // Unambiguous primitives — these can never be a React element.
  if (t.isStringLiteral(expression) || t.isNumericLiteral(expression)) return true;

  // A template literal ALWAYS coerces its interpolations to string, regardless of their types.
  if (t.isTemplateLiteral(expression)) return true;

  // `a + b` (and numeric `-`, `*`, ...) is primitive only when BOTH operands are themselves
  // provably primitive. `in`/`instanceof` have a non-Expression `left` (a `PrivateName`), so the
  // `isExpression` guard rejects them.
  if (t.isBinaryExpression(expression)) {
    const { left, right } = expression;
    return (
      t.isExpression(left) &&
      isPrimitiveExpression(path, left, resolved) &&
      isPrimitiveExpression(path, right, resolved)
    );
  }

  // `c ? a : b` — only the reachable results (`a`, `b`) are rendered; the test is irrelevant.
  if (t.isConditionalExpression(expression)) {
    return (
      isPrimitiveExpression(path, expression.consequent, resolved) &&
      isPrimitiveExpression(path, expression.alternate, resolved)
    );
  }

  // `a && b` / `a || b` / `a ?? b` — short-circuiting makes the result one of the operands, so both
  // must be primitive (unlike the conditional, the left operand is itself a reachable result).
  if (t.isLogicalExpression(expression)) {
    return (
      isPrimitiveExpression(path, expression.left, resolved) && isPrimitiveExpression(path, expression.right, resolved)
    );
  }

  // Identifier resolving to a non-reassigned `const` whose initializer is itself provably primitive.
  // `binding.constant` excludes reassigned bindings (`let x = 'a'; x = <Foo/>`).
  if (t.isIdentifier(expression)) {
    if (resolved.has(expression.name)) return false; // circular reference — give up
    const binding = path.scope.getBinding(expression.name);
    if (binding && binding.constant && binding.path.node && t.isVariableDeclarator(binding.path.node)) {
      const init = binding.path.node.init;
      return (
        !!init && t.isExpression(init) && isPrimitiveExpression(path, init, new Set(resolved).add(expression.name))
      );
    }
    return false;
  }

  return false;
};

/**
 * Checks whether a Text child node is statically provable to render as a string/number primitive.
 * Used to gate the Text optimizer: only such children are safe to keep when rewriting `<Text>` to
 * its native host. See {@link isPrimitiveExpression} for the underlying expression rules.
 */
export const isPrimitiveChild = (path: NodePath<t.JSXOpeningElement>, child: t.Node): boolean => {
  if (t.isJSXText(child)) return true; // raw text between tags
  if (t.isStringLiteral(child)) return true; // explicit `children="..."` attribute value

  if (t.isJSXExpressionContainer(child)) {
    const { expression } = child;
    if (t.isJSXEmptyExpression(expression)) return false; // `{/* comment */}` is not a primitive
    return isPrimitiveExpression(path, expression);
  }
  return false;
};
