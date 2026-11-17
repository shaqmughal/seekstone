import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_ID,
  defaultCacheDir,
  fetchCommandFor,
  resolveModelId,
  resolveSemanticConfig,
  resolveWeights,
} from './config.js';

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
    expect(cfg?.modelId).toBe(DEFAULT_MODEL_ID);
  });

  it('selects the opt-in model via SEEKSTONE_SEMANTIC_MODEL and derives its dir', () => {
    const cfg = resolveSemanticConfig(
      { SEEKSTONE_SEMANTIC: '1', SEEKSTONE_SEMANTIC_MODEL: 'potion-retrieval-32M' },
      '/home/u',
    );
    expect(cfg?.modelId).toBe('potion-retrieval-32M');
    expect(cfg?.modelDir).toBe(
      join('/home/u', '.cache', 'seekstone', 'models', 'potion-retrieval-32M'),
    );
    // A blank value means "default", not an error.
    expect(resolveModelId('  ')).toBe(DEFAULT_MODEL_ID);
    expect(resolveModelId(undefined)).toBe(DEFAULT_MODEL_ID);
  });

  it('rejects an unknown SEEKSTONE_SEMANTIC_MODEL with the accepted values', () => {
    expect(() =>
      resolveSemanticConfig({ SEEKSTONE_SEMANTIC: '1', SEEKSTONE_SEMANTIC_MODEL: 'gpt-9' }, '/h'),
    ).toThrow(/unknown model "gpt-9".*potion-base-8M.*potion-retrieval-32M/);
    // Not consulted at all while the feature is off.
    expect(resolveSemanticConfig({ SEEKSTONE_SEMANTIC_MODEL: 'gpt-9' }, '/h')).toBeUndefined();
  });

  it('defaults SEEKSTONE_SEMANTIC_WEIGHTS to int8 and accepts f32 (SHA-548)', () => {
    expect(resolveSemanticConfig({ SEEKSTONE_SEMANTIC: '1' }, '/h')?.weights).toBe('int8');
    expect(
      resolveSemanticConfig({ SEEKSTONE_SEMANTIC: '1', SEEKSTONE_SEMANTIC_WEIGHTS: 'f32' }, '/h')
        ?.weights,
    ).toBe('f32');
    expect(resolveWeights(' int8 ')).toBe('int8');
    expect(resolveWeights('')).toBe('int8');
  });

  it('rejects an unknown SEEKSTONE_SEMANTIC_WEIGHTS naming int8 and f32', () => {
    expect(() =>
      resolveSemanticConfig({ SEEKSTONE_SEMANTIC: '1', SEEKSTONE_SEMANTIC_WEIGHTS: 'bogus' }, '/h'),
    ).toThrow(/SEEKSTONE_SEMANTIC_WEIGHTS: unknown value "bogus".*int8, f32/);
  });

  it('names the exact fetch command for each model', () => {
    expect(fetchCommandFor(DEFAULT_MODEL_ID)).toBe('npx -y seekstone fetch-model');
    expect(fetchCommandFor('potion-retrieval-32M')).toBe(
      'npx -y seekstone fetch-model --model potion-retrieval-32M',
    );
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
