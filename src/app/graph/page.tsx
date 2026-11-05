import type { Metadata } from 'next';
import GraphView from '@/components/GraphView';
import { graph } from '@/lib/data';

export const metadata: Metadata = { title: '그래프' };

export default function GraphPage() {
  return (
    <div>
      <h1 className="mb-1 font-medium text-[1.75rem] leading-[1.235] break-words sm:text-[2.125rem]">문서 그래프</h1>
      <p className="mb-4 text-sm text-fg-2">
        문서 {graph.nodes.length}개, 연결 {graph.edges.length}개. index 에 링크된 모든 문서가 노드로 표시됩니다.
      </p>
      <GraphView data={graph} />
    </div>
  );
}
