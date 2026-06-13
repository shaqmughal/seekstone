import type { Logger } from './log.js';

/**
 * Install a process-level safety net for the long-lived stdio server session.
 *
 * The server's known async paths (dispatch, watcher) already guard themselves,
 * so a stray `unhandledRejection` is unexpected — but crashing the whole MCP
 * session (and discarding the in-memory index, which is expensive to rebuild)
 * is a worse outcome than logging it and staying up. So we log via stderr and
 * keep running. `uncaughtException` is deliberately left to Node's default
 * crash behaviour: continuing after a truly uncaught throw risks corrupt state.
 *
 * Returns a disposer that removes the listener (used by tests to avoid leaking
 * handlers across cases).
 */
export function installProcessGuards(log: Logger): () => void {
  const onUnhandledRejection = (reason: unknown): void => {
    const error = reason instanceof Error ? reason.message : String(reason);
    log.error('unhandled promise rejection (server kept alive)', { error });
  };

  process.on('unhandledRejection', onUnhandledRejection);

  return () => {
    process.off('unhandledRejection', onUnhandledRejection);
  };
}
