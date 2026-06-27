export interface IndexedNote {
  /** Vault-relative path. Used as the MiniSearch document ID. */
  id: string;
  /** FM `title` if present, otherwise the filename without extension. */
  title: string;
  /** Note body with frontmatter stripped. */
  body: string;
  /** All tags — both inline (#tag) and frontmatter. */
  tags: string;
  /** Frontmatter keys joined with space — makes keys searchable. */
  fmKeys: string;
  /** Raw full text (FM + body) for excerpt extraction after a hit. */
  raw: string;
  sizeBytes: number;
  mtimeMs: number;
}

export interface SearchHit {
  path: string;
  /** Omitted when it equals the path's basename (recoverable from `path`). */
  title?: string;
  score: number;
  /** Excerpt centred on the best match in the body; length is caller-tunable. */
  excerpt: string;
  /** Omitted when the note has no tags. */
  tags?: string[];
}
