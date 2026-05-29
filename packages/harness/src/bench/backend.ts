/**
 * The single interface every backend implements. Keep it small on purpose:
 * search / read / write / list is the surface the eventual MCP server will
 * expose, so anything beyond it would be measuring features we don't ship.
 *
 * Each method returns a `BackendResponse<T>` so the harness can record the
 * raw byte size of whatever the backend served — that's the "context tax"
 * metric and the headline of the eventual article.
 */

export interface BackendResponse<T> {
  result: T;
  /** Bytes of the raw response payload as delivered (HTTP body, JSON, file bytes). */
  payloadBytes: number;
  /** Raw response text, used for exact tiktoken counting. Omit for binary payloads. */
  payloadText?: string;
}

export interface SearchHit {
  /** Vault-relative path of the matching note. */
  path: string;
  /** Adapter-specific score, if any. May be undefined. */
  score?: number;
  /** Adapter-specific snippet/match context, if any. */
  snippet?: string;
}

export interface ListEntry {
  path: string;
  isDirectory: boolean;
}

export interface Backend {
  /** Stable, short name used in report tables. e.g. "rest", "fs". */
  readonly name: string;
  /** Human-readable description shown in benchmark.md. */
  readonly description: string;

  search(query: string): Promise<BackendResponse<SearchHit[]>>;
  /**
   * Optional streaming search. Yields hits one-by-one as they become available.
   * The harness uses this to measure time-to-first-result (TTFR) separately from
   * total latency. Backends that return all results at once can yield them in a
   * tight loop — TTFR will equal total search time, but the interface is ready
   * for backends that genuinely stream.
   */
  searchStream?(query: string): AsyncIterable<SearchHit>;
  read(path: string): Promise<BackendResponse<string>>;
  /**
   * Write raw bytes. Must NOT transform frontmatter or body. Returns the
   * byte count of the payload sent, not received — write-safety verification
   * re-reads the file after to confirm byte-equality.
   */
  write(path: string, content: string): Promise<BackendResponse<void>>;
  list(path?: string): Promise<BackendResponse<ListEntry[]>>;

  /** Optional cleanup (close keep-alive connections, etc). */
  close?(): Promise<void>;
}
