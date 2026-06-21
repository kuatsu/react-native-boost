import { highlight } from 'fumadocs-core/highlight';
import { CodeBlock, type CodeBlockProps, Pre } from 'fumadocs-ui/components/codeblock';
import { ExternalLink, Github } from 'lucide-react';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/cn';

// `CodeBlock` renders `title` as a `ReactNode`, but inherits the `<figure>` element's `title` typing
// (a plain string). Re-type it so the title bar can be a link element.
const CodeBlockWithNodeTitle = CodeBlock as (
  props: Omit<CodeBlockProps, 'title'> & { title?: ReactNode }
) => ReactElement;

type Props = {
  /**
   * Permalink to the file on GitHub, e.g.
   * `https://github.com/owner/repo/blob/<sha>/path/to/file.js#L77-L78`. The repository, file path,
   * commit ref and starting line number are all derived from this single URL.
   */
  url: string;
  /** The snippet's source, rendered verbatim. Indentation is preserved; one trailing newline is dropped. */
  code: string;
  /** Shiki language id. Defaults to the file extension parsed from the URL. */
  lang?: string;
};

type ParsedBlobUrl = {
  owner: string;
  repo: string;
  path: string;
  startLine: number;
};

// Assumes a GitHub permalink whose ref is a single path segment (commit SHA or slash-free branch),
// which is the format GitHub produces for "copy permalink". Branch names containing slashes are not
// supported because they're ambiguous with the file path.
const BLOB_URL_PATTERN = /github\.com\/([^/]+)\/([^/]+)\/blob\/[^/]+\/([^#]+)(?:#L(\d+))?/;

function parseBlobUrl(url: string): ParsedBlobUrl {
  const match = url.match(BLOB_URL_PATTERN);
  if (!match) {
    throw new Error(`GitHubSnippet: could not parse GitHub blob URL: ${url}`);
  }

  const [, owner, repo, path, startLine] = match;
  return {
    owner,
    repo,
    path,
    startLine: startLine ? Number(startLine) : 1,
  };
}

function SnippetHeader({ url, owner, repo, path }: { url: string } & ParsedBlobUrl): ReactElement {
  const lastSlash = path.lastIndexOf('/');
  const directory = lastSlash === -1 ? '' : path.slice(0, lastSlash + 1);
  const fileName = lastSlash === -1 ? path : path.slice(lastSlash + 1);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={`${owner}/${repo}/${path}`}
      className="group/snippet flex min-w-0 items-center gap-1.5 transition-colors hover:text-fd-foreground">
      <Github className="size-3.5 shrink-0" />
      <span className="shrink-0 font-medium text-fd-foreground">
        {owner}/{repo}
      </span>
      <span className="flex min-w-0 items-center">
        <span className="shrink-0 px-1 text-fd-muted-foreground/50">/</span>
        <span className="truncate">{directory}</span>
        <span className="shrink-0 text-fd-foreground/90">{fileName}</span>
      </span>
      <ExternalLink className="size-3 shrink-0 opacity-50 transition-opacity group-hover/snippet:opacity-100" />
    </a>
  );
}

/**
 * Renders a code snippet pulled from an external GitHub file. It looks identical to the docs' own
 * code blocks — same Shiki theme, copy button and line numbers — but its title bar is a link to the
 * source file.
 *
 * The code is highlighted on the server and handed to the client `CodeBlock`, mirroring how Fumadocs
 * highlights MDX code fences. `data-line-numbers-start` offsets the line counter so the numbers match
 * the file (the snippet here starts at line 77, not 1).
 */
export async function GitHubSnippet({ url, code, lang }: Props): Promise<ReactNode> {
  const parsed = parseBlobUrl(url);
  const extension = parsed.path.includes('.') ? parsed.path.slice(parsed.path.lastIndexOf('.') + 1) : '';
  const language = lang ?? (extension || 'text');

  return highlight(code.replace(/\n$/, ''), {
    lang: language,
    components: {
      pre: ({ children, className, ...preProps }: ComponentProps<'pre'>) => (
        <CodeBlockWithNodeTitle
          {...preProps}
          className={cn(className)}
          title={<SnippetHeader url={url} {...parsed} />}
          data-line-numbers
          data-line-numbers-start={parsed.startLine}>
          <Pre>{children}</Pre>
        </CodeBlockWithNodeTitle>
      ),
    },
  });
}
