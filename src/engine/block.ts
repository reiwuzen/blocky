import type { AnyBlock, Block, BlockType, Node } from "../types/block";
import { Result } from "@reiwuzen/result";
import {
  insertAt,
  deleteLastChar,
  deleteRange,
  replaceRange,
  splitBlock,
  mergeBlocks,
} from "./content";

/**─── Wrappers ──────────────────────────────────────────────────────────────────
* Each function runs the content engine operation and returns Result<AnyBlock>
instead of Result<BlockContent<T>> — caller gets the full updated block back.
*/

export function blockInsertAt(
  block: AnyBlock,
  nodeIndex: number,
  offset: number,
  incoming: Node,
): Result<AnyBlock> {
  return insertAt(block, nodeIndex, offset, incoming).map(
    (content) =>
      ({
        ...block,
        content,
      }) as AnyBlock,
  );
}

export function blockDeleteLastChar(block: AnyBlock): Result<AnyBlock> {
  return deleteLastChar(block).map(
    (content) =>
      ({
        ...block,
        content,
      }) as AnyBlock,
  );
}

export function blockDeleteRange(
  block: AnyBlock,
  startNodeIndex: number,
  startOffset: number,
  endNodeIndex: number,
  endOffset: number,
): Result<AnyBlock> {
  return deleteRange(
    block,
    startNodeIndex,
    startOffset,
    endNodeIndex,
    endOffset,
  ).map((content) => ({ ...block, content }) as AnyBlock);
}

export function blockReplaceRange(
  block: AnyBlock,
  startNodeIndex: number,
  startOffset: number,
  endNodeIndex: number,
  endOffset: number,
  incoming: Node,
): Result<AnyBlock> {
  return replaceRange(
    block,
    startNodeIndex,
    startOffset,
    endNodeIndex,
    endOffset,
    incoming,
  ).map((content) => ({ ...block, content }) as AnyBlock);
}

// splitBlock already returns Result<[AnyBlock, AnyBlock]> — re-exported as-is
export { splitBlock, mergeBlocks };
