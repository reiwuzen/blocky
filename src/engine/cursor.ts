import type { Node, AnyBlock } from '../types/block';
import type { NodeSelection } from './format';
import { Result } from '@reiwuzen/result';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CursorPosition = {
  nodeIndex: number;
  offset: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getTextLength(node: Node): number {
  if (node.type === "text" || node.type === "code") return node.text.length;
  if (node.type === "equation") return node.latex.length;
  return 0;
}

// ─── flatToPosition ────────────────────────────────────────────────────────────

/**
 * Convert a flat UI cursor offset to { nodeIndex, offset }.
 *
 * The browser gives a single number representing position in the
 * concatenated text of the block. This function walks the node array
 * and finds which node that position falls in and where within it.
 *
 * e.g. nodes = ["Hello"(5), " World"(6)]
 *   flatOffset=0  → { nodeIndex: 0, offset: 0 }
 *   flatOffset=5  → { nodeIndex: 0, offset: 5 }  (end of first node)
 *   flatOffset=6  → { nodeIndex: 1, offset: 1 }
 *   flatOffset=11 → { nodeIndex: 1, offset: 6 }  (end of last node)
 */
export function flatToPosition(
  block: AnyBlock,
  flatOffset: number
): Result<CursorPosition, string> {
  // code/equation blocks are always a single node — offset maps directly
  if (block.type === "code" || block.type === "equation") {
    const node = block.content[0] as Node;
    const len  = getTextLength(node);
    if (flatOffset < 0 || flatOffset > len)
      return Result.Err(`flatOffset (${flatOffset}) out of bounds (length=${len})`);
    return Result.Ok({ nodeIndex: 0, offset: flatOffset });
  }

  const nodes = block.content as Node[];

  if (flatOffset < 0)
    return Result.Err(`flatOffset (${flatOffset}) cannot be negative`);

  let accumulated = 0;

  for (let i = 0; i < nodes.length; i++) {
    const len = getTextLength(nodes[i]);

    // offset lands within this node OR at its end (but not the last node)
    if (flatOffset <= accumulated + len) {
      return Result.Ok({ nodeIndex: i, offset: flatOffset - accumulated });
    }

    accumulated += len;
  }

  // flatOffset is exactly at the end of the last node
  if (flatOffset === accumulated) {
    const last = nodes.length - 1;
    return Result.Ok({ nodeIndex: Math.max(0, last), offset: getTextLength(nodes[last]) });
  }

  return Result.Err(
    `flatOffset (${flatOffset}) out of bounds (total length=${accumulated})`
  );
}

// ─── flatToSelection ───────────────────────────────────────────────────────────

/**
 * Convert a flat UI selection { start, end } to NodeSelection.
 *
 * The browser gives two flat offsets from window.getSelection().
 * This calls flatToPosition twice and returns a NodeSelection
 * ready to pass to toggleBold, formatNodes, deleteRange, etc.
 *
 * e.g. nodes = ["Hello"(bold), " World"]
 *   { start: 3, end: 8 } → { startIndex:0, startOffset:3, endIndex:1, endOffset:3 }
 */
export function flatToSelection(
  block: AnyBlock,
  start: number,
  end: number
): Result<NodeSelection, string> {
  if (start > end)
    return Result.Err(`start (${start}) cannot be greater than end (${end})`);

  return flatToPosition(block, start).andThen((startPos) =>
    flatToPosition(block, end).map((endPos) => ({
      startIndex:  startPos.nodeIndex,
      startOffset: startPos.offset,
      endIndex:    endPos.nodeIndex,
      endOffset:   endPos.offset,
    }))
  );
}

// ─── positionToFlat ────────────────────────────────────────────────────────────

/**
 * Inverse — convert { nodeIndex, offset } back to a flat offset.
 * Useful after engine operations to restore cursor position in the DOM.
 */
export function positionToFlat(
  block: AnyBlock,
  nodeIndex: number,
  offset: number
): Result<number, string> {
  if (block.type === "code" || block.type === "equation")
    return Result.Ok(offset);

  const nodes = block.content as Node[];

  if (nodeIndex < 0 || nodeIndex >= nodes.length)
    return Result.Err(`nodeIndex (${nodeIndex}) out of bounds`);

  let flat = 0;
  for (let i = 0; i < nodeIndex; i++) {
    flat += getTextLength(nodes[i]);
  }

  return Result.Ok(flat + offset);
}