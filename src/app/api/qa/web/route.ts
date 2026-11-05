import { createWebHandler, defaultWebDeps } from '@/lib/qa/web-handler';

export const maxDuration = 180;
export const dynamic = 'force-dynamic';

export const POST = createWebHandler(defaultWebDeps);
