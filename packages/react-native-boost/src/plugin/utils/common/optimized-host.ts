import { types as t } from '@babel/core';

export type OptimizedHostKind = 'text' | 'view';

/**
 * Records, per `JSXOpeningElement` node, which kind of host Boost rewrote it into. The ancestor walk
 * reads this to classify an already-optimized ancestor by what it renders, without depending on the
 * just-injected import being resolvable via scope (a fresh `addNamed` import is not yet crawled into
 * scope during the same traversal, so `getBinding` returns `undefined` for it). A `WeakMap` keyed on the
 * node avoids mutating the AST and is collected with the file's nodes after the transform.
 */
const optimizedHosts = new WeakMap<t.JSXOpeningElement, OptimizedHostKind>();

export const markOptimizedHost = (openingElement: t.JSXOpeningElement, kind: OptimizedHostKind): void => {
  optimizedHosts.set(openingElement, kind);
};

export const getOptimizedHostKind = (openingElement: t.JSXOpeningElement): OptimizedHostKind | undefined =>
  optimizedHosts.get(openingElement);
