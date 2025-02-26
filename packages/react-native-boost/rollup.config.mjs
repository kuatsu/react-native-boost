import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';
import fs from 'fs/promises';

const extensions = ['.js', '.ts', '.tsx'];

// Treat all non-relative and non-absolute imports as external
const external = (id) => !id.startsWith('.') && !path.isAbsolute(id);

// Custom plugin to generate entry point files
function generateEntryPoints() {
  return {
    name: 'generate-entry-points',
    writeBundle: async () => {
      // Define entry point configurations
      const entryPoints = [
        {
          name: 'runtime',
          description: 'runtime',
          paths: {
            cjs: './dist/runtime/index',
            esm: './dist/runtime/esm/index.mjs',
            dts: './dist/runtime/index',
          },
        },
        {
          name: 'plugin',
          description: 'plugin',
          paths: {
            cjs: './dist/plugin/index',
            esm: './dist/plugin/esm/index.mjs',
            dts: './dist/plugin/index',
          },
        },
      ];

      // Helper function to create entry point files
      const createEntryPoint = async (config, format) => {
        const { name, description, paths } = config;

        switch (format) {
          case 'cjs':
            await fs.writeFile(`${name}.js`, `module.exports = require('${paths.cjs}');\n`);
            break;
          case 'esm':
            await fs.writeFile(`${name}.mjs`, `export * from '${paths.esm}';\n`);
            break;
          case 'dts':
            await fs.writeFile(`${name}.d.ts`, `export * from '${paths.dts}';\n`);
            break;
        }
      };

      // Generate all entry points
      for (const config of entryPoints) {
        await createEntryPoint(config, 'cjs');
        await createEntryPoint(config, 'esm');
        await createEntryPoint(config, 'dts');
      }
    },
  };
}

const commonPlugins = [
  resolve({ extensions }),
  replace({
    'preventAssignment': true,
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV || 'development'),
  }),
  esbuild({
    target: 'es2018',
    tsconfig: 'tsconfig.json',
  }),
];

// Add the entry point generator to the last build step
const lastBuildPlugins = [...commonPlugins, generateEntryPoints()];

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
  {
    input: 'src/runtime/index.ts',
    external,
    plugins: commonPlugins,
    output: [
      { file: 'dist/runtime/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/runtime/esm/index.mjs', format: 'esm', sourcemap: true },
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
  {
    input: 'src/runtime/index.ts',
    plugins: [dts()],
    external,
    output: { file: 'dist/runtime/index.d.ts', format: 'esm' },
  },
  // Plugin Type Declarations Bundle (creates a single file)
  {
    input: 'src/plugin/index.ts',
    plugins: [dts(), generateEntryPoints()],
    external,
    output: { file: 'dist/plugin/index.d.ts', format: 'esm' },
  },
];
