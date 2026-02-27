import defaultMdxComponents from 'fumadocs-ui/mdx';
import { AutoTypeTable } from 'fumadocs-typescript/ui';
import type { MDXComponents } from 'mdx/types';
import { AutoOptionSections } from '@/components/docs/auto-option-sections';
import { typeGenerator } from '@/lib/type-generator';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    AutoOptionSections,
    AutoTypeTable: (props) => <AutoTypeTable {...props} generator={typeGenerator} />,
    ...components,
  };
}
