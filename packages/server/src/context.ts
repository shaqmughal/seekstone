import type { LinkType } from '@seekstone/core/extract';
import type MiniSearch from 'minisearch';
import type { AuditLog } from './audit.js';
import type { AttachmentIndex } from './index/resolve.js';
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
   * Goes up by one each time the note index changes: a note added, removed or
   * rewritten, or a backlink ref added or removed. 0 after the boot build.
   * Whole-vault tools (list_tags, vault_stats, get_links' resolve maps) cache
   * by it; see index/generation.ts. Only the index/doc.ts and
   * index/backlinks.ts helpers change the index, and each one bumps.
   */
  generation: number;
  /**
   * Reverse-link index: target vault-relative path → backlink refs pointing to it.
   * Sorted by source path; maintained incrementally by the watcher.
   */
  backlinks: Map<string, BacklinkRef[]>;
  /**
   * Non-note files in the read scope, for resolving embeds such as
   * `![[diagram.png]]`. Built from the boot walk; the watcher adds and removes.
   */
  attachments: AttachmentIndex;
  /**
   * Inbound refs of deleted notes, set aside by removeDoc so they don't count
   * while the note is gone. Every deleted path gets an entry, even with no
   * refs. If the note returns (undo_write, a re-create), upsertDoc drops the
   * entry and re-reads the refs from the linking notes' current text.
   * Created on first delete.
   */
  parkedBacklinks?: Map<string, BacklinkRef[]>;
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
  /**
   * Set when write history is off because part of it is a symlink (SHA-575),
   * so list_writes, undo_write and write results can say why.
   */
  historyOffReason?: string;
  /**
   * Structured audit log (SEEKSTONE_AUDIT_FILE). Dispatch appends one record
   * per write-tool call — ok or refused — after the call completes.
   */
  audit?: AuditLog;
}
