import matter from 'gray-matter';
import { z } from 'zod';
import { RAW_PATH_RE } from './raw-frontmatter';

export const PAGE_TYPES = ['source', 'concept', 'entity', 'synthesis'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

const dateString = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
);

export const FrontmatterSchema = z
  .object({
    title: z.string().min(1),
    // Optional bilingual display pair for the sidebar; both halves or neither.
    title_en: z.string().min(1).optional(),
    title_ko: z.string().min(1).optional(),
    type: z.enum(PAGE_TYPES),
    tags: z.array(z.string()),
    sources: z.array(z.string().regex(RAW_PATH_RE)),
    updated: dateString,
  })
  .refine((v) => (v.title_en === undefined) === (v.title_ko === undefined), {
    message: 'title_en 과 title_ko 는 쌍으로만 허용됨',
    path: ['title_en'],
  });
export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export type ParsedPage =
  | { ok: true; data: Frontmatter; body: string }
  | { ok: false; error: string };

export function parsePage(text: string): ParsedPage {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(text);
  } catch (e) {
    return { ok: false, error: `YAML 파싱 오류: ${(e as Error).message.split('\n')[0]}` };
  }
  const r = FrontmatterSchema.safeParse(parsed.data);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    return { ok: false, error: `frontmatter 검증 실패: ${msg}` };
  }
  return { ok: true, data: r.data, body: parsed.content };
}

export function stripFrontmatter(text: string): string {
  try {
    return matter(text).content;
  } catch {
    return text;
  }
}
