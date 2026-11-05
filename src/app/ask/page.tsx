import type { Metadata } from 'next';
import AskClient from '@/components/AskClient';
import { getEnv, invalidQaKeys } from '@/lib/env.server';
import { isDevCapOptOutAllowed } from '@/lib/runtime-mode';

export const metadata: Metadata = { title: '질문' };

// The environment is read per request, never at build time: a build with empty env must not bake in "비활성".
export const dynamic = 'force-dynamic';

export default function AskPage() {
  const env = getEnv();
  if (!env) {
    // Local `next dev` only (same triple check as the cap opt-out): show the page and say which variable names are missing.
    if (isDevCapOptOutAllowed(process.env)) {
      return (
        <div>
          <h1 className="mb-1 font-medium text-[1.75rem] leading-[1.235] break-words sm:text-[2.125rem]">Q&amp;A (로컬 개발)</h1>
          <p className="mb-3 text-sm text-fg-2">로컬 개발 모드입니다. 아래 환경 변수가 설정되지 않아 로그인과 질문은 아직 동작하지 않습니다(이름만 표시).</p>
          <ul data-testid="missing-env" className="list-disc pl-5 text-sm">
            {invalidQaKeys().map((k) => (
              <li key={k}>
                <code>{k}</code>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    return (
      <div>
        <h1 className="mb-1 font-medium text-[1.75rem] leading-[1.235] break-words sm:text-[2.125rem]">Q&amp;A 비활성</h1>
        <p className="text-sm text-fg-2">이 배포에는 Q&amp;A가 설정되어 있지 않습니다.</p>
      </div>
    );
  }
  return <AskClient devLocal={env.devLocal} />;
}
