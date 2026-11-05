import { describe, expect, it } from 'vitest';
import { DEFAULT_DEV_ORIGINS, devOrigins, normalizeDevOrigins } from '../../next.config';

describe('allowedDevOrigins', () => {
  it('defaults to the private LAN ranges', () => {
    expect(devOrigins({})).toEqual(DEFAULT_DEV_ORIGINS);
    expect(devOrigins({ DEV_ALLOWED_ORIGINS: '  ' })).toEqual(DEFAULT_DEV_ORIGINS);
    expect(DEFAULT_DEV_ORIGINS).toEqual(['192.168.*.*', '10.*.*.*']);
  });

  it('normalizes URLs, ports and paths to hostnames', () => {
    expect(normalizeDevOrigins('http://192.168.0.52:3000/search, 10.0.0.*,laptop.local')).toEqual(['192.168.0.52', '10.0.0.*', 'laptop.local']);
  });

  it('rejects entries that cannot be parsed instead of silently dropping them', () => {
    expect(() => normalizeDevOrigins('192.168.0.1,not a host')).toThrow(/DEV_ALLOWED_ORIGINS/);
    expect(() => normalizeDevOrigins('http://')).toThrow(/DEV_ALLOWED_ORIGINS/);
  });

  it('uses the environment override when present', () => {
    expect(devOrigins({ DEV_ALLOWED_ORIGINS: '172.16.*.*' })).toEqual(['172.16.*.*']);
  });
});
