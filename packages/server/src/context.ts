import type MiniSearch from 'minisearch';
import type { IndexedNote } from './index/types.js';

export interface ServerContext {
  vaultRoot: string;
  index: MiniSearch<IndexedNote>;
  notes: Map<string, IndexedNote>;
}
