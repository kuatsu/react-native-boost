import { type NodePath, types as t } from '@babel/core';
import type { SpreadKeys, SpreadSummary } from '../../ancestor-types';
import type { HubFile } from '../types';

type Binding = NonNullable<ReturnType<NodePath['scope']['getBinding']>>;

export function getCallReturnKeys(path: NodePath, call: t.CallExpression): SpreadKeys {
  if (!t.isIdentifier(call.callee)) return null;
  const summary = summarizeBinding(path.scope.getBinding(call.callee.name));
  if (summary === null || Array.isArray(summary)) return summary;
  const file = (path.hub as unknown as { file: HubFile }).file;
  const { source, imported } = summary;
  const value = file.__spreadImports?.[source]?.[imported];
  const keys = Array.isArray(value) ? value : null;
  file.__spreadReferences?.set(`${source}\0${imported}`, { source, imported, keys });
  return keys;
}

export function analyzeSpreadExports(path: NodePath<t.Program>): Record<string, SpreadSummary> {
  const exports: Record<string, SpreadSummary> = Object.create(null);
  for (const statement of path.get('body')) {
    if (statement.isExportDefaultDeclaration()) {
      const declaration = statement.get('declaration');
      exports.default = declaration.isIdentifier()
        ? summarizeBinding(declaration.scope.getBinding(declaration.node.name))
        : declaration.isFunctionDeclaration() && declaration.node.id
          ? summarizeBinding(declaration.scope.getBinding(declaration.node.id.name))
          : getReturnedKeys(declaration);
    }
    if (!statement.isExportNamedDeclaration() || statement.node.exportKind === 'type') continue;
    const declaration = statement.get('declaration');
    if (declaration.node) {
      for (const name of Object.keys(t.getOuterBindingIdentifiers(declaration.node))) {
        exports[name] = summarizeBinding(path.scope.getBinding(name));
      }
    }
    for (const specifier of statement.node.specifiers) {
      if (t.isExportSpecifier(specifier) && specifier.exportKind === 'type') continue;
      const exported = t.isIdentifier(specifier.exported) ? specifier.exported.name : specifier.exported.value;
      exports[exported] = null;
      if (!t.isExportSpecifier(specifier)) continue;
      const local = specifier.local.name;
      exports[exported] = statement.node.source
        ? { kind: 'import', source: statement.node.source.value, imported: local }
        : summarizeBinding(path.scope.getBinding(local));
    }
  }
  return exports;
}

function summarizeBinding(binding: Binding | undefined): SpreadSummary {
  if (!binding?.constant) return null;
  const path = binding.path;
  if (path.isImportSpecifier() || path.isImportDefaultSpecifier()) {
    const declaration = path.parent;
    if (!t.isImportDeclaration(declaration) || declaration.importKind === 'type') return null;
    if (path.isImportSpecifier() && path.node.importKind === 'type') return null;
    const imported = path.isImportDefaultSpecifier()
      ? 'default'
      : t.isIdentifier(path.node.imported)
        ? path.node.imported.name
        : path.node.imported.value;
    return { kind: 'import', source: declaration.source.value, imported };
  }
  return getReturnedKeys(path.isVariableDeclarator() ? path.get('init') : path);
}

function getReturnedKeys(path: NodePath<t.Node | null | undefined>): SpreadKeys {
  if (!path.isFunctionDeclaration() && !path.isFunctionExpression() && !path.isArrowFunctionExpression()) return null;
  if (path.node.async || path.node.generator) return null;
  const keys = new Set<string>();
  let valid = true;
  const body = (path as NodePath<t.Function>).get('body');
  if (!body.isBlockStatement()) return expressionKeys(body, path);
  path.traverse({
    CallExpression(call) {
      // Direct eval can access a local object without a binding reference in the AST.
      if (t.isIdentifier(call.node.callee, { name: 'eval' })) {
        valid = false;
        call.stop();
      }
    },
    ReturnStatement(statement) {
      if (statement.getFunctionParent() !== path) return;
      const returned = expressionKeys(statement.get('argument'), path);
      if (returned === null) {
        valid = false;
        statement.stop();
      } else for (const key of returned) keys.add(key);
    },
  });
  return valid ? [...keys].sort() : null;
}

function expressionKeys(expression: NodePath<t.Node | null | undefined>, owner: NodePath): SpreadKeys {
  if (!expression.node || expression.isNullLiteral()) return [];
  if (expression.isConditionalExpression()) {
    const left = expressionKeys(expression.get('consequent'), owner);
    const right = expressionKeys(expression.get('alternate'), owner);
    return left && right ? [...new Set([...left, ...right])].sort() : null;
  }
  if (expression.isObjectExpression()) return objectKeys(expression.node);
  if (!expression.isIdentifier()) return null;
  const binding = expression.scope.getBinding(expression.node.name);
  if (!binding?.constant || !binding.path.isVariableDeclarator() || binding.path.getFunctionParent() !== owner)
    return null;
  const initial = binding.path.node.init;
  if (!t.isObjectExpression(initial)) return null;
  const keys = objectKeys(initial);
  if (keys === null) return null;
  for (const reference of binding.referencePaths) {
    if (reference.getFunctionParent() !== owner) return null;
    const parent = reference.parentPath;
    if (parent?.isReturnStatement() && reference.key === 'argument') continue;
    if (!parent?.isMemberExpression() || reference.key !== 'object') return null;
    const assignment = parent.parentPath;
    if (!assignment?.isAssignmentExpression({ operator: '=' }) || parent.key !== 'left') return null;
    const key = propertyKey(parent.node.property, parent.node.computed);
    if (key === null) return null;
    keys.push(key);
  }
  return [...new Set(keys)].sort();
}

function objectKeys(object: t.ObjectExpression): SpreadKeys {
  const keys: string[] = [];
  for (const property of object.properties) {
    if (!t.isObjectProperty(property)) return null;
    const key = propertyKey(property.key, property.computed);
    if (key === null) return null;
    keys.push(key);
  }
  return [...new Set(keys)].sort();
}

function propertyKey(node: t.Node, computed: boolean): string | null {
  const key = t.isStringLiteral(node) ? node.value : !computed && t.isIdentifier(node) ? node.name : null;
  return key === '__proto__' ? null : key;
}
