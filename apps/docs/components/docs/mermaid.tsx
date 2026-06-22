'use client';

import { useEffect, useId, useState } from 'react';

type Props = {
  /** Mermaid diagram source (e.g. a `flowchart TD ...` string). */
  chart: string;
};

// `htmlLabels: false` renders node labels as plain SVG text, so characters like `(` `)` `:` are shown
// literally instead of being parsed as markup. `securityLevel: 'loose'` is required for mermaid to
// inline the rendered SVG we hand to `dangerouslySetInnerHTML`.
const BASE_CONFIG = {
  startOnLoad: false,
  securityLevel: 'loose',
  fontFamily: 'inherit',
  flowchart: { htmlLabels: false, useMaxWidth: true },
} as const;

/**
 * Tracks the active docs theme by watching the `.dark` class fumadocs toggles on `<html>`. Rendering a
 * single theme-matched diagram (rather than both variants) is deliberate: each mermaid SVG carries its
 * own `<style>` block, and a hidden second variant's styles still apply to the document — the later
 * (dark) block would override the visible (light) one, painting light-mode nodes with the dark palette.
 */
function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

/**
 * Renders a Mermaid diagram on the client, matched to the active docs theme and re-rendered when the
 * theme is toggled. Mermaid is imported dynamically to keep it out of the initial bundle.
 */
export function Mermaid({ chart }: Props) {
  const id = useId().replaceAll(/[^a-zA-Z0-9]/g, '');
  const isDark = useIsDarkTheme();
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        mermaid.initialize({ ...BASE_CONFIG, theme: isDark ? 'dark' : 'default' });
        const result = await mermaid.render(`${id}-${isDark ? 'dark' : 'light'}`, chart);

        if (!cancelled) setSvg(result.svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, id, isDark]);

  // If mermaid fails to parse the diagram, degrade to the readable source rather than breaking the page.
  if (failed) {
    return (
      <pre className="my-6 overflow-x-auto rounded-lg border p-4 text-sm">
        <code>{chart}</code>
      </pre>
    );
  }

  return <div className="my-6 flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />;
}
