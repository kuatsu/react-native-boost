import type { ResultFormatter } from 'babel-plugin-tester';
import { format, type FormatOptions } from 'oxfmt';

const oxfmtOptions: FormatOptions = {
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'consistent',
  jsxSingleQuote: false,
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  sortPackageJson: false,
};

export const formatTestResult: ResultFormatter = async (code, options) => {
  const filepath = options?.filepath ?? 'output.js';
  const result = await format(filepath, code, oxfmtOptions);

  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  return result.code;
};
