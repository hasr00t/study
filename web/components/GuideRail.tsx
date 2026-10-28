'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { GuideMetadata } from '@/lib/load-guides';
import { useDesk } from './DeskShell';
import { useProgress } from '@/lib/progress';
import { InlineMarkdown } from './InlineMarkdown';

const railLabel =
  'font-display text-[9.5px] tracking-[0.16em] uppercase text-[var(--text-dim)]';

export function GuideRail({
  guides,
  activeSlug,
  isOpen,
  onClose,
}: {
  guides: GuideMetadata[];
  activeSlug: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const { current, setCurrent, onQuiz, setOnQuiz } = useDesk();
  const { progress } = useProgress();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guides;
    return guides.filter(
      g =>
        g.title.toLowerCase().includes(q) ||
        g.goal.toLowerCase().includes(q) ||
        g.sections.some(s => s.title.toLowerCase().includes(q))
    );
  }, [guides, query]);

  const active = matches.find(g => g.slug === activeSlug) ?? null;
  const inProgress = matches.filter(
    g => g.slug !== activeSlug && progress[g.slug] && progress[g.slug].furthest > 0
  );
  const rest = matches.filter(
    g => g.slug !== activeSlug && !inProgress.includes(g)
  );

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}
      <nav
        className={`
          fixed left-0 top-0 h-full w-[286px] shrink-0 z-50 overflow-y-auto flex flex-col
          lg:sticky lg:top-0 lg:h-screen
          bg-[var(--rail)] border-r border-[var(--rail-border)]
          transition-transform
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:z-auto
        `}
      >
        <div className="px-5 pt-5 pb-3.5">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/"
              onClick={onClose}
              className="font-display font-semibold text-sm text-[var(--text-bright)]"
            >
              Study Guides
            </Link>
            <span className="font-display text-[11px] text-[var(--text-dim)]">
              {guides.length}
            </span>
          </div>
          <label className="flex items-center gap-2 bg-[var(--ground)] border border-[var(--border)] rounded-[3px] px-2.5 py-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[var(--text-dim)] shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4.5-4.5" />
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search all guides"
              className="font-display text-[12.5px] bg-transparent outline-none w-full text-[var(--text)] placeholder:text-[var(--text-dim)]"
            />
          </label>
        </div>

        {active && (
          <>
            <div className={`px-5 pt-1.5 pb-2 ${railLabel}`}>Reading now</div>
            <div className="border-l-[3px] border-[var(--accent)] bg-[var(--ground)] px-5 py-2.5">
              <span className="block font-display font-semibold text-[13px] leading-tight text-[var(--text-bright)] mb-2.5">
                {active.title}
              </span>
              <div className="flex flex-col gap-2">
                {active.sections.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setOnQuiz(false);
                      setCurrent(i);
                      onClose();
                    }}
                    className={`text-left font-display text-[12px] leading-tight transition-colors ${
                      !onQuiz && i === current
                        ? 'text-[var(--accent)] font-medium'
                        : i < current || (progress[active.slug]?.furthest ?? 0) >= i
                          ? 'text-[var(--text-dim)] hover:text-[var(--text)]'
                          : 'text-[var(--text)] hover:text-[var(--accent)]'
                    }`}
                  >
                    <span className="tabular-nums opacity-60 mr-1.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <InlineMarkdown text={s.title} />
                  </button>
                ))}
                {active.quizCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOnQuiz(true);
                      setCurrent(active.sections.length);
                      onClose();
                    }}
                    className={`text-left font-display text-[12px] pt-2 mt-0.5 border-t border-[var(--border)] transition-colors ${
                      onQuiz ? 'text-[var(--accent)] font-medium' : 'text-[var(--text)] hover:text-[var(--accent)]'
                    }`}
                  >
                    Quiz
                    <span className="text-[var(--text-dim)] ml-1.5">
                      {active.quizCount} questions
                    </span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {inProgress.length > 0 && (
          <>
            <div className={`px-5 pt-4 pb-2 ${railLabel}`}>In progress</div>
            <div className="flex flex-col">
              {inProgress.map(g => (
                <RailGuide
                  key={g.slug}
                  guide={g}
                  onClose={onClose}
                  percent={Math.round(
                    ((progress[g.slug].furthest + 1) / Math.max(g.sectionCount, 1)) * 100
                  )}
                />
              ))}
            </div>
          </>
        )}

        {rest.length > 0 && (
          <>
            <div className={`px-5 pt-4 pb-2 ${railLabel}`}>Library</div>
            <div className="flex flex-col pb-6">
              {rest.map(g => (
                <RailGuide key={g.slug} guide={g} onClose={onClose} />
              ))}
            </div>
          </>
        )}

        {matches.length === 0 && (
          <p className="px-5 py-3 text-[13px] text-[var(--text-dim)]">
            Nothing matches &ldquo;{query}&rdquo;.
          </p>
        )}

        <div className="mt-auto border-t border-[var(--rail-border)] px-5 py-3.5">
          <Link
            href="/how-it-works"
            onClick={onClose}
            className="font-display text-[12.5px] text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
          >
            How to make a guide
          </Link>
        </div>
      </nav>
    </>
  );
}

function RailGuide({
  guide,
  onClose,
  percent,
}: {
  guide: GuideMetadata;
  onClose: () => void;
  percent?: number;
}) {
  return (
    <Link
      href={`/guide/${guide.slug}`}
      onClick={onClose}
      className="px-5 py-2 border-l-[3px] border-transparent hover:border-[var(--accent)] hover:bg-[var(--ground)] transition-colors"
    >
      <span className="block font-display text-[13px] leading-tight text-[var(--text)]">
        {guide.title}
      </span>
      {percent !== undefined && (
        <span className="block h-[3px] mt-1.5 bg-[var(--border)] rounded-sm overflow-hidden">
          <span
            className="block h-full bg-[var(--accent)] rounded-sm"
            style={{ width: `${percent}%` }}
          />
        </span>
      )}
    </Link>
  );
}
