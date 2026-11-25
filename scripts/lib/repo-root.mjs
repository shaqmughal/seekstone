// Absolute path to the repo root, as a native path on every OS.
// fileURLToPath turns file:///D:/a/... into D:\a\... on Windows; reading the
// URL's pathname directly would give /D:/a/... and break every path built on it.
// Build paths with path.join(repoRoot, ...); the trailing separator is not part
// of the contract.

import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
