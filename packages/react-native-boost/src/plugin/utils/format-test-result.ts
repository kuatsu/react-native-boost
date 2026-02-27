import type { ResultFormatter } from 'babel-plugin-tester';
import { format, type FormatOptions } from 'oxfmt';
import oxfmtConfig from '../../../../../.oxfmtrc.json';

type RootOxfmtConfig = FormatOptions & {
  $schema?: string;
  ignorePatterns?: string[];
};

const oxfmtOptions = buildOxfmtOptions(oxfmtConfig as RootOxfmtConfig);

export const formatTestResult: ResultFormatter = async (code, options) => {
  const filepath = options?.filepath ?? 'output.js';
  const result = await format(filepath, code, oxfmtOptions);

  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  return result.code;
};

function buildOxfmtOptions(config: RootOxfmtConfig): FormatOptions {
  const { $schema, ignorePatterns, ...oxfmtOptions } = config;
  void $schema;
  void ignorePatterns;

  return oxfmtOptions;
}
