import { z } from 'zod';

export const QUESTION_MAX = 1000;

const CiteSchema = z.strictObject({ slug: z.string(), quote: z.string() });
const SentenceSchema = z.strictObject({ text: z.string(), cites: z.array(CiteSchema) });

/** Structural shape only; length and content rules live in validate.ts. */
export const AnswerSchema = z.strictObject({
  answerable: z.boolean(),
  title_en: z.string(),
  title_ko: z.string(),
  summary: z.string(),
  sentences: z.array(SentenceSchema),
  notCovered: z.array(z.string()),
});

export type Answer = z.infer<typeof AnswerSchema>;

/** OpenAI strict `text.format` json_schema body (name: 'wiki_answer'). */
export const answerJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['answerable', 'title_en', 'title_ko', 'summary', 'sentences', 'notCovered'],
  properties: {
    answerable: { type: 'boolean' },
    title_en: { type: 'string' },
    title_ko: { type: 'string' },
    summary: { type: 'string' },
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'cites'],
        properties: {
          text: { type: 'string' },
          cites: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['slug', 'quote'],
              properties: { slug: { type: 'string' }, quote: { type: 'string' } },
            },
          },
        },
      },
    },
    notCovered: { type: 'array', items: { type: 'string' } },
  },
} as const;
