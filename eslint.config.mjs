import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: globals.node } },
  { ignores: ['**/fixtures', '**/*.config.{js,mjs,cjs}'] },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginUnicorn.configs.recommended,
];
