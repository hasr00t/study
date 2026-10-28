'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { GuideMetadata } from '@/lib/load-guides';
import { GuideRail } from './GuideRail';

interface DeskState {
  /** Section index the reading pane is showing, owned here so the rail can drive it. */
  current: number;
  setCurrent: (i: number) => void;
  /** True when the reader is on the quiz, which sits after the last section. */
  onQuiz: boolean;
  setOnQuiz: (v: boolean) => void;
}

const DeskContext = createContext<DeskState | null>(null);

export function useDesk() {
  const ctx = useContext(DeskContext);
  if (!ctx) throw new Error('useDesk must be used inside DeskShell');
  return ctx;
}

export function DeskShell({
  guides,
  children,
}: {
  guides: GuideMetadata[];
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState(0);
  const [onQuiz, setOnQuiz] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const pathname = usePathname();

  const activeSlug = pathname?.startsWith('/guide/') ? pathname.slice('/guide/'.length) : null;

  const value = useMemo(
    () => ({ current, setCurrent, onQuiz, setOnQuiz }),
    [current, onQuiz]
  );

  return (
    <DeskContext.Provider value={value}>
      <div className="flex min-h-screen">
        <GuideRail
          guides={guides}
          activeSlug={activeSlug}
          isOpen={railOpen}
          onClose={() => setRailOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <button
            onClick={() => setRailOpen(true)}
            aria-label="Open guide list"
            className="lg:hidden fixed top-3 left-3 z-30 w-10 h-10 flex items-center justify-center
                       bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] text-xl"
          >
            &#9776;
          </button>
          {children}
        </div>
      </div>
    </DeskContext.Provider>
  );
}
