import type { TOCItemType } from 'fumadocs-core/toc';
import type { ReactNode } from 'react';

export type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export type BaseReferenceEntry = {
  name: string;
  description: string;
};

type ReferenceSectionsProps<TEntry extends BaseReferenceEntry> = {
  entries: TEntry[];
  idPrefix: string;
  emptyMessage: string;
  headingLevel?: HeadingLevel;
  renderMeta: (entry: TEntry) => ReactNode;
};

type BuildEntryTocProps<TEntry extends BaseReferenceEntry> = {
  entries: TEntry[];
  idPrefix: string;
  depth: HeadingLevel;
};

export function toSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return slug.length > 0 ? slug : 'reference-entry';
}

export function getEntryId(idPrefix: string, value: string): string {
  return `${idPrefix}-${toSlug(value)}`;
}

function toParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replaceAll('\n', ' ').trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function renderInlineCode(value: string, keyPrefix: string): ReactNode {
  const parts = value.split(/`([^`]+)`/g);

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <code key={`${keyPrefix}-code-${index}`}>{part}</code>;
    }

    return <span key={`${keyPrefix}-text-${index}`}>{part}</span>;
  });
}

export function buildEntryToc<TEntry extends BaseReferenceEntry>({
  entries,
  idPrefix,
  depth,
}: BuildEntryTocProps<TEntry>): TOCItemType[] {
  return entries.map((entry) => ({
    title: entry.name,
    url: `#${getEntryId(idPrefix, entry.name)}`,
    depth,
  }));
}

export function ReferenceSections<TEntry extends BaseReferenceEntry>({
  entries,
  idPrefix,
  emptyMessage,
  headingLevel = 3,
  renderMeta,
}: ReferenceSectionsProps<TEntry>) {
  if (entries.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  const HeadingTag = `h${headingLevel}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  return (
    <>
      {entries.map((entry) => {
        const descriptionParagraphs = toParagraphs(entry.description);

        return (
          <section key={entry.name} id={getEntryId(idPrefix, entry.name)} className="mt-8 first:mt-0">
            <HeadingTag>
              <code>{entry.name}</code>
            </HeadingTag>

            {descriptionParagraphs.length > 0 ? (
              descriptionParagraphs.map((paragraph, index) => (
                <p key={`${entry.name}-description-${index}`}>
                  {renderInlineCode(paragraph, `${entry.name}-description-${index}`)}
                </p>
              ))
            ) : (
              <p>No description provided.</p>
            )}

            {renderMeta(entry)}
          </section>
        );
      })}
    </>
  );
}
