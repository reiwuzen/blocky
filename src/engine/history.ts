import type { AnyBlock } from '../types/block';
import { Result } from '@reiwuzen/result';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type HistoryEntry = {
  blocks: AnyBlock[];
  timestamp: number;
};

export type History = {
  past:    HistoryEntry[];
  present: HistoryEntry;
  future:  HistoryEntry[];
};

// ─── createHistory ─────────────────────────────────────────────────────────────

/**
 * Create a new history instance with the given initial blocks.
 */
export function createHistory(initialBlocks: AnyBlock[]): History {
  return {
    past:    [],
    present: { blocks: initialBlocks, timestamp: Date.now() },
    future:  [],
  };
}

// ─── push ──────────────────────────────────────────────────────────────────────

/**
 * Push a new state onto the history stack.
 * Clears the future — same as any editor after a new action post-undo.
 * Optionally cap the max history size to avoid unbounded memory growth.
 */
export function push(
  history: History,
  blocks: AnyBlock[],
  maxSize: number = 100
): History {
  const past = [...history.past, history.present].slice(-maxSize);
  return {
    past,
    present: { blocks, timestamp: Date.now() },
    future:  [],
  };
}

// ─── undo ──────────────────────────────────────────────────────────────────────

/**
 * Move back one step in history.
 * Returns Err if there is nothing to undo.
 */
export function undo(history: History): Result<History, string> {
  if (history.past.length === 0)
    return Result.Err("Nothing to undo");

  const previous = history.past[history.past.length - 1];

  return Result.Ok({
    past:    history.past.slice(0, -1),
    present: previous,
    future:  [history.present, ...history.future],
  });
}

// ─── redo ──────────────────────────────────────────────────────────────────────

/**
 * Move forward one step in history.
 * Returns Err if there is nothing to redo.
 */
export function redo(history: History): Result<History, string> {
  if (history.future.length === 0)
    return Result.Err("Nothing to redo");

  const next = history.future[0];

  return Result.Ok({
    past:    [...history.past, history.present],
    present: next,
    future:  history.future.slice(1),
  });
}

// ─── canUndo / canRedo ─────────────────────────────────────────────────────────

export const canUndo = (history: History): boolean => history.past.length > 0;
export const canRedo = (history: History): boolean => history.future.length > 0;

// ─── currentBlocks ─────────────────────────────────────────────────────────────

export const currentBlocks = (history: History): AnyBlock[] => history.present.blocks;