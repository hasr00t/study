'use client';

import { useState } from 'react';
import { InlineMarkdown } from './InlineMarkdown';
import { useProgress } from '@/lib/progress';

interface QuizQuestion {
  tier: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  section?: { id: string; title: string } | null;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function Quiz({
  questions,
  slug,
  onRevisit,
  sectionOrder = [],
}: {
  questions: QuizQuestion[];
  slug: string;
  /** Jump the reading pane to a section, so a missed question can be reviewed. */
  onRevisit?: (sectionId: string) => void;
  /** Section ids in reading order, so the review list is ordered to reread. */
  sectionOrder?: string[];
}) {
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>(() =>
    new Array(questions.length).fill(null)
  );
  const [done, setDone] = useState(false);
  const { setNeedsReview } = useProgress();

  if (questions.length === 0) {
    return <p className="text-[var(--text-dim)]">No quiz questions available for this guide.</p>;
  }

  const q = questions[current];
  const isOpenResponse = !q.options || q.options.length === 0;
  const isAnswered = picked[current] !== null;
  const progress = ((current + 1) / questions.length) * 100;

  // Open-response questions are self-assessed: "I knew it" is recorded as
  // correct, so the score means the same thing across both kinds.
  const wasCorrect = (i: number) =>
    picked[i] !== null &&
    (questions[i].options.length === 0 ? picked[i] === 1 : picked[i] === questions[i].answer);

  const score = questions.reduce((n, _, i) => n + (wasCorrect(i) ? 1 : 0), 0);

  function record(choice: number, correct: boolean) {
    if (picked[current] !== null) return;
    setPicked(prev => {
      const next = [...prev];
      next[current] = choice;
      return next;
    });
    setNeedsReview(slug, current, !correct);
  }

  function next() {
    if (current + 1 >= questions.length) setDone(true);
    else setCurrent(c => c + 1);
  }

  function reset() {
    setCurrent(0);
    setPicked(new Array(questions.length).fill(null));
    setDone(false);
    questions.forEach((_, i) => setNeedsReview(slug, i, false));
  }

  if (done) {
    const missed = questions
      .map((question, i) => ({ question, i }))
      .filter(({ i }) => !wasCorrect(i));

    // Group what was missed by the section it came from, so the review is a
    // short list of material rather than a list of questions.
    const bySection = new Map<string, { title: string; count: number }>();
    let unlinked = 0;
    for (const { question } of missed) {
      if (!question.section) {
        unlinked += 1;
        continue;
      }
      const entry = bySection.get(question.section.id);
      if (entry) entry.count += 1;
      else bySection.set(question.section.id, { title: question.section.title, count: 1 });
    }

    const pct = Math.round((score / questions.length) * 100);

    return (
      <div>
        <div className="flex items-baseline gap-3 mb-1">
          <span className="font-display font-bold text-[44px] leading-none text-[var(--text-bright)]">
            {score}
          </span>
          <span className="font-display text-[15px] text-[var(--text-dim)]">
            of {questions.length} correct · {pct}%
          </span>
        </div>
        <p className="text-[15px] text-[var(--text-dim)] mb-7">
          {missed.length === 0
            ? 'Nothing missed. Come back to it in a few days rather than now.'
            : `${missed.length} to review. The material behind each is below.`}
        </p>

        {bySection.size > 0 && (
          <div className="mb-7">
            <div className="font-display text-[9.5px] tracking-[0.16em] uppercase text-[var(--text-dim)] mb-3">
              Review this material
            </div>
            <div className="flex flex-col">
              {[...bySection.entries()]
                .sort((a, b) => {
                  const ai = sectionOrder.indexOf(a[0]);
                  const bi = sectionOrder.indexOf(b[0]);
                  return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
                })
                .map(([id, { title, count }]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onRevisit?.(id)}
                  className="text-left flex items-baseline justify-between gap-4 py-2.5 border-b border-[var(--border)] group"
                >
                  <span className="font-display text-[15px] text-[var(--text-bright)] group-hover:text-[var(--accent)] transition-colors">
                    {title}
                  </span>
                  <span className="font-display text-[12px] text-[var(--text-dim)] whitespace-nowrap">
                    {count} missed
                  </span>
                </button>
              ))}
            </div>
            {unlinked > 0 && (
              <p className="text-[13px] text-[var(--text-dim)] mt-3">
                {unlinked} missed {unlinked === 1 ? 'question is' : 'questions are'} not tied to a
                single section — reread the guide broadly for those.
              </p>
            )}
          </div>
        )}

        {missed.length > 0 && (
          <div className="mb-7">
            <div className="font-display text-[9.5px] tracking-[0.16em] uppercase text-[var(--text-dim)] mb-3">
              What you missed
            </div>
            <div className="flex flex-col gap-4">
              {missed.map(({ question, i }) => (
                <div key={i} className="border-l-2 border-[var(--border)] pl-4">
                  <p className="text-[15px] leading-snug text-[var(--text)] mb-1.5">
                    <InlineMarkdown text={question.question} />
                  </p>
                  {question.options.length > 0 && (
                    <p className="text-[14px] leading-snug text-[var(--defend)] mb-1">
                      {LETTERS[question.answer]}.{' '}
                      <InlineMarkdown text={question.options[question.answer]} />
                    </p>
                  )}
                  {question.explanation && (
                    <p className="text-[13.5px] leading-relaxed text-[var(--text-dim)]">
                      <InlineMarkdown text={question.explanation} />
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={reset}
          className="font-display font-semibold text-sm px-6 py-2.5 rounded-[3px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          Retake quiz
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <span className="font-display text-sm text-[var(--text-dim)] tabular-nums">
          {score} / {questions.length}
        </span>
        <div className="flex-1 h-1.5 bg-[var(--surface-2)] rounded">
          <div
            className="h-full rounded bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="font-display text-[11px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
        {q.tier} — question {current + 1} of {questions.length}
      </div>
      <div className="font-display font-semibold text-xl text-[var(--text-bright)] mb-5 leading-snug">
        <InlineMarkdown text={q.question} />
      </div>

      {isOpenResponse ? (
        <div className="mb-4">
          {!isAnswered ? (
            <>
              <p className="text-sm text-[var(--text-dim)] mb-4 leading-relaxed">
                Open response — answer it out loud or in your notes, then rate yourself.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => record(1, true)}
                  className="font-display font-semibold text-sm px-5 py-2.5 rounded-[3px] border border-[var(--defend)] bg-[var(--defend-dim)] text-[var(--defend)] hover:opacity-80 transition-opacity"
                >
                  I knew it
                </button>
                <button
                  onClick={() => record(0, false)}
                  className="font-display font-semibold text-sm px-5 py-2.5 rounded-[3px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] transition-colors"
                >
                  Needs review
                </button>
              </div>
            </>
          ) : (
            <div
              className={`p-3 rounded-[3px] border text-[15px] ${
                picked[current] === 1
                  ? 'border-[var(--defend)] bg-[var(--defend-dim)] text-[var(--defend)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)]'
              }`}
            >
              {picked[current] === 1 ? 'Marked as known.' : 'Flagged for review.'}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-4">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.answer;
            const isPicked = picked[current] === i;
            let state = 'border-[var(--border)] bg-[var(--surface)]';
            if (isAnswered) {
              if (isCorrect) state = 'border-[var(--defend)] bg-[var(--defend-dim)]';
              else if (isPicked) state = 'border-[var(--accent)] bg-[var(--accent-dim)]';
              else state = 'border-[var(--border)] bg-[var(--surface)] opacity-50';
            }
            return (
              <button
                type="button"
                key={i}
                onClick={() => record(i, isCorrect)}
                disabled={isAnswered}
                className={`
                  w-full text-left p-3 rounded-[3px] border flex items-start gap-2.5 text-[15px] transition-colors
                  ${isAnswered ? 'cursor-default' : 'cursor-pointer hover:border-[var(--text-dim)]'}
                  ${state}
                `}
              >
                <span
                  className={`
                    font-display text-xs font-semibold min-w-[22px] h-[22px] flex items-center justify-center rounded-[2px]
                    ${isAnswered && isCorrect ? 'bg-[var(--defend)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-dim)]'}
                  `}
                >
                  {LETTERS[i]}
                </span>
                <span>
                  <InlineMarkdown text={opt} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isAnswered && q.explanation && (
        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[3px] text-sm mb-4 leading-relaxed">
          <InlineMarkdown text={q.explanation} />
          {q.section && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => onRevisit?.(q.section!.id)}
                className="font-display text-[13px] text-[var(--accent)] hover:text-[var(--accent-deep)] transition-colors"
              >
                Reread {q.section.title} &rarr;
              </button>
            </>
          )}
        </div>
      )}

      {isAnswered && (
        <div className="flex justify-center mt-4">
          <button
            onClick={next}
            className="font-display font-semibold text-sm px-7 py-2.5 rounded-[3px] bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            {current + 1 >= questions.length ? 'See results' : 'Next question'}
          </button>
        </div>
      )}
    </div>
  );
}
