'use client';

import Link from 'next/link';
import type { GuideMetadata } from '@/lib/load-guides';
import { useProgress } from '@/lib/progress';

const label = 'font-display text-[9.5px] tracking-[0.16em] uppercase text-[var(--text-dim)]';

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DeskHome({ guides }: { guides: GuideMetadata[] }) {
  const { progress } = useProgress();

  const opened = guides
    .filter(g => progress[g.slug])
    .sort((a, b) => progress[b.slug].openedAt.localeCompare(progress[a.slug].openedAt));

  const continueGuide = opened.find(
    g => progress[g.slug].furthest + 1 < g.sectionCount
  );
  const review = opened.find(g => (progress[g.slug].needsReview?.length ?? 0) > 0);

  const totalQuestions = guides.reduce((n, g) => n + g.quizCount, 0);
  const flagged = guides.reduce(
    (n, g) => n + (progress[g.slug]?.needsReview?.length ?? 0),
    0
  );

  return (
    <main className="flex-1 px-6 sm:px-8 lg:px-14 py-11 lg:py-12">
      <div className="w-full max-w-[54rem] mx-auto">
      <h1 className="font-display font-bold text-[32px] tracking-[-0.022em] text-[var(--text-bright)] mb-2">
        {/* Rendered client-side, so the greeting can use the reader's own clock. */}
        {greeting(new Date().getHours())}
      </h1>
      <p className="text-[15.5px] leading-relaxed text-[var(--text-dim)] mb-9">
        {guides.length === 0
          ? 'No guides yet. Run /learn-topic in Claude Code to research one.'
          : `${guides.length} ${guides.length === 1 ? 'guide' : 'guides'} on the shelf, ${totalQuestions} reinforcement questions.`}
      </p>

      {(continueGuide || review) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px] mb-10">
          {continueGuide && (
            <DeskCard
              kicker="Continue reading"
              kickerAccent
              guide={continueGuide}
              detail={
                continueGuide.sections[progress[continueGuide.slug].furthest + 1]?.title
                  ? `Next up — ${continueGuide.sections[progress[continueGuide.slug].furthest + 1].title}`
                  : 'Pick up where you left off'
              }
              meta={`Section ${progress[continueGuide.slug].furthest + 1} of ${continueGuide.sectionCount}`}
            />
          )}
          {review && (
            <DeskCard
              kicker="Due for review"
              guide={review}
              detail={`${progress[review.slug].needsReview.length} question${
                progress[review.slug].needsReview.length === 1 ? '' : 's'
              } flagged "needs review" last time`}
              meta={`Opened ${new Date(progress[review.slug].openedAt).toLocaleDateString()}`}
            />
          )}
        </div>
      )}

      {guides.length > 0 && (
        <>
          <div className={`${label} mb-4`}>Across the library</div>
          <div className="grid grid-cols-3 gap-8 mb-11 max-w-[520px]">
            <Stat value={guides.length} caption={guides.length === 1 ? 'guide' : 'guides'} />
            <Stat value={totalQuestions} caption="reinforcement questions" />
            <Stat value={flagged} caption="flagged for review" accent={flagged > 0} />
          </div>

          <div className={`${label} mb-4`}>All guides</div>
          <div className="flex flex-col">
            {guides.map(g => (
              <Link
                key={g.slug}
                href={`/guide/${g.slug}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-6 items-baseline py-4 border-b border-[var(--border)] group"
              >
                <span className="min-w-0">
                  <span className="block font-display font-semibold text-[17px] tracking-[-0.01em] text-[var(--text-bright)] group-hover:text-[var(--accent)] transition-colors">
                    {g.title}
                  </span>
                  <span className="block mt-1 text-[13.5px] leading-snug text-[var(--text-dim)]">
                    {g.goal}
                  </span>
                </span>
                <span className="font-display text-[12px] text-[var(--text-dim)] whitespace-nowrap">
                  {g.sectionCount} sections · {g.quizCount} questions
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
      </div>
    </main>
  );
}

function DeskCard({
  kicker,
  kickerAccent,
  guide,
  detail,
  meta,
}: {
  kicker: string;
  kickerAccent?: boolean;
  guide: GuideMetadata;
  detail: string;
  meta: string;
}) {
  return (
    <Link
      href={`/guide/${guide.slug}`}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5 flex flex-col gap-2.5 hover:border-[var(--accent)] transition-colors"
    >
      <span
        className={`font-display text-[9.5px] tracking-[0.16em] uppercase ${
          kickerAccent ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'
        }`}
      >
        {kicker}
      </span>
      <span className="font-display font-semibold text-[17px] leading-tight text-[var(--text-bright)]">
        {guide.title}
      </span>
      <span className="text-[13.5px] leading-snug text-[var(--text-dim)]">{detail}</span>
      <span className="font-display text-[11.5px] text-[var(--text-dim)] mt-0.5">{meta}</span>
    </Link>
  );
}

function Stat({ value, caption, accent }: { value: number; caption: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`font-display font-bold text-[30px] tracking-[-0.02em] ${
          accent ? 'text-[var(--accent)]' : 'text-[var(--text-bright)]'
        }`}
      >
        {value}
      </span>
      <span className="text-[13px] text-[var(--text-dim)] leading-snug">{caption}</span>
    </div>
  );
}
