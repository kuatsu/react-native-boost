import type { DocEntry, TypeTableProps } from 'fumadocs-typescript';
import type { ReactNode } from 'react';
import { typeGenerator } from '../../lib/type-generator';

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

type AutoOptionSectionsProps = Pick<TypeTableProps, 'name' | 'path' | 'type'> & {
  headingLevel?: HeadingLevel;
  idPrefix?: string;
};

function toSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return slug.length > 0 ? slug : 'option';
}

function toParagraphs(description: string): string[] {
  return description
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replaceAll('\n', ' ').trim())
    .filter((paragraph) => paragraph.length > 0);
}

function readTagValues(entry: DocEntry, tagName: string): string[] {
  const values: string[] = [];

  for (const tag of entry.tags) {
    if (tag.name !== tagName) {
      continue;
    }

    const value = tag.text.trim();
    if (value.length > 0) {
      values.push(value);
    }
  }

  return values;
}

function renderInlineCode(value: string, keyPrefix: string): ReactNode {
  const parts = value.split(/`([^`]+)`/g);

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <code key={`${keyPrefix}-code-${index}`}>{part}</code>;
    }

    return <span key={`${keyPrefix}-text-${index}`}>{part}</span>;
  });
}

export async function AutoOptionSections({ headingLevel = 3, idPrefix, ...props }: AutoOptionSectionsProps) {
  const docs = await typeGenerator.generateTypeTable(props);
  const entries = docs.flatMap((doc) => doc.entries);

  if (entries.length === 0) {
    return <p>Could not generate options for this type.</p>;
  }

  const HeadingTag = `h${headingLevel}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  const prefixSource = props.name ?? props.type ?? 'options';
  const resolvedIdPrefix = idPrefix ?? toSlug(prefixSource);

  return (
    <>
      {entries.map((entry) => {
        const descriptionParagraphs = toParagraphs(entry.description);
        const defaultValues = readTagValues(entry, 'default');
        const extraTags = entry.tags.filter((tag) => tag.name !== 'default');

        return (
          <section key={entry.name} id={`${resolvedIdPrefix}-${toSlug(entry.name)}`} className="mt-8 first:mt-0">
            <HeadingTag>
              <code>{entry.name}</code>
            </HeadingTag>

            {descriptionParagraphs.length > 0 ? (
              descriptionParagraphs.map((paragraph, index) => (
                <p key={`${entry.name}-paragraph-${index}`}>
                  {renderInlineCode(paragraph, `${entry.name}-paragraph-${index}`)}
                </p>
              ))
            ) : (
              <p>No description provided.</p>
            )}

            <ul>
              <li>
                <strong>Type:</strong> <code>{entry.type}</code>
              </li>
              {defaultValues.length > 0 ? (
                <li>
                  <strong>Default:</strong> <code>{defaultValues[0]}</code>
                </li>
              ) : null}
              {entry.required ? (
                <li>
                  <strong>Required:</strong> <code>true</code>
                </li>
              ) : null}
            </ul>

            {entry.deprecated ? <p>Deprecated.</p> : null}

            {extraTags.length > 0 ? (
              <>
                <p>
                  <strong>Additional Notes</strong>
                </p>
                <ul>
                  {extraTags.map((tag, index) => (
                    <li key={`${entry.name}-tag-${tag.name}-${index}`}>
                      <strong>@{tag.name}:</strong>{' '}
                      {renderInlineCode(tag.text, `${entry.name}-tag-${tag.name}-${index}`)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
