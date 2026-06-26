/**
 * Order-preserving concurrent map with a bounded number of in-flight tasks.
 *
 * Profiling or indexing a large vault opens one file per note. An unbounded
 * `Promise.all` over 10k+ notes opens them all at once and exhausts the OS
 * file-descriptor limit on Windows (`EMFILE`). `mapLimit` caps concurrency
 * while preserving input order in the result.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const workers = Math.max(1, Math.min(limit, items.length));
  let next = 0;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      let i = next++;
      while (i < items.length) {
        results[i] = await fn(items[i] as T, i);
        i = next++;
      }
    }),
  );
  return results;
}
