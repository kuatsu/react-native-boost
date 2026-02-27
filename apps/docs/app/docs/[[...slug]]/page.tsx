import { getPageImage, source } from '@/lib/source';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/mdx-components';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { TOCItemType } from 'fumadocs-core/toc';
import { LLMCopyButton, ViewOptions } from '@/components/ai/page-actions';
import { gitConfig } from '@/lib/layout.shared';
import { getAutoOptionSectionsToc } from '@/components/docs/auto-option-sections';
import { getRuntimeReferenceToc } from '@/components/docs/auto-runtime-reference';

const runtimeReferencePath = '../../packages/react-native-boost/src/runtime/index.ts';
const pluginTypesPath = '../../packages/react-native-boost/src/plugin/types/index.ts';

type TocInsertion = {
  afterUrl: string;
  items: TOCItemType[];
};

async function getTocInsertions(slug: string): Promise<TocInsertion[]> {
  if (slug === 'runtime-library') {
    return [
      {
        afterUrl: '#api-reference',
        items: getRuntimeReferenceToc(runtimeReferencePath),
      },
    ];
  }

  if (slug === 'configuration/configure') {
    const [pluginOptionsToc, pluginOptimizationOptionsToc] = await Promise.all([
      getAutoOptionSectionsToc({
        path: pluginTypesPath,
        name: 'PluginOptions',
        idPrefix: 'plugin-options',
        depth: 3,
      }),
      getAutoOptionSectionsToc({
        path: pluginTypesPath,
        name: 'PluginOptimizationOptions',
        idPrefix: 'plugin-optimization-options',
        depth: 3,
      }),
    ]);

    return [
      {
        afterUrl: '#plugin-options',
        items: pluginOptionsToc,
      },
      {
        afterUrl: '#plugin-optimization-options',
        items: pluginOptimizationOptionsToc,
      },
    ];
  }

  return [];
}

function mergeToc(baseToc: TOCItemType[], insertions: TocInsertion[]): TOCItemType[] {
  if (insertions.length === 0) {
    return baseToc;
  }

  const remainingInsertions = [...insertions];
  const mergedToc: TOCItemType[] = [];

  for (const item of baseToc) {
    mergedToc.push(item);

    for (let index = 0; index < remainingInsertions.length; index += 1) {
      const insertion = remainingInsertions[index];
      if (insertion.afterUrl !== item.url) {
        continue;
      }

      mergedToc.push(...insertion.items);
      remainingInsertions.splice(index, 1);
      index -= 1;
    }
  }

  return mergedToc;
}

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const slug = page.slugs.join('/');
  const tocInsertions = await getTocInsertions(slug);
  const toc = mergeToc(page.data.toc ?? [], tocInsertions);

  return (
    <DocsPage toc={toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
        <ViewOptions
          markdownUrl={`${page.url}.mdx`}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
