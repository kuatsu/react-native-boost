import path from 'node:path';
import resolve from '@rollup/plugin-node-resolve';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';

const extensions = ['.js', '.ts', '.tsx'];
const external = (id) => !id.startsWith('.') && !path.isAbsolute(id);
const commonPlugins = [
  resolve({ extensions }),
  esbuild({
    target: 'es2018',
    tsconfig: 'tsconfig.json',
  }),
];
const nodePlugins = [resolve({ extensions }), esbuild({ target: 'esnext', tsconfig: 'tsconfig.json' })];

export default [
  {
    input: 'src/runtime/index.ts',
    external,
    plugins: commonPlugins,
    output: [
      { file: 'dist/runtime/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/runtime/esm/index.mjs', format: 'esm', sourcemap: true },
    ],
  },
  {
    input: 'src/runtime/index.web.ts',
    external,
    plugins: commonPlugins,
    output: [
      { file: 'dist/runtime/index.web.js', format: 'cjs', sourcemap: true },
      { file: 'dist/runtime/esm/index.web.mjs', format: 'esm', sourcemap: true },
    ],
  },
  {
    input: 'src/plugin/index.ts',
    external,
    plugins: commonPlugins,
    output: [
      { file: 'dist/plugin/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/plugin/esm/index.mjs', format: 'esm', sourcemap: true },
    ],
  },
  {
    input: 'src/metro/index.ts',
    external,
    plugins: nodePlugins,
    output: { file: 'dist/metro/index.js', format: 'cjs', sourcemap: true },
  },
  {
    input: 'src/metro/transformer.ts',
    external,
    plugins: nodePlugins,
    output: { file: 'dist/metro/transformer.js', format: 'cjs', sourcemap: true },
  },
  {
    input: 'src/metro/worker.ts',
    external,
    plugins: nodePlugins,
    output: { file: 'dist/metro/worker.js', format: 'cjs', sourcemap: true },
  },
  {
    input: 'src/runtime/index.ts',
    plugins: [dts()],
    external,
    output: { file: 'dist/runtime/index.d.ts', format: 'esm' },
  },
  {
    input: 'src/runtime/index.web.ts',
    plugins: [dts()],
    external,
    output: { file: 'dist/runtime/index.web.d.ts', format: 'esm' },
  },
  {
    input: 'src/plugin/index.ts',
    plugins: [dts()],
    external,
    output: { file: 'dist/plugin/index.d.ts', format: 'esm' },
  },
  {
    input: 'src/metro/index.ts',
    plugins: [dts()],
    external,
    output: { file: 'dist/metro/index.d.ts', format: 'esm' },
  },
];
