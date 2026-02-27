import defaultMdxComponents from 'fumadocs-ui/mdx';
import { AutoTypeTable } from 'fumadocs-typescript/ui';
import type { MDXComponents } from 'mdx/types';
import { AutoOptionSections } from '@/components/docs/auto-option-sections';
import { AutoRuntimeReference } from '@/components/docs/auto-runtime-reference';
import { typeGenerator } from '@/lib/type-generator';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    AutoOptionSections,
    AutoRuntimeReference,
    AutoTypeTable: (props) => <AutoTypeTable {...props} generator={typeGenerator} />,
    ...components,
  };
}
