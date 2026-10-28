import fs from 'fs';
import path from 'path';

export interface GuideMetadata {
  title: string;
  slug: string;
  role: string;
  goal: string;
  createdAt: string;
  sectionCount: number;
  quizCount: number;
  /** Section titles only — the rail expands the current guide without loading it. */
  sections: Array<{ id: string; title: string }>;
}

export interface GuideData {
  title: string;
  slug: string;
  role: string;
  goal: string;
  createdAt: string;
  sections: Array<{
    id: string;
    title: string;
    type: string;
    content?: string;
    definitions?: Array<{ term: string; definition: string }>;
  }>;
  misconceptions: string[];
  quiz: Array<{
    tier: string;
    question: string;
    options: string[];
    answer: number;
    explanation: string;
    /** The section to revisit when this question is missed, when one is named. */
    section?: { id: string; title: string } | null;
  }>;
  sources: string[];
  factCheckNotes: string[];
}

const guidesDir = path.join(process.cwd(), 'public', 'guides');

export function listGuides(): GuideMetadata[] {
  if (!fs.existsSync(guidesDir)) return [];
  const files = fs.readdirSync(guidesDir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(guidesDir, f), 'utf-8'));
    return {
      title: data.title,
      slug: data.slug,
      role: data.role,
      goal: data.goal,
      createdAt: data.createdAt,
      sectionCount: data.sections?.length || 0,
      quizCount: data.quiz?.length || 0,
      sections: (data.sections || []).map((s: { id: string; title: string }) => ({
        id: s.id,
        title: s.title,
      })),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadGuide(slug: string): GuideData | null {
  const filePath = path.join(guidesDir, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(guidesDir)) return [];
  return fs.readdirSync(guidesDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}
