import { get_encoding } from 'tiktoken';
import { type Distribution, summarise } from '../util/percentiles.js';

const enc = get_encoding('cl100k_base');

export interface Timing<T> {
  result: T;
  durationMs: number;
}

/** High-resolution wall-clock timing for a single async call. */
export async function timed<T>(fn: () => Promise<T>): Promise<Timing<T>> {
  const t0 = process.hrtime.bigint();
  const result = await fn();
  const t1 = process.hrtime.bigint();
  return { result, durationMs: Number(t1 - t0) / 1e6 };
}

export interface RunStats {
  /** Cold = the first run, before any caches warm. */
  coldMs: number;
  /** Warm = runs 2..N (the first run is excluded). */
  warm: Distribution;
  /** All runs including cold (for transparency). */
  all: Distribution;
  /** Mean payload bytes across runs. */
  payloadBytesMean: number;
  /** Token count for the mean payload (tiktoken cl100k_base; falls back to bytes÷4 when no payload text is available). */
  payloadTokensMean: number;
  runs: number;
}

/**
 * Run `fn` N times, returning cold / warm / all distributions.
 *
 * - "cold" is the first invocation, which catches index build, TCP handshake,
 *   JIT compile, OS page-cache miss — every kind of one-time tax.
 * - "warm" is runs 2..N; that's what the user actually feels in a session.
 * - We report both so a cheap warm number can't hide a brutal cold start.
 */
export async function runN<T>(
  fn: () => Promise<{ result: T; payloadBytes: number; payloadText?: string }>,
  runs: number,
): Promise<RunStats> {
  const durations: number[] = [];
  const payloads: number[] = [];
  let sampleText: string | undefined;
  for (let i = 0; i < runs; i++) {
    const t = await timed(fn);
    durations.push(t.durationMs);
    payloads.push(t.result.payloadBytes);
    if (sampleText === undefined && t.result.payloadText !== undefined) {
      sampleText = t.result.payloadText;
    }
  }
  const cold = durations[0] ?? 0;
  const warmRuns = durations.slice(1);
  const payloadMean = payloads.reduce((a, b) => a + b, 0) / Math.max(1, payloads.length);
  const payloadTokensMean =
    sampleText !== undefined ? enc.encode(sampleText).length : Math.ceil(payloadMean / 4);
  return {
    coldMs: cold,
    warm: summarise(warmRuns),
    all: summarise(durations),
    payloadBytesMean: payloadMean,
    payloadTokensMean,
    runs,
  };
}
