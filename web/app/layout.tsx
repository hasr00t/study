import type { Metadata } from 'next';
import './globals.css';
import { listGuides } from '@/lib/load-guides';
import { DeskShell } from '@/components/DeskShell';

export const metadata: Metadata = {
  title: 'Study Guides',
  description: 'AI-powered study guides with interactive quizzes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The rail is part of every route, so the guide list is loaded once here at
  // build time rather than per page.
  const guides = listGuides();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <DeskShell guides={guides}>{children}</DeskShell>
      </body>
    </html>
  );
}
