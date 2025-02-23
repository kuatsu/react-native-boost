import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';

const extensions = ['.js', '.ts', '.tsx'];

// Treat all non-relative and non-absolute imports as external
const external = (id) => !id.startsWith('.') && !path.isAbsolute(id);

const commonPlugins = [
  resolve({ extensions }),
  replace({
    'preventAssignment': true,
    // Replace import.meta.env.MODE with NODE_ENV (adjust as needed)
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV || 'development'),
  }),
  esbuild({
    target: 'es2018',
    tsconfig: 'tsconfig.json',
  }),
];

export default [
  // Runtime Code Build (CommonJS and ESM)
  {
    input: 'src/runtime/index.ts',
    external,
    plugins: commonPlugins,
    output: [
      { file: 'dist/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/esm/index.mjs', format: 'esm', sourcemap: true },
    ],
  },
  // Plugin Code Build (CommonJS and ESM)
  {
    input: 'src/plugin/index.ts',
    external,
    plugins: commonPlugins,
    output: [
      { file: 'dist/plugin/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/plugin/esm/index.mjs', format: 'esm', sourcemap: true },
    ],
  },
  // Runtime Type Declarations Bundle (creates a single file)
  {
    input: 'src/runtime/index.ts',
    plugins: [dts()],
    external,
    output: { file: 'dist/index.d.ts', format: 'esm' },
  },
  // Plugin Type Declarations Bundle (creates a single file)
  {
    input: 'src/plugin/index.ts',
    plugins: [dts()],
    external,
    output: { file: 'dist/plugin/index.d.ts', format: 'esm' },
  },
];
