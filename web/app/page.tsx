import { listGuides } from '@/lib/load-guides';
import { DeskHome } from '@/components/DeskHome';

export default function Home() {
  return <DeskHome guides={listGuides()} />;
}
