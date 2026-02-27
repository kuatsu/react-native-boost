import type { DocEntry, TypeTableProps } from 'fumadocs-typescript';
import { typeGenerator } from '../../lib/type-generator';
import { ReferenceSections, buildEntryToc, renderInlineCode, toSlug, type HeadingLevel } from './reference-sections';

type AutoOptionSectionsProps = Pick<TypeTableProps, 'name' | 'path' | 'type'> & {
  headingLevel?: HeadingLevel;
  idPrefix?: string;
};

type AutoOptionSectionsTocProps = Pick<TypeTableProps, 'name' | 'path' | 'type'> & {
  idPrefix?: string;
  depth?: HeadingLevel;
};

const optionEntriesCache = new Map<string, Promise<DocEntry[]>>();

function getEntriesCacheKey({ path, name, type }: Pick<TypeTableProps, 'path' | 'name' | 'type'>): string {
  return `${path ?? ''}|${name ?? ''}|${type ?? ''}`;
}

async function getOptionEntries(props: Pick<TypeTableProps, 'path' | 'name' | 'type'>): Promise<DocEntry[]> {
  const cacheKey = getEntriesCacheKey(props);
  const cachedEntries = optionEntriesCache.get(cacheKey);
  if (cachedEntries != null) {
    return cachedEntries;
  }

  const entriesPromise = typeGenerator.generateTypeTable(props).then((docs) => docs.flatMap((doc) => doc.entries));
  optionEntriesCache.set(cacheKey, entriesPromise);
  return entriesPromise;
}

function resolveIdPrefix(props: Pick<TypeTableProps, 'name' | 'type'>, idPrefix?: string): string {
  const prefixSource = props.name ?? props.type ?? 'options';
  return idPrefix ?? toSlug(prefixSource);
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

export async function AutoOptionSections({ headingLevel = 3, idPrefix, ...props }: AutoOptionSectionsProps) {
  const entries = await getOptionEntries(props);
  const resolvedIdPrefix = resolveIdPrefix(props, idPrefix);

  return (
    <ReferenceSections
      entries={entries}
      idPrefix={resolvedIdPrefix}
      emptyMessage="Could not generate options for this type."
      headingLevel={headingLevel}
      renderMeta={(entry) => {
        const defaultValues = readTagValues(entry, 'default');
        const extraTags = entry.tags.filter((tag) => tag.name !== 'default');

        return (
          <>
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
          </>
        );
      }}
    />
  );
}

export async function getAutoOptionSectionsToc({ idPrefix, depth = 3, ...props }: AutoOptionSectionsTocProps) {
  const entries = await getOptionEntries(props);
  const resolvedIdPrefix = resolveIdPrefix(props, idPrefix);

  return buildEntryToc({
    entries,
    idPrefix: resolvedIdPrefix,
    depth,
  });
}
