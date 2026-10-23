import { describe, expect, it } from 'vitest';
import { newerVersion, parseLatestVersion } from './update';

describe('parseLatestVersion', () => {
  it('reads the version file CI publishes', () => {
    expect(parseLatestVersion('{"versionCode": 42, "versionName": "1.0.42"}')).toEqual({
      versionCode: 42,
      versionName: '1.0.42',
    });
    expect(parseLatestVersion('{"versionCode": 7}')).toEqual({ versionCode: 7, versionName: '1.0.7' });
  });

  it('ignores missing or malformed files', () => {
    expect(parseLatestVersion('Not Found')).toBeNull();
    expect(parseLatestVersion('null')).toBeNull();
    expect(parseLatestVersion('{"versionCode": "42"}')).toBeNull();
    expect(parseLatestVersion('{"versionCode": 0}')).toBeNull();
  });
});

describe('newerVersion', () => {
  const latest = { versionCode: 10, versionName: '1.0.10' };

  it('offers only a higher version code', () => {
    expect(newerVersion(9, latest)).toBe(latest);
    expect(newerVersion(10, latest)).toBeNull();
    expect(newerVersion(11, latest)).toBeNull();
    expect(newerVersion(9, null)).toBeNull();
  });
});
