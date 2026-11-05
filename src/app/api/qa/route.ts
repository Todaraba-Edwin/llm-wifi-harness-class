import { createHandler, defaultDeps } from '@/lib/qa/handler';

// Next reads these segment options statically, so they are literals here.
export const maxDuration = 180;
export const dynamic = 'force-dynamic';

export const POST = createHandler(defaultDeps);
