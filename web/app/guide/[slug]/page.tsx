import { loadGuide, getAllSlugs } from '@/lib/load-guides';
import { GuideViewer } from '@/components/GuideViewer';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  const slugs = getAllSlugs();
  // Static export refuses a dynamic route with no params, so a fresh install
  // with no guides yet gets one placeholder that renders as a 404.
  if (slugs.length === 0) return [{ slug: '_empty' }];
  return slugs.map(slug => ({ slug }));
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = loadGuide(slug);
  if (!guide) notFound();

  return <GuideViewer guide={guide} />;
}
