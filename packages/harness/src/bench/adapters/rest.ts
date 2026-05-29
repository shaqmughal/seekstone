import { Agent, fetch } from 'undici';
import type { Backend, BackendResponse, ListEntry, SearchHit } from '../backend.js';

/**
 * Adapter for the **Obsidian Local REST API** community plugin.
 *
 * The plugin exposes:
 *   - HTTPS on 27124 with a self-signed cert (default-on)
 *   - HTTP  on 27123 (opt-in)
 *   - Bearer-token auth via the API key shown in the plugin's settings tab
 *
 * Endpoints used:
 *   GET    /vault/                — list vault root
 *   GET    /vault/{path}          — list dir or read note
 *   PUT    /vault/{path}          — replace file contents (raw bytes)
 *   POST   /search/simple/?query= — full-text search, returns hits as JSON
 *
 * Self-signed cert handling: we accept it explicitly via undici Agent —
 * NEVER use NODE_TLS_REJECT_UNAUTHORIZED=0, that would leak to every other
 * connection in the process.
 */
export interface RestAdapterOptions {
  /** Full base URL incl. scheme, host, port. e.g. https://127.0.0.1:27124 */
  baseUrl: string;
  /** Bearer token from the plugin's settings. */
  apiKey: string;
  /**
   * Allow self-signed certs (default true since the plugin ships a self-signed
   * cert by default). Set false if you front it with a real cert.
   */
  allowInsecureTls?: boolean;
}

export class RestAdapter implements Backend {
  readonly name = 'rest';
  readonly description = 'Obsidian Local REST API plugin (HTTP round-trip)';

  private readonly base: string;
  private readonly agent: Agent;
  private readonly apiKey: string;

  constructor(opts: RestAdapterOptions) {
    this.base = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.agent = new Agent({
      connect: { rejectUnauthorized: opts.allowInsecureTls === false },
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 60_000,
    });
  }

  async close(): Promise<void> {
    await this.agent.close();
  }

  async search(query: string): Promise<BackendResponse<SearchHit[]>> {
    const url = `${this.base}/search/simple/?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      dispatcher: this.agent,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`search ${query} → ${res.status}: ${text.slice(0, 200)}`);
    const raw = JSON.parse(text) as Array<{ filename?: string; score?: number; matches?: unknown }>;
    const result: SearchHit[] = raw.map((h) => ({
      path: h.filename ?? '',
      score: typeof h.score === 'number' ? h.score : undefined,
      snippet: h.matches ? JSON.stringify(h.matches).slice(0, 200) : undefined,
    }));
    return { result, payloadBytes: Buffer.byteLength(text, 'utf8') };
  }

  async read(path: string): Promise<BackendResponse<string>> {
    const url = `${this.base}/vault/${encodePath(path)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { ...this.headers(), Accept: 'text/markdown' },
      dispatcher: this.agent,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`read ${path} → ${res.status}: ${text.slice(0, 200)}`);
    return { result: text, payloadBytes: Buffer.byteLength(text, 'utf8') };
  }

  async write(path: string, content: string): Promise<BackendResponse<void>> {
    const url = `${this.base}/vault/${encodePath(path)}`;
    const body = Buffer.from(content, 'utf8');
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'text/markdown' },
      body,
      dispatcher: this.agent,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`write ${path} → ${res.status}: ${text.slice(0, 200)}`);
    }
    return { result: undefined, payloadBytes: body.byteLength };
  }

  async list(path = ''): Promise<BackendResponse<ListEntry[]>> {
    const url = `${this.base}/vault/${path ? `${encodePath(path)}/` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
      dispatcher: this.agent,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`list ${path} → ${res.status}: ${text.slice(0, 200)}`);
    // Plugin returns { files: string[] } where directory entries end with `/`.
    const parsed = JSON.parse(text) as { files?: string[] };
    const result: ListEntry[] = (parsed.files ?? []).map((f) => ({
      path: f.replace(/\/$/, ''),
      isDirectory: f.endsWith('/'),
    }));
    return { result, payloadBytes: Buffer.byteLength(text, 'utf8') };
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` };
  }
}

/** Path encoding for the plugin: encode segments but keep slashes. */
function encodePath(p: string): string {
  return p
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
}
