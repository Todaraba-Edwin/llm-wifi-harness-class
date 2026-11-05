import { createSaveHandler, defaultSaveDeps } from '@/lib/qa/save-handler';

// Next reads these segment options statically, so they are literals here.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const POST = createSaveHandler(defaultSaveDeps);
