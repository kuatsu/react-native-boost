import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createTransformer } from '../transformer';
import { createWorker } from '../worker';

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
      `exports.transform = args => ({ ast: {}, metadata: { reactNativeBoost: { injectionId: args.plugins[0][1].__reactNativeBoost, analysis: { exports: {}, exportAll: [], references: [{ source: './Card', imported: 'Card' }] } } } });\nexports.getCacheKey = () => 'delegate';\n`
    );
    fs.writeFileSync(pluginPath, 'module.exports = () => ({ visitor: {} });\n');
    const injectionId = 'test-injection';
    const manifest = {
      babelTransformerPath: delegatePath,
      pluginPath,
      pluginOptions: { logLevel: 'silent' as const },
      injectionId,
    };
    const transformer = createTransformer(manifest);

    const result = await transformer.transform({ filename: 'case.js', src: '', options: {}, plugins: [] });

    expect(result.metadata?.reactNativeBoost).toEqual({
      injectionId,
      analysis: {
        exports: {},
        exportAll: [],
        references: [{ source: './Card', imported: 'Card' }],
      },
    });
    expect(transformer.getCacheKey()).toBe(transformer.getCacheKey());
    expect(transformer.getCacheKey()).not.toBe(
      createTransformer({ ...manifest, injectionId: 'different-injection' }).getCacheKey()
    );
  });

  it('carries Babel analysis through a full Metro worker', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-boost-worker-'));
    temporaryDirectories.push(directory);
    const babelDelegatePath = path.join(directory, 'babel.cjs');
    const pluginPath = path.join(directory, 'plugin.cjs');
    const workerDelegatePath = path.join(directory, 'worker.cjs');
    fs.writeFileSync(
      babelDelegatePath,
      `exports.transform = args => ({ ast: {}, metadata: { reactNativeBoost: { injectionId: args.plugins[0][1].__reactNativeBoost, analysis: { exports: { Card: 'safe' }, exportAll: [], references: [] } } } });`
    );
    fs.writeFileSync(pluginPath, 'module.exports = () => ({ visitor: {} });');
    fs.writeFileSync(
      workerDelegatePath,
      `exports.transform = async () => ({ dependencies: [], output: [{ type: 'js/module', data: { code: '' } }] });`
    );
    const injectionId = 'worker-injection';
    const transformer = createTransformer({
      babelTransformerPath: babelDelegatePath,
      pluginPath,
      pluginOptions: {},
      injectionId,
    });
    const worker = createWorker({ transformerPath: workerDelegatePath, injectionId });

    await transformer.transform({ filename: 'Card.js', src: '', options: {}, plugins: [] });
    const result = await worker.transform({}, directory, 'Card.js', Buffer.alloc(0), {});

    expect(result.output[0].data.reactNativeBoost).toEqual({
      injectionId,
      analysis: { exports: { Card: 'safe' }, exportAll: [], references: [] },
    });
  });
});
