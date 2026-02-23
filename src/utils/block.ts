import { Result } from '@reiwuzen/result';
import { v7 } from 'uuid';
import type { Block, BlockType, BlockContent, BlockMeta, AnyBlock } from '../types/block';

// ─── generateId ────────────────────────────────────────────────────────────────

/**
 * Generate a unique block id.
 * Pass a custom fn to override the default (uuid v7).
 */
export function generateId(fn?: () => string): string {
  return fn ? fn() : v7();
}

// ─── Default content per block type ───────────────────────────────────────────

const defaultContent: { [T in BlockType]: BlockContent<T> } = {
  paragraph: [],
  heading1:  [],
  heading2:  [],
  heading3:  [],
  bullet:    [],
  number:    [],
  todo:      [],
  code:      [{ type: "code",     text:  "" }],
  equation:  [{ type: "equation", latex: "" }],
};

// ─── Default meta per block type ──────────────────────────────────────────────

const defaultMeta: { [T in BlockType]: BlockMeta<T> } = {
  paragraph: {},
  heading1:  {},
  heading2:  {},
  heading3:  {},
  bullet:    { depth: 0 },
  number:    { depth: 0 },
  todo:      { depth: 0 },
  code:      {},
  equation:  {},
};

// ─── createBlock ──────────────────────────────────────────────────────────────

/**
 * Create a new block of the given type with default content and meta.
 * Optionally pass a custom id generator.
 *
 * @param type       - the block type to create
 * @param idFn       - optional custom id generator (defaults to uuid v7)
 */
export function createBlock<T extends BlockType>(
  type: T,
  idFn?: () => string
): Result<Block<T>, unknown> {
  return Result.try(() => {
    const block: Block<T> = {
      id:      generateId(idFn),
      type,
      meta:    defaultMeta[type] as BlockMeta<T>,
      content: defaultContent[type] as BlockContent<T>,
    };
    return block;
  });
}

// ─── Block array helpers ───────────────────────────────────────────────────────

export function createBlockAfter<T extends BlockType>(
  blocks: AnyBlock[],
  afterId: string,
  type: T,
  idFn?: () => string
): Result<{ blocks: AnyBlock[]; newId: string }, unknown> {
  return createBlock(type, idFn).andThen((newBlock) => {
    const index = blocks.findIndex((b) => b.id === afterId);
    if (index === -1 ) return Result.Err(`[BlockNotFound]: ${afterId}`)
    const next  = [...blocks];
    next.splice(index + 1, 0, newBlock as AnyBlock);
    return Result.Ok({ blocks: next, newId: newBlock.id });
  });
}

export function insertBlockAfter(
  blocks: AnyBlock[],
  afterId: string,
  insertBlock: AnyBlock
): Result<{ blocks: AnyBlock[]; newFocusId: string }, unknown> {

  const targetBlockIndex = blocks.findIndex(b => b.id === afterId);
  if (targetBlockIndex === -1) {
    return Result.Err(`No block found with id: ${afterId}`);
  }

  const newBlocks = [
    ...blocks.slice(0, targetBlockIndex + 1),
    insertBlock,
    ...blocks.slice(targetBlockIndex + 1),
  ];

  return Result.Ok({
    blocks: newBlocks,
    newFocusId: insertBlock.id
  });
}

export function deleteBlock(
  blocks: AnyBlock[],
  id: string
): { blocks: AnyBlock[]; prevId: string } {
  const index  = blocks.findIndex((b) => b.id === id);
  const prevId = blocks[index - 1]?.id ?? blocks[index + 1]?.id ?? "";
  return { blocks: blocks.filter((b) => b.id !== id), prevId };
}

export function changeBlockTypeInList<T extends BlockType>(
  blocks: AnyBlock[],
  id: string,
  type: T
): AnyBlock[] {
  return blocks.map((b) =>
    b.id === id
      ? ({ ...b, type, meta: defaultMeta[type], content: defaultContent[type] } as AnyBlock)
      : b
  );
}


// ─── duplicateBlock ────────────────────────────────────────────────────────────

export function duplicateBlock(
  incoming: AnyBlock,
  newId: string = crypto.randomUUID()
): AnyBlock {
  return {
    ...incoming,
    id: newId,
    meta: { ...incoming.meta },
    content: incoming.content.map(node => ({ ...node })),
  } as AnyBlock;
}

export function duplicateBlockAfter(blocks:AnyBlock[], id:string, newId?:string):Result<{blocks:AnyBlock[], newFocusId: string}, unknown>{
  const targetBlock = blocks.find(b => b.id === id)
  if (targetBlock == null) return Result.Err(`[BlockNotFound]: ${id}`)
    const dup = duplicateBlock(targetBlock,newId)
    return insertBlockAfter(blocks,id, dup)
}

// ─── moveBlock ─────────────────────────────────────────────────────────────────

/**
 * Move a block up or down by one position in the array.
 * Returns the same array unchanged if block is already at the boundary.
 * Returns Err if id not found.
 */
export function moveBlock(
  blocks: AnyBlock[],
  id: string,
  direction: "up" | "down"
): Result<AnyBlock[], string> {
  const index = blocks.findIndex((b) => b.id === id);

  if (index === -1)
    return Result.Err(`Block with id "${id}" not found`);

  if (direction === "up" && index === 0)
    return Result.Ok([...blocks]); // already at top

  if (direction === "down" && index === blocks.length - 1)
    return Result.Ok([...blocks]); // already at bottom

  const next = [...blocks];
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  [next[index], next[swapIndex]] = [next[swapIndex], next[index]];

  return Result.Ok(next);
}