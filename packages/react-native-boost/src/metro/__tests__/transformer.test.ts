import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createTransformer } from '../transformer';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('Metro transformer', () => {
  it('injects Boost options and verifies the transform result', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-boost-transformer-'));
    temporaryDirectories.push(directory);
    const delegatePath = path.join(directory, 'delegate.cjs');
    const pluginPath = path.join(directory, 'plugin.cjs');
    fs.writeFileSync(
      delegatePath,
      `exports.transform = args => ({ ast: {}, metadata: { reactNativeBoost: { injectionId: args.plugins[0][1].__reactNativeBoost } } });\nexports.getCacheKey = () => 'delegate';\n`
    );
    fs.writeFileSync(pluginPath, 'module.exports = () => ({ visitor: {} });\n');
    const injectionId = 'test-injection';
    const transformer = createTransformer({
      babelTransformerPath: delegatePath,
      pluginPath,
      pluginOptions: { logLevel: 'silent' },
      injectionId,
    });

    const result = await transformer.transform({ filename: 'case.js', src: '', options: {}, plugins: [] });

    expect(result.metadata?.reactNativeBoost).toEqual({ injectionId });
    expect(transformer.getCacheKey()).toHaveLength(64);
  });
});
