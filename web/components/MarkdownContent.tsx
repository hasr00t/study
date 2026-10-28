'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './MermaidDiagram';
import { CodeBlock } from './CodeBlock';

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          return (
            <code className="font-mono text-[var(--accent)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-sm" {...props}>
              {children}
            </code>
          );
        },
        pre({ children }) {
          // react-markdown hands <pre> a single <code> element. Read the fence's
          // language and content off it; a fence with no language is still a
          // block and must keep its whitespace.
          const child = Array.isArray(children) ? children[0] : children;
          const props = (child as { props?: { className?: string; children?: unknown } })?.props;
          const className = props?.className ?? '';
          const text = String(props?.children ?? '').replace(/\n$/, '');
          const language = /language-(\w+)/.exec(className)?.[1];

          if (language === 'mermaid') {
            return <MermaidDiagram chart={text} />;
          }
          return <CodeBlock className={className}>{text}</CodeBlock>;
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-4 rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="text-left p-2.5 bg-[var(--surface-2)] font-display text-xs uppercase tracking-wider text-[var(--text-dim)] border-b border-[var(--border)]">
              {children}
            </th>
          );
        },
        td({ children }) {
          return <td className="p-2.5 border-b border-[var(--border)]">{children}</td>;
        },
        strong({ children }) {
          return <strong className="text-[var(--text-bright)] font-semibold">{children}</strong>;
        },
        h3({ children }) {
          return <h3 className="font-display font-semibold text-lg text-[var(--text-bright)] mt-6 mb-3">{children}</h3>;
        },
        p({ children }) {
          return <p className="mb-3.5 leading-relaxed">{children}</p>;
        },
        ul({ children }) {
          return <ul className="pl-5 mb-3.5 space-y-1.5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="pl-5 mb-3.5 space-y-1.5 list-decimal">{children}</ol>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-[3px] border-[var(--accent)] bg-[var(--accent-dim)] px-4 py-3 rounded-r-md my-4 text-[15px]">
              {children}
            </blockquote>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
