import defaultMdxComponents from 'fumadocs-ui/mdx';
import { createFileSystemGeneratorCache, createGenerator } from 'fumadocs-typescript';
import { AutoTypeTable } from 'fumadocs-typescript/ui';
import type { MDXComponents } from 'mdx/types';

const typeGenerator = createGenerator({
  cache: createFileSystemGeneratorCache('.next/fumadocs-typescript'),
});

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    AutoTypeTable: (props) => <AutoTypeTable {...props} generator={typeGenerator} />,
    ...components,
  };
}
