import path from 'node:path';
import { parseSync, transformSync, traverse, types as t, type PluginObj, type TransformCaller } from '@babel/core';
import { pluginTester } from 'babel-plugin-tester';
import { describe, expect, it } from 'vitest';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { formatTestResult } from '../../../utils/format-test-result';
import { createLogger } from '../../../utils/logger';
import type { TargetPlatform } from '../../../types';
import boostPlugin from '../../../index';
import { imageOptimizer } from '..';

const transformImage = async (
  source: string,
  platform: TargetPlatform,
  {
    dangerouslyOptimizeImageWithUnknownAncestors = false,
    unistylesEnabled = false,
  }: {
    dangerouslyOptimizeImageWithUnknownAncestors?: boolean;
    unistylesEnabled?: boolean;
  } = {}
): Promise<string> => {
  const logger = createLogger({ silent: true, verbose: false });
  const plugin = (): PluginObj => ({
    name: `${platform}-image-optimizer-test`,
    visitor: {
      JSXOpeningElement(path) {
        imageOptimizer(path, logger, { dangerouslyOptimizeImageWithUnknownAncestors }, platform, unistylesEnabled);
      },
    },
  });

  return formatTestResult(
    transformSync(source, {
      configFile: false,
      babelrc: false,
      plugins: ['@babel/plugin-syntax-jsx', plugin],
    })!.code!
  );
};

const getNativeImageAttributes = (source: string): t.JSXAttribute[][] => {
  const ast = parseSync(source, {
    configFile: false,
    babelrc: false,
    parserOpts: { sourceType: 'module', plugins: ['jsx'] },
  });
  const images: t.JSXAttribute[][] = [];

  traverse(ast!, {
    JSXOpeningElement(path) {
      if (!t.isJSXIdentifier(path.node.name, { name: '_NativeImage' })) return;
      images.push(path.node.attributes.filter((attribute): attribute is t.JSXAttribute => t.isJSXAttribute(attribute)));
    },
  });

  return images;
};

const getAttributeExpression = (attributes: t.JSXAttribute[], name: string): t.Expression | undefined => {
  const attribute = attributes.find((item) => t.isJSXIdentifier(item.name, { name }));
  if (!attribute?.value) return undefined;
  if (t.isStringLiteral(attribute.value)) return attribute.value;
  if (t.isJSXExpressionContainer(attribute.value) && t.isExpression(attribute.value.expression)) {
    return attribute.value.expression;
  }
  return undefined;
};

const getAttributeNames = (attributes: t.JSXAttribute[]): Set<string> =>
  new Set(
    attributes.map((attribute) =>
      t.isJSXIdentifier(attribute.name)
        ? attribute.name.name
        : `${attribute.name.namespace.name}:${attribute.name.name.name}`
    )
  );

const getObjectExpressionProperty = (object: t.ObjectExpression, name: string): t.Expression | undefined => {
  const property = object.properties.find(
    (item): item is t.ObjectProperty =>
      t.isObjectProperty(item) &&
      ((t.isIdentifier(item.key) && item.key.name === name) ||
        (t.isStringLiteral(item.key) && item.key.value === name)) &&
      t.isExpression(item.value)
  );

  return property?.value as t.Expression | undefined;
};

const getStringPropertyValue = (object: t.ObjectExpression, name: string): string | undefined => {
  const value = getObjectExpressionProperty(object, name);
  return t.isStringLiteral(value) ? value.value : undefined;
};

pluginTester({
  plugin: generateTestPlugin(imageOptimizer, {}, 'ios'),
  title: 'image',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(imageOptimizer, { dangerouslyOptimizeImageWithUnknownAncestors: true }, 'ios'),
  title: 'image dangerous unknown ancestors',
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
  tests: [
    {
      title: 'optimizes Image inside unresolved ancestor when enabled',
      fixture: path.resolve(import.meta.dirname, 'fixtures/unknown-imported-ancestor/code.js'),
      outputFixture: path.resolve(import.meta.dirname, 'fixtures/unknown-imported-ancestor/dangerous-output.js'),
    },
  ],
});

describe('image plugin option', () => {
  it('keeps Image optimization opt-in in the full plugin', async () => {
    const source = `
      import { Image } from 'react-native';
      <Image source={{ uri: 'logo.png', width: 16, height: 16 }} />;
    `;

    const defaultOutput = await formatTestResult(
      transformSync(source, {
        configFile: false,
        babelrc: false,
        caller: { name: 'metro', platform: 'ios' } as TransformCaller,
        plugins: ['@babel/plugin-syntax-jsx', [boostPlugin, { silent: true }]],
      })!.code!
    );
    const enabledOutput = await formatTestResult(
      transformSync(source, {
        configFile: false,
        babelrc: false,
        caller: { name: 'metro', platform: 'ios' } as TransformCaller,
        plugins: ['@babel/plugin-syntax-jsx', [boostPlugin, { silent: true, optimizations: { image: true } }]],
      })!.code!
    );

    expect(defaultOutput).not.toContain('NativeImage');
    expect(enabledOutput).toContain('NativeImage');
  });
});

describe('image android output', () => {
  it('emits Android top-level empty headers for src sources', async () => {
    const output = await transformImage(
      `
          import { Image } from 'react-native';
          <Image src="https://example.com/logo.png" width={16} height={16} />;
        `,
      'android'
    );

    const images = getNativeImageAttributes(output);
    expect(images).toHaveLength(1);
    const headers = getAttributeExpression(images[0]!, 'headers');

    expect(t.isObjectExpression(headers)).toBe(true);
    expect((headers as t.ObjectExpression).properties).toHaveLength(0);
  });

  it('emits Android src and top-level headers for request header props', async () => {
    const output = await transformImage(
      `
          import { Image } from 'react-native';
          <Image
            source={{ uri: 'logo.png', width: 16, height: 16 }}
            crossOrigin="use-credentials"
            referrerPolicy="origin"
          />;
        `,
      'android'
    );

    const images = getNativeImageAttributes(output);
    expect(images).toHaveLength(1);
    const image = images[0]!;
    const src = getAttributeExpression(image, 'src');
    const source = getAttributeExpression(image, 'source');
    const headers = getAttributeExpression(image, 'headers');

    expect(t.isArrayExpression(src)).toBe(true);
    expect(t.isArrayExpression(source)).toBe(true);
    expect(t.isObjectExpression(headers)).toBe(true);
    expect(getStringPropertyValue(headers as t.ObjectExpression, 'Access-Control-Allow-Credentials')).toBe('true');
    expect(getStringPropertyValue(headers as t.ObjectExpression, 'Referrer-Policy')).toBe('origin');
  });

  it('emits Android top-level headers from static source headers', async () => {
    const output = await transformImage(
      `
          import { Image } from 'react-native';
          <Image source={{ uri: 'logo.png', width: 16, height: 16, headers: { Authorization: 'Bearer object' } }} />;
          <Image
            source={[
              { uri: 'logo.png', width: 16, height: 16, headers: { Authorization: 'Bearer first' } },
              { uri: 'logo@2x.png', width: 32, height: 32, scale: 2, headers: { Authorization: 'Bearer second' } },
            ]}
          />;
        `,
      'android'
    );

    const images = getNativeImageAttributes(output);
    expect(images).toHaveLength(2);
    const objectSourceImage = images[0]!;
    const arraySourceImage = images[1]!;
    const objectHeaders = getAttributeExpression(objectSourceImage, 'headers');
    const arrayHeaders = getAttributeExpression(arraySourceImage, 'headers');

    expect(t.isObjectExpression(objectHeaders)).toBe(true);
    expect(t.isObjectExpression(arrayHeaders)).toBe(true);
    expect(getStringPropertyValue(objectHeaders as t.ObjectExpression, 'Authorization')).toBe('Bearer object');
    expect(getStringPropertyValue(arrayHeaders as t.ObjectExpression, 'Authorization')).toBe('Bearer first');

    const objectSource = getAttributeExpression(objectSourceImage, 'source');
    const arraySource = getAttributeExpression(arraySourceImage, 'source');
    expect(t.isArrayExpression(objectSource)).toBe(true);
    expect(t.isArrayExpression(arraySource)).toBe(true);

    const objectSourceEntry = (objectSource as t.ArrayExpression).elements[0];
    const arraySourceEntry = (arraySource as t.ArrayExpression).elements[0];
    expect(t.isObjectExpression(objectSourceEntry)).toBe(true);
    expect(t.isObjectExpression(arraySourceEntry)).toBe(true);

    const objectSourceHeaders = getObjectExpressionProperty(objectSourceEntry as t.ObjectExpression, 'headers');
    const arraySourceHeaders = getObjectExpressionProperty(arraySourceEntry as t.ObjectExpression, 'headers');
    expect(t.isObjectExpression(objectSourceHeaders)).toBe(true);
    expect(t.isObjectExpression(arraySourceHeaders)).toBe(true);
    expect(getStringPropertyValue(objectSourceHeaders as t.ObjectExpression, 'Authorization')).toBe('Bearer object');
    expect(getStringPropertyValue(arraySourceHeaders as t.ObjectExpression, 'Authorization')).toBe('Bearer first');
  });

  it('does not hoist style tintColor on Android', async () => {
    const output = await transformImage(
      `
          import { Image } from 'react-native';
          <Image source={{ uri: 'logo.png', width: 16, height: 16 }} style={{ tintColor: 'red' }} />;
        `,
      'android'
    );

    const images = getNativeImageAttributes(output);
    expect(images).toHaveLength(1);
    expect(getAttributeNames(images[0]!).has('tintColor')).toBe(false);
  });
});

describe('image unistyles', () => {
  it('bails on a Unistyles style because there is no lean Image host', async () => {
    const output = await transformImage(
      `
          import { Image } from 'react-native';
          import { StyleSheet } from 'react-native-unistyles';
          const styles = StyleSheet.create({ image: { width: 16 } });
          <Image source={{ uri: 'logo.png' }} style={styles.image} />;
        `,
      'ios',
      { unistylesEnabled: true }
    );

    expect(output).not.toContain('NativeImage');
    expect(output).toContain('<Image');
  });

  it('does not lift the Unistyles style bail with @boost-force', async () => {
    const output = await transformImage(
      `
          import { Image } from 'react-native';
          import { StyleSheet } from 'react-native-unistyles';
          const styles = StyleSheet.create({ image: { width: 16 } });
          <>
            {/* @boost-force */}
            <Image source={{ uri: 'logo.png' }} style={styles.image} />
          </>;
        `,
      'ios',
      { unistylesEnabled: true }
    );

    expect(output).not.toContain('NativeImage');
    expect(output).toContain('<Image');
  });

  it('bails on an unresolved style source that may be a Unistyles style', async () => {
    const output = await transformImage(
      `
          import { Image } from 'react-native';
          <Image source={{ uri: 'logo.png' }} style={props.style} />;
        `,
      'ios',
      { unistylesEnabled: true }
    );

    expect(output).not.toContain('NativeImage');
    expect(output).toContain('<Image');
  });

  it('lifts the unresolved style bail with @boost-force', async () => {
    const output = await transformImage(
      `
          import { Image } from 'react-native';
          <>
            {/* @boost-force */}
            <Image source={{ uri: 'logo.png' }} style={props.style} />
          </>;
        `,
      'ios',
      { unistylesEnabled: true }
    );

    expect(output).toContain('NativeImage');
  });

  it('optimizes an Image without a style in Unistyles mode', async () => {
    const output = await transformImage(
      `
          import { Image } from 'react-native';
          <Image source={{ uri: 'logo.png', width: 16, height: 16 }} />;
        `,
      'ios',
      { unistylesEnabled: true }
    );

    expect(output).toContain('NativeImage');
  });

  it('optimizes an Image with a plain literal style in Unistyles mode', async () => {
    const output = await transformImage(
      `
          import { Image } from 'react-native';
          <Image source={{ uri: 'logo.png' }} style={{ width: 16, height: 16 }} />;
        `,
      'ios',
      { unistylesEnabled: true }
    );

    expect(output).toContain('NativeImage');
  });

  it('optimizes an Image with a React Native StyleSheet style in Unistyles mode', async () => {
    const output = await transformImage(
      `
          import { Image, StyleSheet } from 'react-native';
          const styles = StyleSheet.create({ image: { width: 16 } });
          <Image source={{ uri: 'logo.png' }} style={styles.image} />;
        `,
      'ios',
      { unistylesEnabled: true }
    );

    expect(output).toContain('NativeImage');
  });
});

describe('image unknown platform output', () => {
  it('bails because the native Image host prop contract is platform-specific', async () => {
    const logger = createLogger({ silent: true, verbose: false });
    const plugin = (): PluginObj => ({
      name: 'unknown-platform-image-optimizer-test',
      visitor: {
        JSXOpeningElement(path) {
          imageOptimizer(path, logger, {}, undefined);
        },
      },
    });

    const output = await formatTestResult(
      transformSync(
        `
          import { Image } from 'react-native';
          <Image source={{ uri: 'logo.png', width: 16, height: 16 }} />;
        `,
        {
          configFile: false,
          babelrc: false,
          plugins: ['@babel/plugin-syntax-jsx', plugin],
        }
      )!.code!
    );

    expect(output).not.toContain('NativeImage');
    expect(output).toContain('<Image');
  });
});

describe('image consumed props', () => {
  it.each(['ios', 'android'] as const)(
    'removes wrapper-consumed size and request props from optimized %s output',
    async (platform) => {
      const output = await transformImage(
        `
          import { Image } from 'react-native';
          <Image
            src="https://example.com/logo.png"
            width={16}
            height={16}
            crossOrigin="use-credentials"
            referrerPolicy="origin"
          />;
          <Image
            source={{ uri: 'logo.png', width: 16, height: 16 }}
            width={20}
            height={20}
            crossOrigin="use-credentials"
            referrerPolicy="no-referrer"
          />;
        `,
        platform
      );

      const images = getNativeImageAttributes(output);
      expect(images).toHaveLength(2);

      for (const image of images) {
        const names = getAttributeNames(image);
        expect(names.has('width')).toBe(false);
        expect(names.has('height')).toBe(false);
        expect(names.has('crossOrigin')).toBe(false);
        expect(names.has('referrerPolicy')).toBe(false);
      }
    }
  );
});
