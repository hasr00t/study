'use client';

import { Fragment } from 'react';

// Definition terms, definition bodies and quiz questions are lifted verbatim out
// of the guide markdown, so they carry inline `code` and **bold** markup. They
// are rendered as plain strings (not through ReactMarkdown, which would wrap
// them in block elements), so that markup has to be handled here or it leaks
// onto the page as literal asterisks and backticks.
export function InlineMarkdown({ text }: { text: string }) {
  // Order matters: ** must be tried before * or bold splits into two italics.
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return (
    <>
      {tokens.map((token, i) => {
        if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
          return (
            <code
              key={i}
              className="font-mono text-[0.9em] text-[var(--accent)] bg-[var(--surface-2)] px-1 py-0.5 rounded"
            >
              {token.slice(1, -1)}
            </code>
          );
        }
        if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
          return (
            <strong key={i} className="font-semibold text-[var(--text-bright)]">
              {token.slice(2, -2)}
            </strong>
          );
        }
        if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
          return <em key={i}>{token.slice(1, -1)}</em>;
        }
        return <Fragment key={i}>{token}</Fragment>;
      })}
    </>
  );
}
