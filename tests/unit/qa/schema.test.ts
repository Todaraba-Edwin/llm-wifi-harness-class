import { describe, expect, it } from 'vitest';
import { AnswerSchema, QUESTION_MAX, answerJsonSchema } from '@/lib/qa/schema';
import { validAnswer } from '../../fixtures/qa/answers';

describe('AnswerSchema', () => {
  it('accepts a valid shape and rejects extra keys at every level', () => {
    expect(AnswerSchema.safeParse(validAnswer()).success).toBe(true);
    expect(AnswerSchema.safeParse({ ...validAnswer(), extra: 1 }).success).toBe(false);
    const a = validAnswer();
    a.sentences[0].extra = 1;
    expect(AnswerSchema.safeParse(a).success).toBe(false);
    const b = validAnswer();
    b.sentences[0].cites[0].extra = 1;
    expect(AnswerSchema.safeParse(b).success).toBe(false);
  });
  it('QUESTION_MAX', () => expect(QUESTION_MAX).toBe(1000));
});

describe('answerJsonSchema', () => {
  const walk = (node: unknown, visit: (o: Record<string, unknown>) => void) => {
    if (node && typeof node === 'object') {
      visit(node as Record<string, unknown>);
      for (const v of Object.values(node)) walk(v, visit);
    }
  };
  it('property set matches AnswerSchema keys, all required', () => {
    const keys = Object.keys(AnswerSchema.shape).sort();
    expect(Object.keys(answerJsonSchema.properties).sort()).toEqual(keys);
    expect([...answerJsonSchema.required].sort()).toEqual(keys);
  });
  it('is strict at every object level and uses no unsupported keywords', () => {
    walk(answerJsonSchema, (o) => {
      if (o.type === 'object') {
        expect(o.additionalProperties).toBe(false);
        expect([...(o.required as string[])].sort()).toEqual(Object.keys(o.properties as object).sort());
      }
      for (const k of ['minLength', 'maxLength', 'minItems', 'maxItems', 'pattern', 'format', 'minimum', 'maximum']) {
        expect(k in o).toBe(false);
      }
    });
  });
  it('a valid answer has exactly the schema keys at the top level', () => {
    expect(Object.keys(validAnswer()).sort()).toEqual(Object.keys(answerJsonSchema.properties).sort());
  });
});
