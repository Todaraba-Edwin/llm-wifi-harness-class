import Markdown from '@/components/Markdown';
import { indexBody } from '@/lib/data';

export default function Home() {
  return <Markdown>{indexBody}</Markdown>;
}
