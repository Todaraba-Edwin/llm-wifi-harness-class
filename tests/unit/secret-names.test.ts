import { describe, expect, it } from 'vitest';
import { findViolations, secretNames } from '../../scripts/lint-secret-names';
import { REPO, tmpDir, write } from './helpers';

describe('lint-secret-names', () => {
  it('derives names ending in KEY, SECRET or TOKEN from .env.example', () => {
    expect(secretNames(REPO)).toEqual(expect.arrayContaining(['AUTH_SECRET', 'OPENAI_API_KEY', 'GH_WRITEBACK_TOKEN']));
    expect(secretNames(REPO)).not.toContain('QA_DAILY_CAP');
  });
  it('flags a name outside the allowlist (negative control) and accepts the allowlisted readers', () => {
    const root = tmpDir();
    write(root, 'src/lib/env.server.ts', 'AUTH_SECRET');
    write(root, 'src/components/Leak.tsx', 'const k = "AUTH_SECRET";');
    write(root, 'public/x.js', 'OPENAI_API_KEY');
    expect(findViolations(root, ['AUTH_SECRET', 'OPENAI_API_KEY'])).toEqual(['public/x.js', 'src/components/Leak.tsx']);
  });
  it('the real tree has no violation', () => {
    expect(findViolations(REPO, secretNames(REPO))).toEqual([]);
  });
});
