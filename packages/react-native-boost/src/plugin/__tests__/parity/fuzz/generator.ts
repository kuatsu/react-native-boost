import fc from 'fast-check';
import { TEXT_VOCAB, VIEW_VOCAB, TEXT_BLACKLIST_SAMPLE, type PropSpec } from './vocabulary';

// The unit of generation is an abstract spec, not a raw string — fast-check shrinks the spec (drop an
// attr, simplify a value, collapse dynamic→static) and the renderer turns it into valid JSX by
// construction, so shrinking never explores malformed snippets (plan §5).

export type Tag = 'Text' | 'View';

/** One attribute: the value's source code, and whether it is inlined or hoisted to a preamble const. */
export interface GenAttr {
  name: string;
  code: string;
  dynamic: boolean;
}

/** A spread: `resolvable` → hoisted to a const and spread by reference (analyzable); otherwise inlined
 *  as `{...{…}}`, which the optimizer cannot resolve and always bails on. */
export interface GenSpread {
  code: string;
  resolvable: boolean;
}

/** A `<Text>` child. `text`/`element` render raw between the tags; `expr` in braces; `dynamic` is a
 *  hoisted const-ref primitive. `element` (a nested `<Text>`) is non-primitive → forces a bail. */
export interface ChildSpec {
  kind: 'text' | 'expr' | 'dynamic' | 'element';
  code: string;
}

export interface ElementSpec {
  tag: Tag;
  attrs: GenAttr[];
  blacklisted: GenAttr | null; // Text only: a deliberate, low-probability bail trigger
  spreads: GenSpread[];
  child: ChildSpec | null; // Text only
}

export interface RenderedCase {
  preamble: string;
  jsxBody: string;
}

const NULLISH = new Set(['null', 'undefined']);
const isValidIdentifier = (name: string) => /^[a-zA-Z_$][\w$]*$/.test(name);
const propertyKey = (name: string) => (isValidIdentifier(name) ? name : `"${name}"`);

/** A small subset (biased toward 1–3) of distinct props, each with a value + static/dynamic flag. */
function attrsArb(vocab: PropSpec[]): fc.Arbitrary<GenAttr[]> {
  return fc
    .subarray(vocab, { maxLength: 5 })
    .chain((chosen) =>
      chosen.length === 0
        ? fc.constant<GenAttr[]>([])
        : fc.tuple(
            ...chosen.map((spec) =>
              fc
                .record({ code: spec.arb, dynamic: fc.boolean() })
                .map((value): GenAttr => ({ name: spec.name, ...value }))
            )
          )
    );
}

/** An object-literal source built from 1–2 distinct vocab props — the body of a spread. */
function spreadObjectArb(vocab: PropSpec[]): fc.Arbitrary<string> {
  return fc
    .subarray(vocab, { minLength: 1, maxLength: 2 })
    .chain((chosen) =>
      fc
        .tuple(...chosen.map((spec) => spec.arb.map((code) => `${propertyKey(spec.name)}: ${code}`)))
        .map((entries) => `{ ${entries.join(', ')} }`)
    );
}

function spreadsArb(vocab: PropSpec[]): fc.Arbitrary<GenSpread[]> {
  const one = fc.record({ code: spreadObjectArb(vocab), resolvable: fc.boolean() });
  return fc.oneof(
    { weight: 6, arbitrary: fc.constant<GenSpread[]>([]) },
    { weight: 2, arbitrary: fc.tuple(one) },
    { weight: 1, arbitrary: fc.tuple(one, one) }
  );
}

const childArb: fc.Arbitrary<ChildSpec> = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.constantFrom<ChildSpec>(
      { kind: 'text', code: 'hello' },
      { kind: 'text', code: 'some text' },
      { kind: 'expr', code: '42' },
      { kind: 'expr', code: '`a${1}b`' },
      { kind: 'expr', code: "'inner'" },
      { kind: 'expr', code: '1 + 2' },
      { kind: 'expr', code: "true ? 'a' : 'b'" }
    ),
  },
  // Const-ref primitive child — exercises isPrimitiveExpression's binding resolution (still optimizes).
  { weight: 1, arbitrary: fc.constant<ChildSpec>({ kind: 'dynamic', code: "'hi'" }) },
  // Nested <Text> — non-primitive child AND a Text ancestor for the inner, so BOTH bail → clean skip
  // (no inner host optimizes, so it never trips the single-host wrapper render).
  { weight: 1, arbitrary: fc.constant<ChildSpec>({ kind: 'element', code: '<Text>inner</Text>' }) }
);

const blacklistedArb: fc.Arbitrary<GenAttr | null> = fc.oneof(
  { weight: 6, arbitrary: fc.constant<GenAttr | null>(null) },
  {
    weight: 1,
    arbitrary: fc
      .constantFrom(...TEXT_BLACKLIST_SAMPLE)
      .chain((spec) => spec.arb.map((code): GenAttr => ({ name: spec.name, code, dynamic: false }))),
  }
);

const textSpecArb: fc.Arbitrary<ElementSpec> = fc.record({
  tag: fc.constant<Tag>('Text'),
  attrs: attrsArb(TEXT_VOCAB),
  blacklisted: blacklistedArb,
  spreads: spreadsArb(TEXT_VOCAB),
  child: childArb,
});

const viewSpecArb: fc.Arbitrary<ElementSpec> = fc.record({
  tag: fc.constant<Tag>('View'),
  attrs: attrsArb(VIEW_VOCAB),
  blacklisted: fc.constant<GenAttr | null>(null),
  spreads: spreadsArb(VIEW_VOCAB),
  child: fc.constant<ChildSpec | null>(null),
});

export const elementSpecArb: fc.Arbitrary<ElementSpec> = fc.oneof(textSpecArb, viewSpecArb);

export const platformArb = fc.constantFrom('ios' as const, 'android' as const);

/** Render a spec to `{ preamble, jsxBody }`. Dynamic values + resolvable spreads + dynamic children
 *  become preamble `const`s, spliced identically into both the Boost and wrapper modules. */
export function render(spec: ElementSpec): RenderedCase {
  const declarations: string[] = [];
  let attrCounter = 0;
  let spreadCounter = 0;
  let childCounter = 0;
  const parts: string[] = [];

  const emitAttr = (attr: GenAttr) => {
    // null/undefined are emitted dynamic so the runtime `?.`/`??` paths run on a real nullish value
    // rather than being constant-folded at build time.
    if (attr.dynamic || NULLISH.has(attr.code)) {
      const ref = `_b${attrCounter++}`;
      declarations.push(`const ${ref} = ${attr.code};`);
      parts.push(`${attr.name}={${ref}}`);
    } else {
      parts.push(`${attr.name}={${attr.code}}`);
    }
  };

  for (const attr of spec.attrs) emitAttr(attr);
  if (spec.blacklisted) emitAttr(spec.blacklisted);

  for (const spread of spec.spreads) {
    if (spread.resolvable) {
      const ref = `_s${spreadCounter++}`;
      declarations.push(`const ${ref} = ${spread.code};`);
      parts.push(`{...${ref}}`);
    } else {
      parts.push(`{...${spread.code}}`);
    }
  }

  const attrs = parts.length > 0 ? ` ${parts.join(' ')}` : '';

  if (spec.tag === 'View') {
    return { preamble: declarations.join('\n'), jsxBody: `<View${attrs} />` };
  }

  const child = spec.child!;
  let childStr: string;
  if (child.kind === 'text' || child.kind === 'element') {
    childStr = child.code;
  } else if (child.kind === 'dynamic') {
    const ref = `_c${childCounter++}`;
    declarations.push(`const ${ref} = ${child.code};`);
    childStr = `{${ref}}`;
  } else {
    childStr = `{${child.code}}`;
  }
  return { preamble: declarations.join('\n'), jsxBody: `<Text${attrs}>${childStr}</Text>` };
}
