import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_ID, defaultCacheDir, resolveSemanticConfig } from './config.js';

describe('resolveSemanticConfig', () => {
  it('is disabled unless SEEKSTONE_SEMANTIC=1', () => {
    expect(resolveSemanticConfig({}, '/home/u')).toBeUndefined();
    expect(resolveSemanticConfig({ SEEKSTONE_SEMANTIC: '0' }, '/home/u')).toBeUndefined();
    expect(resolveSemanticConfig({ SEEKSTONE_SEMANTIC: 'true' }, '/home/u')).toBeUndefined();
  });

  it('defaults the model dir under the cache dir', () => {
    const cfg = resolveSemanticConfig({ SEEKSTONE_SEMANTIC: '1' }, '/home/u');
    expect(cfg?.cacheDir).toBe(join('/home/u', '.cache', 'seekstone'));
    expect(cfg?.modelDir).toBe(join('/home/u', '.cache', 'seekstone', 'models', DEFAULT_MODEL_ID));
  });

  it('honors SEEKSTONE_MODEL_PATH and SEEKSTONE_CACHE_DIR overrides', () => {
    const cfg = resolveSemanticConfig(
      { SEEKSTONE_SEMANTIC: '1', SEEKSTONE_MODEL_PATH: '/models/m', SEEKSTONE_CACHE_DIR: '/c' },
      '/home/u',
    );
    expect(cfg?.modelDir).toBe('/models/m');
    expect(cfg?.cacheDir).toBe('/c');
    expect(defaultCacheDir({ SEEKSTONE_CACHE_DIR: '/c' }, '/home/u')).toBe('/c');
  });
});
