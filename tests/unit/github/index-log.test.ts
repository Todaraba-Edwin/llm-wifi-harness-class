import { describe, expect, it } from 'vitest';
import { appendLog, insertIndexEntry, oneLine, SaveError, truncate } from '@/lib/github/index-log';
import { INDEX, LOG } from './fake';

describe('insertIndexEntry', () => {
  it('inserts in ascending slug order and leaves every other byte unchanged', () => {
    const out = insertIndexEntry(INDEX, 'beta', '베타');
    expect(out).toBe(INDEX.replace('- [[gamma]]', '- [[beta]]: 베타\n- [[gamma]]'));
  });
  it('goes first when smallest and last (single trailing newline) when greatest', () => {
    expect(insertIndexEntry(INDEX, 'aaa', 's')).toBe(INDEX.replace('- [[alpha]]', '- [[aaa]]: s\n- [[alpha]]'));
    const last = insertIndexEntry(INDEX, 'zzz', 's');
    expect(last).toBe(`${INDEX}- [[zzz]]: s\n`);
    expect(last.endsWith('s\n')).toBe(true);
    expect(last.endsWith('\n\n')).toBe(false);
  });
  it('adds the missing newline when the section ends the file without one', () => {
    expect(insertIndexEntry('## Syntheses\n\n- [[a]]: x', 'b', 's')).toBe('## Syntheses\n\n- [[a]]: x\n- [[b]]: s\n');
  });
  it('stops at the next ## heading and ignores items of other sections', () => {
    const idx = '## Syntheses\n\n- [[a]]: x\n\n## Other\n\n- [[b]]: y\n';
    expect(insertIndexEntry(idx, 'c', 's')).toBe('## Syntheses\n\n- [[a]]: x\n- [[c]]: s\n\n## Other\n\n- [[b]]: y\n');
  });
  it('handles an empty section', () => {
    expect(insertIndexEntry('## Syntheses\n\n## Other\n', 'a', 's')).toBe('## Syntheses\n\n- [[a]]: s\n\n## Other\n');
  });
  it('422 NO_SYNTHESES_SECTION when the heading is absent', () => {
    expect(() => insertIndexEntry('# Index\n\n## Concepts\n', 'a', 's')).toThrowError(SaveError);
    try {
      insertIndexEntry('# Index\n', 'a', 's');
    } catch (e) {
      expect(e).toMatchObject({ status: 422, code: 'NO_SYNTHESES_SECTION' });
    }
  });
});

describe('appendLog', () => {
  it('appends at EOF only and keeps existing bytes', () => {
    const out = appendLog(LOG, '2026-11-05', '질문입니다', 'qa-x');
    expect(out.startsWith(LOG)).toBe(true);
    expect(out.slice(LOG.length)).toBe('\n## [2026-11-05] query | 질문입니다\n- 생성: qa-x\n');
  });
  it('adds a missing trailing newline and flattens a multi-line question to <=120 code points', () => {
    const out = appendLog('# Log', '2026-11-05', `a\n[[b]]\n${'가'.repeat(200)}`, 's');
    expect(out.startsWith('# Log\n\n## [2026-11-05] query | a b ')).toBe(true);
    const heading = out.split('\n')[2].replace('## [2026-11-05] query | ', '');
    expect([...heading].length).toBeLessThanOrEqual(120);
    expect(out).not.toContain('[[');
  });
});

describe('text helpers', () => {
  it('truncate keeps <= max code points, optionally appending an ellipsis beyond it', () => {
    expect(truncate('가나다', 3)).toBe('가나다');
    expect([...truncate('가'.repeat(100), 80)]).toHaveLength(80);
    expect([...truncate('가'.repeat(100), 80, true)]).toHaveLength(81);
    expect(truncate('😀'.repeat(10), 5, true)).toBe(`${'😀'.repeat(5)}…`);
  });
  it('oneLine strips wikilink brackets and newlines', () => {
    expect(oneLine(' a\r\n b [[c]] \u2028d ')).toBe('a b c d');
  });
});
