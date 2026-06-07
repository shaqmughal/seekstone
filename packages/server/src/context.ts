import type { LinkType } from '@seekstone/core/extract';
import type MiniSearch from 'minisearch';
import type { IndexedNote } from './index/types.js';

export interface BacklinkRef {
  /** Vault-relative path of the note that contains the link. */
  path: string;
  /** 1-indexed line number of the link in the source note. */
  line: number;
  linkType: LinkType;
}

export interface ServerContext {
  vaultRoot: string;
  index: MiniSearch<IndexedNote>;
  notes: Map<string, IndexedNote>;
  /**
   * Reverse-link index: target vault-relative path → backlink refs pointing to it.
   * Sorted by source path; maintained incrementally by the watcher.
   */
  backlinks: Map<string, BacklinkRef[]>;
}
