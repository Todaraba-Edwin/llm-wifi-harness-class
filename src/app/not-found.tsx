import Link from 'next/link';
import { H1 } from '@/lib/ui';

export default function NotFound() {
  return (
    <div>
      <h1 className={H1}>페이지를 찾을 수 없습니다</h1>
      <p className="mt-2">
        <Link href="/" className="text-primary underline">
          홈으로 돌아가기
        </Link>
      </p>
    </div>
  );
}
