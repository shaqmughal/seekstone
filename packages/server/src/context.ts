import type { LinkType } from '@seekstone/core/extract';
import type MiniSearch from 'minisearch';
import type { IndexedNote } from './index/types.js';
import type { Journal } from './journal.js';
import type { WritePolicy } from './policy.js';
import type { Semantic } from './semantic/state.js';

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
  /** Read-only / write-path-scoping policy, parsed from env at boot. */
  policy: WritePolicy;
  /**
   * Live semantic index — present only when SEEKSTONE_SEMANTIC=1 and the
   * local embedding model loaded at boot. Fed by the watcher; consumed by
   * search's semantic/hybrid modes.
   */
  semantic?: Semantic;
  /**
   * Write journal (pre-image store behind list_writes / undo_write). Absent
   * when SEEKSTONE_HISTORY=0 or in contexts built without one; write tools
   * journal through `journalWrite` / `journal.begin` and skip when absent.
   */
  journal?: Journal;
}
