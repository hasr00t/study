'use client';

export function CodeBlock({ children, className }: { children: string; className?: string }) {
  const language = className?.replace('language-', '') || '';
  // "text" is what a plain fence reports — labelling it adds nothing.
  const showLabel = language && language !== 'text' && language !== 'plain';

  return (
    <pre className="bg-[var(--code-bg)] text-[var(--code-text)] rounded-lg p-4 overflow-x-auto text-sm font-mono my-4 border border-[var(--border)]">
      {showLabel && (
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-2 font-mono">
          {language}
        </div>
      )}
      <code>{children}</code>
    </pre>
  );
}
