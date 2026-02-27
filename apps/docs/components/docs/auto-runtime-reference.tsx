import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import { Node, Project, type ExportedDeclarations, type JSDocTag } from 'ts-morph';
import type { ReactNode } from 'react';

type RuntimeExportKind = 'function' | 'component' | 'constant' | 'type';

type RuntimeParameter = {
  name: string;
  type: string;
  description: string;
};

type RuntimeTag = {
  name: string;
  text: string;
};

type RuntimeExportEntry = {
  name: string;
  kind: RuntimeExportKind;
  typeText: string;
  description: string;
  parameters: RuntimeParameter[];
  returnType?: string;
  returnDescription?: string;
  tags: RuntimeTag[];
  sourceOrder: number;
  declarationOrder: number;
};

type AutoRuntimeReferenceProps = {
  path: string;
};

type SupportedDeclaration = Extract<
  ExportedDeclarations,
  | import('ts-morph').FunctionDeclaration
  | import('ts-morph').VariableDeclaration
  | import('ts-morph').TypeAliasDeclaration
>;

const GROUP_TITLES: Record<RuntimeExportKind, string> = {
  function: 'Functions',
  component: 'Components',
  constant: 'Constants',
  type: 'Types',
};

const GROUP_ORDER: RuntimeExportKind[] = ['function', 'component', 'constant', 'type'];

let cachedProject: Project | undefined;
let cachedTsConfigPath: string | undefined;

function resolveRepositoryRoot(startPath: string): string {
  const candidates = [
    startPath,
    nodePath.resolve(startPath, '..'),
    nodePath.resolve(startPath, '..', '..'),
    nodePath.resolve(startPath, '..', '..', '..'),
  ];

  for (const candidate of candidates) {
    if (existsSync(nodePath.join(candidate, 'packages/react-native-boost/src/runtime/index.ts'))) {
      return candidate;
    }
  }

  throw new Error('Could not resolve repository root for runtime docs generation.');
}

function getProject(tsConfigPath: string): Project {
  if (cachedProject != null && cachedTsConfigPath === tsConfigPath) {
    return cachedProject;
  }

  cachedProject = new Project({
    tsConfigFilePath: tsConfigPath,
  });
  cachedTsConfigPath = tsConfigPath;
  return cachedProject;
}

function isSupportedDeclaration(declaration: ExportedDeclarations): declaration is SupportedDeclaration {
  return (
    Node.isFunctionDeclaration(declaration) ||
    Node.isVariableDeclaration(declaration) ||
    Node.isTypeAliasDeclaration(declaration)
  );
}

function readTagComment(tag: JSDocTag): string {
  const comment = tag.getComment();

  if (typeof comment === 'string') {
    return comment.trim();
  }

  if (Array.isArray(comment)) {
    return comment
      .map((part) => {
        if (part == null) {
          return '';
        }

        if (typeof part === 'string') {
          return part;
        }

        if (typeof part.getText === 'function') {
          return part.getText();
        }

        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

function normalizeParameterDescription(value: string): string {
  return value.replace(/^\s*-\s*/, '').trim();
}

function readDeclarationDocumentation(declaration: SupportedDeclaration) {
  const jsDocs = Node.isVariableDeclaration(declaration)
    ? (declaration.getVariableStatement()?.getJsDocs() ?? [])
    : declaration.getJsDocs();

  const descriptions: string[] = [];
  const parameterDescriptions = new Map<string, string>();
  const tags: RuntimeTag[] = [];
  let returnDescription: string | undefined;

  for (const jsDoc of jsDocs) {
    const description = jsDoc.getDescription().trim();
    if (description.length > 0) {
      descriptions.push(description);
    }

    for (const tag of jsDoc.getTags()) {
      const tagName = tag.getTagName();
      const text = readTagComment(tag);

      if (Node.isJSDocParameterTag(tag)) {
        parameterDescriptions.set(tag.getName(), normalizeParameterDescription(text));
        continue;
      }

      if (Node.isJSDocReturnTag(tag)) {
        returnDescription = text;
        continue;
      }

      tags.push({
        name: tagName,
        text,
      });
    }
  }

  return {
    description: descriptions.join('\n\n'),
    parameterDescriptions,
    returnDescription,
    tags,
  };
}

function readKind(declaration: SupportedDeclaration): RuntimeExportKind {
  if (Node.isFunctionDeclaration(declaration)) {
    return 'function';
  }

  if (Node.isTypeAliasDeclaration(declaration)) {
    return 'type';
  }

  const sourceFilePath = declaration.getSourceFile().getFilePath().replaceAll('\\', '/');
  if (sourceFilePath.includes('/runtime/components/')) {
    return 'component';
  }

  return 'constant';
}

function readTypeText(declaration: SupportedDeclaration): string {
  if (Node.isFunctionDeclaration(declaration)) {
    const parameterSignature = declaration
      .getParameters()
      .map((parameter) => `${parameter.getName()}: ${parameter.getType().getText(parameter)}`)
      .join(', ');
    const returnType = declaration.getReturnType().getText(declaration);

    return `(${parameterSignature}) => ${returnType}`;
  }

  if (Node.isTypeAliasDeclaration(declaration)) {
    return declaration.getTypeNode()?.getText() ?? declaration.getType().getText(declaration);
  }

  return declaration.getType().getText(declaration);
}

function readParameters(
  declaration: SupportedDeclaration,
  parameterDescriptions: Map<string, string>
): RuntimeParameter[] {
  if (!Node.isFunctionDeclaration(declaration)) {
    return [];
  }

  return declaration.getParameters().map((parameter) => ({
    name: parameter.getName(),
    type: parameter.getType().getText(parameter),
    description: parameterDescriptions.get(parameter.getName()) ?? '',
  }));
}

function toSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return slug.length > 0 ? slug : 'runtime-export';
}

function toParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replaceAll('\n', ' ').trim())
    .filter((paragraph) => paragraph.length > 0);
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

function selectDeclaration(
  declarations: ExportedDeclarations[],
  sourceOrderByPath: Map<string, number>
): SupportedDeclaration | undefined {
  const supportedDeclarations = declarations.filter((declaration) => isSupportedDeclaration(declaration));
  if (supportedDeclarations.length === 0) {
    return undefined;
  }

  return [...supportedDeclarations].sort((left, right) => {
    const leftOrder = sourceOrderByPath.get(left.getSourceFile().getFilePath()) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = sourceOrderByPath.get(right.getSourceFile().getFilePath()) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.getStart() - right.getStart();
  })[0];
}

function buildRuntimeExportEntries(indexFilePath: string): RuntimeExportEntry[] {
  const repositoryRoot = resolveRepositoryRoot(process.cwd());
  const packageTsConfigPath = nodePath.join(repositoryRoot, 'packages/react-native-boost/tsconfig.json');
  const docsRoot = nodePath.join(repositoryRoot, 'apps/docs');
  const project = getProject(packageTsConfigPath);

  const absoluteIndexFilePath = nodePath.resolve(docsRoot, indexFilePath);
  const indexFile = project.getSourceFile(absoluteIndexFilePath) ?? project.addSourceFileAtPath(absoluteIndexFilePath);

  const sourceOrderByPath = new Map<string, number>();
  sourceOrderByPath.set(indexFile.getFilePath(), 0);
  let sourceOrder = 1;
  for (const exportDeclaration of indexFile.getExportDeclarations()) {
    const sourceFile = exportDeclaration.getModuleSpecifierSourceFile();
    if (sourceFile == null) {
      continue;
    }

    const sourceFilePath = sourceFile.getFilePath();
    if (!sourceOrderByPath.has(sourceFilePath)) {
      sourceOrderByPath.set(sourceFilePath, sourceOrder);
      sourceOrder += 1;
    }
  }

  const entries: RuntimeExportEntry[] = [];

  for (const [name, declarations] of indexFile.getExportedDeclarations()) {
    const declaration = selectDeclaration(declarations, sourceOrderByPath);
    if (declaration == null) {
      continue;
    }

    const docs = readDeclarationDocumentation(declaration);
    const kind = readKind(declaration);
    const typeText = readTypeText(declaration);
    const parameters = readParameters(declaration, docs.parameterDescriptions);
    const returnType = Node.isFunctionDeclaration(declaration)
      ? declaration.getReturnType().getText(declaration)
      : undefined;

    entries.push({
      name,
      kind,
      typeText,
      description: docs.description,
      parameters,
      returnType,
      returnDescription: docs.returnDescription,
      tags: docs.tags,
      sourceOrder: sourceOrderByPath.get(declaration.getSourceFile().getFilePath()) ?? Number.MAX_SAFE_INTEGER,
      declarationOrder: declaration.getStart(),
    });
  }

  return entries.sort((left, right) => {
    if (left.sourceOrder !== right.sourceOrder) {
      return left.sourceOrder - right.sourceOrder;
    }

    return left.declarationOrder - right.declarationOrder;
  });
}

export function AutoRuntimeReference({ path }: AutoRuntimeReferenceProps) {
  const exports = buildRuntimeExportEntries(path);

  if (exports.length === 0) {
    return <p>Could not generate runtime reference from the provided entry file.</p>;
  }

  return (
    <>
      {GROUP_ORDER.map((group) => {
        const groupEntries = exports.filter((entry) => entry.kind === group);
        if (groupEntries.length === 0) {
          return null;
        }

        return (
          <section key={group} className="mt-10 first:mt-0">
            <h2>{GROUP_TITLES[group]}</h2>

            {groupEntries.map((entry) => {
              const descriptionParagraphs = toParagraphs(entry.description);
              const remarks = entry.tags.filter((tag) => tag.name === 'remarks' && tag.text.length > 0);
              const additionalTags = entry.tags.filter((tag) => tag.name !== 'remarks' && tag.text.length > 0);

              return (
                <article key={entry.name} id={`runtime-export-${toSlug(entry.name)}`} className="mt-8 first:mt-0">
                  <h3>
                    <code>{entry.name}</code>
                  </h3>

                  {descriptionParagraphs.length > 0 ? (
                    descriptionParagraphs.map((paragraph, index) => (
                      <p key={`${entry.name}-description-${index}`}>
                        {renderInlineCode(paragraph, `${entry.name}-description-${index}`)}
                      </p>
                    ))
                  ) : (
                    <p>No description provided.</p>
                  )}

                  <ul>
                    <li>
                      <strong>Type:</strong> <code>{entry.typeText}</code>
                    </li>
                  </ul>

                  {entry.parameters.length > 0 ? (
                    <>
                      <h4>Parameters</h4>
                      <ul>
                        {entry.parameters.map((parameter) => (
                          <li key={`${entry.name}-parameter-${parameter.name}`}>
                            <code>{parameter.name}</code>: <code>{parameter.type}</code>
                            {parameter.description.length > 0 ? ' - ' : ''}
                            {parameter.description.length > 0
                              ? renderInlineCode(parameter.description, `${entry.name}-parameter-${parameter.name}`)
                              : null}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {entry.returnType == null ? null : (
                    <>
                      <h4>Returns</h4>
                      <p>
                        <code>{entry.returnType}</code>
                        {entry.returnDescription != null && entry.returnDescription.length > 0 ? ': ' : ''}
                        {entry.returnDescription != null && entry.returnDescription.length > 0
                          ? renderInlineCode(entry.returnDescription, `${entry.name}-returns`)
                          : null}
                      </p>
                    </>
                  )}

                  {remarks.length > 0 ? (
                    <>
                      <h4>Notes</h4>
                      {remarks.map((tag, index) => (
                        <p key={`${entry.name}-remark-${index}`}>
                          {renderInlineCode(tag.text, `${entry.name}-remark-${index}`)}
                        </p>
                      ))}
                    </>
                  ) : null}

                  {additionalTags.length > 0 ? (
                    <>
                      <h4>Additional Tags</h4>
                      <ul>
                        {additionalTags.map((tag, index) => (
                          <li key={`${entry.name}-tag-${tag.name}-${index}`}>
                            <strong>@{tag.name}:</strong>{' '}
                            {renderInlineCode(tag.text, `${entry.name}-tag-${tag.name}-${index}`)}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </article>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
