import { createRequire } from 'node:module';
import path from 'node:path';
import { parseSync, transformSync, traverse, types as t, type TransformCaller } from '@babel/core';
import { pluginTester } from 'babel-plugin-tester';
import { describe, expect, it } from 'vitest';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { formatTestResult } from '../../../utils/format-test-result';
import type { TargetPlatform } from '../../../types';
import boostPlugin from '../../../index';
import { nativeImageOptimizer } from '..';

const transformImage = async (
  source: string,
  platform?: TargetPlatform,
  {
    unknownAncestorsDoNotRenderText = false,
    unistylesEnabled = false,
    reactNativeMinor = 86,
  }: {
    unknownAncestorsDoNotRenderText?: boolean;
    unistylesEnabled?: boolean;
    reactNativeMinor?: number | null;
  } = {}
): Promise<string> => {
  const plugin = generateTestPlugin(
    nativeImageOptimizer,
    {
      assumptions: { unknownAncestorsDoNotRenderText },
      integrations: { unistyles: unistylesEnabled ? 'on' : 'off' },
    },
    platform,
    reactNativeMinor ?? undefined
  );

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

const getHoistedImageSources = (source: string): t.ArrayExpression[] => {
  const ast = parseSync(source, {
    configFile: false,
    babelrc: false,
    parserOpts: { sourceType: 'module', plugins: ['jsx'] },
  });
  const sources: t.ArrayExpression[] = [];

  traverse(ast!, {
    VariableDeclarator(path) {
      if (
        t.isIdentifier(path.node.id) &&
        path.node.id.name.startsWith('_imageSource') &&
        t.isArrayExpression(path.node.init)
      ) {
        sources.push(path.node.init);
      }
    },
  });

  return sources;
};

const getSourceObjects = (source: t.ArrayExpression): t.ObjectExpression[] =>
  source.elements.map((element) => {
    if (!t.isObjectExpression(element)) throw new Error('expected an Image source object');
    return element;
  });

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

/**
 * Asserts an expression is a call to the named runtime gate (the emitted identifier is uid-prefixed)
 * and returns its single argument — the value the gate resolves at runtime.
 */
const unwrapRuntimeGate = (expression: t.Expression | undefined, helperName: string): t.Expression | undefined => {
  expect(t.isCallExpression(expression)).toBe(true);
  const call = expression as t.CallExpression;
  expect(t.isIdentifier(call.callee)).toBe(true);
  expect((call.callee as t.Identifier).name).toContain(helperName);
  expect(call.arguments).toHaveLength(1);
  return call.arguments[0] as t.Expression;
};

pluginTester({
  plugin: generateTestPlugin(nativeImageOptimizer, {}, 'ios'),
  title: 'image',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(nativeImageOptimizer, { assumptions: { unknownAncestorsDoNotRenderText: true } }, 'ios'),
  title: 'image unknown ancestor assumption',
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

  it('emits Android source without the legacy src duplicate, plus top-level headers for request header props', async () => {
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
    const [source] = getHoistedImageSources(output);
    const headers = getAttributeExpression(image, 'headers');

    expect(getAttributeNames(image).has('src')).toBe(false);
    expect(getAttributeExpression(image, 'source')).toMatchObject({ name: '_imageSource' });
    expect(source).toBeDefined();
    expect(t.isObjectExpression(headers)).toBe(true);
    expect(getStringPropertyValue(headers as t.ObjectExpression, 'Access-Control-Allow-Credentials')).toBe('true');
    expect(getStringPropertyValue(headers as t.ObjectExpression, 'Referrer-Policy')).toBe('origin');
  });

  it.each([
    [84, true],
    [85, false],
    [87, true],
  ])('resolves object-source header lifting for RN 0.%i at build time', async (reactNativeMinor, liftsHeaders) => {
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
      'android',
      { reactNativeMinor }
    );

    expect(output).not.toContain('processImageObjectSourceHeaders');
    const images = getNativeImageAttributes(output);
    const objectHeaders = getAttributeExpression(images[0]!, 'headers');
    if (liftsHeaders) {
      expect(t.isObjectExpression(objectHeaders)).toBe(true);
      expect(getStringPropertyValue(objectHeaders as t.ObjectExpression, 'Authorization')).toBe('Bearer object');
    } else {
      expect(objectHeaders).toBeUndefined();
    }

    const arrayHeaders = getAttributeExpression(images[1]!, 'headers');
    expect(t.isObjectExpression(arrayHeaders)).toBe(true);
    expect(getStringPropertyValue(arrayHeaders as t.ObjectExpression, 'Authorization')).toBe('Bearer first');
  });

  it('keeps the object-source header runtime gate when the RN version is unknown', async () => {
    const output = await transformImage(
      `import { Image } from 'react-native';
       <Image source={{ uri: 'logo.png', headers: { Authorization: 'Bearer object' } }} />;`,
      'android',
      { reactNativeMinor: null }
    );
    const headers = unwrapRuntimeGate(
      getAttributeExpression(getNativeImageAttributes(output)[0]!, 'headers'),
      'processImageObjectSourceHeaders'
    );

    expect(t.isObjectExpression(headers)).toBe(true);
  });

  it('resolves single-entry array source dimensions at build time on Android only', async () => {
    const source = `
        import { Image } from 'react-native';
        <Image src="https://example.com/logo.png" width={16} height={8} />;
        <Image source={[{ uri: 'logo.png', width: 16, height: 8 }]} />;
        <Image source={[{ uri: 'logo.png', width: 16, height: 8 }, { uri: 'logo@2x.png', width: 32, height: 16, scale: 2 }]} />;
      `;

    const getStyleDimensionEntries = (image: t.JSXAttribute[]): t.ObjectExpression => {
      const style = getAttributeExpression(image, 'style');
      expect(t.isArrayExpression(style)).toBe(true);
      const dimensions = (style as t.ArrayExpression).elements[0];
      expect(t.isObjectExpression(dimensions)).toBe(true);
      return dimensions as t.ObjectExpression;
    };

    const legacyOutput = await transformImage(source, 'android', { reactNativeMinor: 84 });
    expect(legacyOutput).not.toContain('processImageArraySourceDimensions');
    const legacyImages = getNativeImageAttributes(legacyOutput);
    for (const image of legacyImages) {
      expect(getStyleDimensionEntries(image).properties).toHaveLength(0);
    }

    const modernOutput = await transformImage(source, 'android', { reactNativeMinor: 85 });
    expect(modernOutput).not.toContain('processImageArraySourceDimensions');
    const modernImages = getNativeImageAttributes(modernOutput);
    for (const image of modernImages.slice(0, 2)) {
      const dimensions = getStyleDimensionEntries(image);
      expect(getObjectExpressionProperty(dimensions, 'width')).toMatchObject({ value: 16 });
      expect(getObjectExpressionProperty(dimensions, 'height')).toMatchObject({ value: 8 });
    }
    expect(getStyleDimensionEntries(modernImages[2]!).properties).toHaveLength(0);

    const unknownOutput = await transformImage(source, 'android', { reactNativeMinor: null });
    const unknownStyle = getAttributeExpression(getNativeImageAttributes(unknownOutput)[0]!, 'style');
    const unknownDimensions = unwrapRuntimeGate(
      (unknownStyle as t.ArrayExpression).elements[0] as t.Expression,
      'processImageArraySourceDimensions'
    );
    expect(t.isObjectExpression(unknownDimensions)).toBe(true);

    const iosImages = getNativeImageAttributes(await transformImage(source, 'ios'));
    for (const image of iosImages) {
      expect(getStyleDimensionEntries(image).properties).toHaveLength(0);
    }
  });

  it('defers a src source with dynamic dimensions to the runtime helper on Android', async () => {
    const source = `
        import { Image } from 'react-native';
        <Image src="https://example.com/logo.png" width={dynamicWidth} height={8} />;
      `;

    const androidOutput = await transformImage(source, 'android');
    expect(androidOutput).toContain('processImageSourceProps');

    // iOS emits the dimensions only once (in the source entry), so it can stay static.
    const iosOutput = await transformImage(source, 'ios');
    expect(iosOutput).not.toContain('processImageSourceProps');
    expect(iosOutput).not.toContain('const _imageSource');
    expect(iosOutput).toContain('<_NativeImage');
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

describe('image srcSet output', () => {
  it('parses and hoists static density sources', async () => {
    const output = await transformImage(
      `
        import { Image } from 'react-native';
        <Image srcSet="logo.png 1x, logo@2x.png 2x, logo@3x.png 3x" />;
      `,
      'ios'
    );

    expect(output).toContain('<_NativeImage');
    expect(output).not.toContain('processImageSourceProps');

    const image = getNativeImageAttributes(output)[0]!;
    expect(getAttributeNames(image).has('srcSet')).toBe(false);
    expect(getAttributeExpression(image, 'source')).toMatchObject({ name: '_imageSource' });

    const entries = getSourceObjects(getHoistedImageSources(output)[0]!);
    expect(entries).toHaveLength(3);
    expect(getStringPropertyValue(entries[0]!, 'uri')).toBe('logo.png');
    expect(getObjectExpressionProperty(entries[0]!, 'scale')).toMatchObject({ value: 1 });
    expect(getStringPropertyValue(entries[1]!, 'uri')).toBe('logo@2x.png');
    expect(getObjectExpressionProperty(entries[1]!, 'scale')).toMatchObject({ value: 2 });
    expect(getStringPropertyValue(entries[2]!, 'uri')).toBe('logo@3x.png');
    expect(getObjectExpressionProperty(entries[2]!, 'scale')).toMatchObject({ value: 3 });
  });

  it('matches the scale parser used by the target React Native version', async () => {
    const source = `
      import { Image } from 'react-native';
      <Image src="fallback.png" srcSet="logo.png 1.5x" />;
    `;
    const legacyEntries = getSourceObjects(
      getHoistedImageSources(await transformImage(source, 'ios', { reactNativeMinor: 86 }))[0]!
    );
    const modernEntries = getSourceObjects(
      getHoistedImageSources(await transformImage(source, 'ios', { reactNativeMinor: 87 }))[0]!
    );

    expect(legacyEntries.map((entry) => getObjectExpressionProperty(entry, 'scale'))).toMatchObject([{ value: 1 }]);
    expect(modernEntries.map((entry) => getObjectExpressionProperty(entry, 'scale'))).toMatchObject([
      { value: 1.5 },
      { value: 1 },
    ]);
  });

  it('uses the relaxed RN 0.87 separator parser only for RN 0.87', async () => {
    const source = `
      import { Image } from 'react-native';
      <Image srcSet="logo.png 1x,logo@2x.png 2x" />;
    `;
    const legacyOutput = await transformImage(source, 'ios', { reactNativeMinor: 86 });
    const modernOutput = await transformImage(source, 'ios', { reactNativeMinor: 87 });

    expect(legacyOutput).not.toContain('_NativeImage');
    expect(getSourceObjects(getHoistedImageSources(modernOutput)[0]!)).toHaveLength(2);
  });

  it('bails when no React Native version was identified', async () => {
    const output = await transformImage(
      `import { Image } from 'react-native';\n<Image srcSet="logo.png 1x" />;`,
      'ios',
      {
        reactNativeMinor: null,
      }
    );

    expect(output).not.toContain('_NativeImage');
  });

  it('uses an explicit React Native version from the Babel plugin options', async () => {
    const output = await formatTestResult(
      transformSync(`import { Image } from 'react-native';\n<Image srcSet="logo.png 1x,logo@2x.png 2x" />;`, {
        configFile: false,
        babelrc: false,
        filename: 'case.jsx',
        caller: { name: 'metro', platform: 'ios' } as TransformCaller,
        plugins: [
          '@babel/plugin-syntax-jsx',
          [
            boostPlugin,
            {
              logLevel: 'silent',
              target: { reactNative: { version: '0.87.1' } },
            },
          ],
        ],
      })!.code!
    );

    expect(getSourceObjects(getHoistedImageSources(output)[0]!)).toHaveLength(2);
  });

  it('detects the installed React Native version through the Babel plugin', async () => {
    const output = await formatTestResult(
      transformSync(`import { Image } from 'react-native';\n<Image srcSet="logo.png 1.5x" />;`, {
        configFile: false,
        babelrc: false,
        filename: 'case.jsx',
        caller: { name: 'metro', platform: 'ios' } as TransformCaller,
        plugins: ['@babel/plugin-syntax-jsx', [boostPlugin, { logLevel: 'silent' }]],
      })!.code!
    );
    const { version } = createRequire(import.meta.url)('react-native/package.json') as { version: string };
    const minor = Number(version.split('.')[1]);

    if (minor >= 83) {
      const entry = getSourceObjects(getHoistedImageSources(output)[0]!)[0]!;
      expect(getObjectExpressionProperty(entry, 'scale')).toMatchObject({ value: minor >= 87 ? 1.5 : 1 });
    } else {
      expect(output).not.toContain('_NativeImage');
    }
  });

  it('uses src only when srcSet has no 1x source', async () => {
    const output = await transformImage(
      `
        import { Image } from 'react-native';
        <Image src="fallback.png" srcSet="logo@2x.png 2x, logo@3x.png 3x" />;
        <Image src="ignored.png" srcSet="logo.png, logo@2x.png 2x" />;
      `,
      'ios'
    );

    const [withFallback, withDefault] = getHoistedImageSources(output).map((source) => getSourceObjects(source));
    expect(withFallback!.map((entry) => getStringPropertyValue(entry, 'uri'))).toEqual([
      'logo@2x.png',
      'logo@3x.png',
      'fallback.png',
    ]);
    expect(withFallback!.map((entry) => getObjectExpressionProperty(entry, 'scale'))).toMatchObject([
      { value: 2 },
      { value: 3 },
      { value: 1 },
    ]);
    expect(withDefault!.map((entry) => getStringPropertyValue(entry, 'uri'))).toEqual(['logo.png', 'logo@2x.png']);
  });

  it('builds static dimensions and request headers', async () => {
    const output = await transformImage(
      `
        import { Image } from 'react-native';
        <Image
          srcSet="logo.png 1x"
          width={24}
          height={12}
          crossOrigin="use-credentials"
          referrerPolicy="origin"
        />;
      `,
      'android'
    );

    const image = getNativeImageAttributes(output)[0]!;
    const entry = getSourceObjects(getHoistedImageSources(output)[0]!)[0]!;
    const headers = getAttributeExpression(image, 'headers');
    expect(t.isObjectExpression(headers)).toBe(true);
    expect(getStringPropertyValue(headers as t.ObjectExpression, 'Access-Control-Allow-Credentials')).toBe('true');
    expect(getStringPropertyValue(headers as t.ObjectExpression, 'Referrer-Policy')).toBe('origin');
    expect(getObjectExpressionProperty(entry, 'width')).toMatchObject({ value: 24 });
    expect(getObjectExpressionProperty(entry, 'height')).toMatchObject({ value: 12 });

    expect(output).not.toContain('processImageArraySourceDimensions');
    const style = getAttributeExpression(image, 'style') as t.ArrayExpression;
    const dimensions = style.elements[0] as t.ObjectExpression;
    expect(getObjectExpressionProperty(dimensions, 'width')).toMatchObject({ value: 24 });
    expect(getObjectExpressionProperty(dimensions, 'height')).toMatchObject({ value: 12 });
  });

  it.each([
    ['a dynamic srcSet', '<Image srcSet={sources} />'],
    ['a source prop', '<Image source={{ uri: "fallback.png" }} srcSet="logo.png 1x" />'],
    ['a dynamic dimension', '<Image srcSet="logo.png 1x" width={width} />'],
    ['a spread', '<Image srcSet="logo.png 1x" {...{ testID: "logo" }} />'],
    ['an unsupported descriptor', '<Image srcSet="logo.png 300w" />'],
    ['a separator unsupported by RN 0.86', '<Image srcSet="logo.png 1x,logo@2x.png 2x" />'],
    ['a malformed descriptor', '<Image srcSet="logo.png x" />'],
    ['a dynamic style', '<Image srcSet="logo.png 1x" style={styles.image} />'],
  ])('bails on %s', async (_reason, element) => {
    const output = await transformImage(`import { Image } from 'react-native';\n${element};`, 'ios');

    expect(output).not.toContain('_NativeImage');
    expect(output).toContain('<Image');
  });

  it.each([
    ['unsupported props', '<Image source={{ uri: "logo.png" }} onLoad={handleLoad} />'],
    ['spread props', '<Image source={{ uri: "logo.png" }} {...props} />'],
    ['children', '<Image source={{ uri: "logo.png" }}><Child /></Image>'],
    ['dynamic srcSet', '<Image srcSet={sources} />'],
    ['dynamic srcSet style', '<Image srcSet="logo.png 1x" style={styles.image} />'],
    ['missing source', '<Image />'],
  ])('lets @boost-force override the %s bailout', async (_reason, element) => {
    const output = await transformImage(
      `import { Image } from 'react-native';\n<>{/* @boost-force */}${element}</>;`,
      'ios'
    );

    expect(output).toContain('_NativeImage');
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

  it('lifts the Unistyles style bail with @boost-force', async () => {
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

    expect(output).toContain('NativeImage');
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
    const output = await transformImage(
      `
        import { Image } from 'react-native';
        <Image source={{ uri: 'logo.png', width: 16, height: 16 }} />;
        <>{/* @boost-force */}<Image source={{ uri: 'logo.png' }} /></>;
      `
    );

    expect(output).not.toContain('NativeImage');
    expect(output.match(/<Image/g)).toHaveLength(2);
  });
});

const imageSource = (value: string) => `
    import { Image } from 'react-native';
    <Image source={{ uri: 'logo.png', width: 16, height: 16 }} accessible={${value}} />;
  `;

describe('image nullable accessible', () => {
  it.each(['maybeAccessible', 'null'])(
    'routes accessible={%s} through the runtime helper on Android',
    async (value) => {
      const output = await transformImage(imageSource(value), 'android');

      expect(output).toContain('processImageAccessibilityProps');
      expect(getAttributeNames(getNativeImageAttributes(output)[0]).has('accessible')).toBe(false);
    }
  );

  it('keeps a provably non-nullish accessible inline on Android', async () => {
    const output = await transformImage(imageSource('false'), 'android');

    expect(output).not.toContain('processImageAccessibilityProps');
    expect(getAttributeNames(getNativeImageAttributes(output)[0]).has('accessible')).toBe(true);
  });

  it('passes accessible straight through on iOS, which forwards it unchanged', async () => {
    const output = await transformImage(imageSource('maybeAccessible'), 'ios');

    expect(output).not.toContain('processImageAccessibilityProps');
    expect(getAttributeNames(getNativeImageAttributes(output)[0]).has('accessible')).toBe(true);
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
