'use client';

import { useEffect, useRef, useState } from 'react';

export function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#252A3A',
          primaryTextColor: '#C5CBDA',
          primaryBorderColor: '#2A3045',
          lineColor: '#6B7489',
          secondaryColor: '#1C2030',
          tertiaryColor: '#141820',
        },
      });
      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      mermaid.render(id, chart).then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [chart]);

  if (!svg) return <pre className="text-sm text-[var(--text-dim)]"><code>{chart}</code></pre>;
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} className="my-4 [&_svg]:max-w-full" />;
}
