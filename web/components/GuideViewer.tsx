'use client';

import { useEffect } from 'react';
import { MarkdownContent } from './MarkdownContent';
import { InlineMarkdown } from './InlineMarkdown';
import { Quiz } from './Quiz';
import { useDesk } from './DeskShell';
import { useProgress } from '@/lib/progress';
import type { GuideData } from '@/lib/load-guides';

export function GuideViewer({ guide }: { guide: GuideData }) {
  // Section state lives in the shell so the rail can drive it — this pane reads
  // it rather than owning it.
  const { current, setCurrent, onQuiz, setOnQuiz } = useDesk();
  const { record } = useProgress();

  const hasQuiz = guide.quiz && guide.quiz.length > 0;
  const totalPages = guide.sections.length + (hasQuiz ? 1 : 0);
  const isQuizPage = hasQuiz && onQuiz;
  const section = isQuizPage ? null : guide.sections[Math.min(current, guide.sections.length - 1)];
  const pageNumber = isQuizPage ? guide.sections.length : Math.min(current, guide.sections.length - 1);
  const progress = ((pageNumber + 1) / totalPages) * 100;

  // Reset to the top of a guide when the reader switches to a different one.
  useEffect(() => {
    setCurrent(0);
    setOnQuiz(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.slug]);

  useEffect(() => {
    record(guide.slug, pageNumber);
  }, [guide.slug, pageNumber, record]);

  function goTo(page: number) {
    if (page < 0 || page >= totalPages) return;
    if (hasQuiz && page === guide.sections.length) {
      setOnQuiz(true);
      setCurrent(page);
    } else {
      setOnQuiz(false);
      setCurrent(page);
    }
    window.scrollTo(0, 0);
  }

  // Definitions render as cards, so drop the source markdown table from the
  // prose — the same terms would otherwise appear twice.
  const prose =
    section && section.type === 'definitions' && section.definitions?.length
      ? section.content?.split('\n').filter(l => !l.trim().startsWith('|')).join('\n').trim()
      : section?.content;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-[3px] bg-[var(--border)] shrink-0">
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className="flex-1 px-6 sm:px-8 lg:px-14 py-11">
        <div className="w-full max-w-[54rem] mx-auto">
          <div className="font-display text-[9.5px] tracking-[0.18em] uppercase text-[var(--accent)] mb-3">
            {isQuizPage ? 'Reinforcement' : `Section ${String(pageNumber + 1).padStart(2, '0')}`}
          </div>
          <h1 className="font-display font-bold text-[31px] leading-[1.14] tracking-[-0.022em] text-[var(--text-bright)] mb-6 text-pretty">
            {isQuizPage ? 'Quiz' : section ? <InlineMarkdown text={section.title} /> : null}
          </h1>

          {isQuizPage && (
            <Quiz
              questions={guide.quiz}
              slug={guide.slug}
              sectionOrder={guide.sections.map(s => s.id)}
              onRevisit={sectionId => {
                const i = guide.sections.findIndex(s => s.id === sectionId);
                if (i === -1) return;
                setOnQuiz(false);
                setCurrent(i);
                window.scrollTo(0, 0);
              }}
            />
          )}

          {!isQuizPage && section?.type === 'definitions' && section.definitions && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {section.definitions.map(d => (
                <div
                  key={d.term}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4"
                >
                  <h4 className="font-display font-semibold text-[var(--text-bright)] text-sm mb-1">
                    <InlineMarkdown text={d.term} />
                  </h4>
                  <p className="text-[13.5px] text-[var(--text)] leading-snug">
                    <InlineMarkdown text={d.definition} />
                  </p>
                </div>
              ))}
            </div>
          )}

          {!isQuizPage && section?.type === 'priming' && (
            <p className="font-display text-[12.5px] leading-relaxed text-[var(--text-dim)] border-l-2 border-[var(--accent)] pl-4 mb-6">
              Read this before the rest of the guide. The questions below are meant to be
              mostly unanswerable right now — attempting them is what makes the material
              stick when you meet it.
            </p>
          )}

          {!isQuizPage && prose && (
            <div
              className={
                section?.type === 'implementation' || section?.type === 'rules'
                  ? 'bg-[var(--surface)] border border-[var(--border)] rounded-[3px] px-6 py-5'
                  : undefined
              }
            >
              <MarkdownContent content={prose} />
            </div>
          )}
        </div>
      </main>

      <div className="border-t border-[var(--border)] px-6 sm:px-8 lg:px-14 py-3.5 shrink-0">
        <div className="w-full max-w-[54rem] mx-auto flex items-center justify-between gap-4">
        <button
          onClick={() => goTo(pageNumber - 1)}
          disabled={pageNumber === 0}
          className="font-display text-[13px] text-[var(--text-dim)] hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:text-[var(--text-dim)] transition-colors text-left min-w-0 truncate"
        >
          &larr;&nbsp; {pageNumber === 0 ? 'Start' : <InlineMarkdown text={guide.sections[pageNumber - 1]?.title ?? 'Back'} />}
        </button>
        <span className="font-display text-[12px] text-[var(--text-dim)] whitespace-nowrap">
          {pageNumber + 1} / {totalPages}
        </span>
        <button
          onClick={() => goTo(pageNumber + 1)}
          disabled={pageNumber === totalPages - 1}
          className="font-display text-[13px] font-medium text-[var(--text-bright)] hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:text-[var(--text-bright)] transition-colors text-right min-w-0 truncate"
        >
          {pageNumber + 1 === guide.sections.length && hasQuiz
            ? 'Quiz'
            : <InlineMarkdown text={guide.sections[pageNumber + 1]?.title ?? 'End'} />}
          &nbsp;&rarr;
        </button>
        </div>
      </div>
    </div>
  );
}
