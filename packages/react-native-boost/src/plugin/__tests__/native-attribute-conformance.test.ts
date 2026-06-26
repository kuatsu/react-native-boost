import { describe, it, expect } from 'vitest';
import { transformSync, types as t, type PluginObj } from '@babel/core';
import { generateTestPlugin } from '../utils/generate-test-plugin';
import { imageOptimizer } from '../optimizers/image';
import { textOptimizer } from '../optimizers/text';
import { viewOptimizer } from '../optimizers/view';
import { Optimizer } from '../types';
import { NATIVE_IMAGE_ATTRIBUTES, NATIVE_TEXT_ATTRIBUTES, NATIVE_VIEW_ATTRIBUTES } from './native-valid-attributes';

/**
 * Attribute-conformance check: every prop the plugin leaves on an optimized host element must
 * be an attribute the native component actually understands (see `native-valid-attributes.ts`).
 *
 * The original `<Text>` / `<View>` wrappers translate a number of ergonomic props into their
 * native equivalents (`aria-*` → `accessibility*`, `tabIndex` → `focusable`, …). If the plugin
 * optimizes such an element away without either translating or bailing, those props are passed
 * through verbatim and silently dropped by the native side — a behavioral regression. This test
 * catches that by transforming a matrix of props and asserting nothing non-native survives.
 *
 * Note: this only catches *dropped* props. Value-level divergences between the wrapper and the
 * optimized output (e.g. the Android `accessible` default) require a differential render test.
 */

const SOURCE_HEADER = `import { Image, Text, View } from 'react-native';\n`;

interface OptimizedHost {
  optimized: boolean;
  attributes: string[];
}

/**
 * Runs a single optimizer over a JSX snippet and reports, for the resulting element, whether it
 * was optimized into its native counterpart and which direct attributes it carries. Returns
 * `null` if no JSX element was found.
 */
function optimizeAndInspect(source: string, optimizer: Optimizer, originalName: string): OptimizedHost | null {
  let host: { name: string; attributes: string[] } | undefined;

  const capturePlugin = (): PluginObj => ({
    name: 'capture-host-element',
    visitor: {
      JSXOpeningElement: {
        exit(path) {
          const name = path.node.name;
          if (!t.isJSXIdentifier(name)) return;
          host = {
            name: name.name,
            attributes: path.node.attributes
              .filter((attribute): attribute is t.JSXAttribute => t.isJSXAttribute(attribute))
              .map((attribute) => (t.isJSXIdentifier(attribute.name) ? attribute.name.name : attribute.name.name.name)),
          };
        },
      },
    },
  });

  transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-syntax-jsx', generateTestPlugin(optimizer), capturePlugin],
  });

  if (!host) return null;
  return { optimized: host.name !== originalName, attributes: host.attributes };
}

const viewSource = (attributes: string) => `${SOURCE_HEADER}const element = <View ${attributes} />;`;
const textSource = (attributes: string) => `${SOURCE_HEADER}const element = <Text ${attributes}>hello</Text>;`;
const imageSource = (attributes: string) => `${SOURCE_HEADER}const element = <Image ${attributes} />;`;

/**
 * Props the wrapper translates to a different native prop. Passing them through verbatim drops
 * them on the floor, so the plugin must either translate or bail on these.
 */
const VIEW_WRAPPER_ONLY_PROPS = [
  'aria-hidden',
  'aria-live="polite"',
  'aria-labelledby="other"',
  'aria-valuenow={5}',
  'aria-valuemax={10}',
  'aria-valuemin={0}',
  'aria-valuetext="five"',
  'tabIndex={0}',
];

/** Props that are valid native attributes and should remain on the optimized element unchanged. */
const VIEW_PASSTHROUGH_PROPS = [
  'testID="element"',
  'accessibilityRole="button"',
  'accessibilityValue={{ now: 5 }}',
  'pointerEvents="none"',
];

const TEXT_WRAPPER_ONLY_PROPS = ['aria-hidden'];

const TEXT_PASSTHROUGH_PROPS = [
  'numberOfLines={1}',
  'testID="element"',
  'accessibilityRole="header"',
  'maxFontSizeMultiplier={1.5}',
];

const IMAGE_BASE_SOURCE = 'source={{ uri: "x", width: 16, height: 16 }}';

const IMAGE_WRAPPER_ONLY_PROPS = [
  `${IMAGE_BASE_SOURCE} alt="label"`,
  `${IMAGE_BASE_SOURCE} aria-hidden={true}`,
  `${IMAGE_BASE_SOURCE} aria-live="polite"`,
  `${IMAGE_BASE_SOURCE} aria-valuenow={5}`,
  `${IMAGE_BASE_SOURCE} id="image-id"`,
  `${IMAGE_BASE_SOURCE} tabIndex={0}`,
  `${IMAGE_BASE_SOURCE} defaultSource={{ uri: "fallback" }}`,
  `${IMAGE_BASE_SOURCE} onLoad={() => {}}`,
];

const IMAGE_PASSTHROUGH_PROPS = [
  IMAGE_BASE_SOURCE,
  'source={{ uri: "x" }} width={16} height={16}',
  'source={[{ uri: "x", width: 16, height: 16 }, { uri: "y", width: 32, height: 32, scale: 2 }]} style={{ width: 16, height: 16 }}',
  'src="https://example.com/a.png" width={16} height={16}',
  `${IMAGE_BASE_SOURCE} resizeMode="contain" tintColor="red"`,
  `${IMAGE_BASE_SOURCE} style={{ objectFit: "fill", tintColor: "red" }}`,
  `${IMAGE_BASE_SOURCE} blurRadius={2} resizeMethod="resize" resizeMultiplier={2} progressiveRenderingEnabled={true} fadeDuration={0} capInsets={{ top: 1, left: 2, bottom: 3, right: 4 }}`,
];

describe('native attribute conformance', () => {
  it('derives a sane native attribute set from the installed React Native', () => {
    // Extraction must not silently collapse (e.g. if React Native restructured these configs).
    expect(NATIVE_VIEW_ATTRIBUTES.size).toBeGreaterThanOrEqual(50);
    expect(NATIVE_TEXT_ATTRIBUTES.size).toBeGreaterThan(NATIVE_VIEW_ATTRIBUTES.size);

    // Sentinel native attributes must be present...
    for (const attribute of [
      'accessibilityLabel',
      'accessibilityState',
      'accessibilityValue',
      'nativeID',
      'style',
      'testID',
    ]) {
      expect(NATIVE_VIEW_ATTRIBUTES.has(attribute), `expected "${attribute}" to be a native View attribute`).toBe(true);
    }
    for (const attribute of ['numberOfLines', 'allowFontScaling', 'ellipsizeMode', 'selectable']) {
      expect(NATIVE_TEXT_ATTRIBUTES.has(attribute), `expected "${attribute}" to be a native Text attribute`).toBe(true);
    }
    for (const attribute of ['source', 'src', 'resizeMode', 'tintColor']) {
      expect(NATIVE_IMAGE_ATTRIBUTES.has(attribute), `expected "${attribute}" to be a native Image attribute`).toBe(
        true
      );
    }
    // ...and wrapper-only props must NOT be (otherwise the test could not catch the bug class).
    for (const attribute of ['aria-hidden', 'aria-live', 'aria-labelledby', 'aria-valuenow', 'tabIndex', 'id']) {
      expect(NATIVE_VIEW_ATTRIBUTES.has(attribute), `"${attribute}" must not be a native attribute`).toBe(false);
    }
    for (const attribute of ['alt', 'aria-hidden']) {
      expect(NATIVE_IMAGE_ATTRIBUTES.has(attribute), `"${attribute}" must not be a native Image attribute`).toBe(false);
    }
  });

  it('exercises the optimized path (otherwise conformance would pass vacuously)', () => {
    expect(optimizeAndInspect(viewSource('testID="element"'), viewOptimizer, 'View')?.optimized).toBe(true);
    expect(optimizeAndInspect(textSource('numberOfLines={1}'), textOptimizer, 'Text')?.optimized).toBe(true);
    expect(optimizeAndInspect(imageSource(IMAGE_BASE_SOURCE), imageOptimizer, 'Image')?.optimized).toBe(true);
  });

  describe('View', () => {
    it.each([...VIEW_WRAPPER_ONLY_PROPS, ...VIEW_PASSTHROUGH_PROPS])(
      'leaves only native attributes on the host for <View %s />',
      (attributes) => {
        const result = optimizeAndInspect(viewSource(attributes), viewOptimizer, 'View');
        if (!result?.optimized) return; // bailed out: nothing reaches the native component
        const leaked = result.attributes.filter((attribute) => !NATIVE_VIEW_ATTRIBUTES.has(attribute));
        expect(leaked, `optimized <View ${attributes} /> leaks non-native attribute(s): ${leaked.join(', ')}`).toEqual(
          []
        );
      }
    );
  });

  describe('Text', () => {
    it.each([...TEXT_WRAPPER_ONLY_PROPS, ...TEXT_PASSTHROUGH_PROPS])(
      'leaves only native attributes on the host for <Text %s>',
      (attributes) => {
        const result = optimizeAndInspect(textSource(attributes), textOptimizer, 'Text');
        if (!result?.optimized) return; // bailed out: nothing reaches the native component
        const leaked = result.attributes.filter((attribute) => !NATIVE_TEXT_ATTRIBUTES.has(attribute));
        expect(leaked, `optimized <Text ${attributes}> leaks non-native attribute(s): ${leaked.join(', ')}`).toEqual(
          []
        );
      }
    );
  });

  describe('Image', () => {
    it.each([...IMAGE_WRAPPER_ONLY_PROPS, ...IMAGE_PASSTHROUGH_PROPS])(
      'leaves only native attributes on the host for <Image %s />',
      (attributes) => {
        const result = optimizeAndInspect(imageSource(attributes), imageOptimizer, 'Image');
        if (!result?.optimized) return; // bailed out: nothing reaches the native component
        const leaked = result.attributes.filter((attribute) => !NATIVE_IMAGE_ATTRIBUTES.has(attribute));
        expect(leaked, `optimized <Image ${attributes} /> leaks non-native attribute(s): ${leaked.join(', ')}`).toEqual(
          []
        );
      }
    );
  });
});
