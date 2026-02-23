import type { Node, AnyBlock, BlockContent, BlockType } from '../types/block';
import { generateId } from '../utils/block';
import { Result } from '@reiwuzen/result';
import { isTextNode, formatsMatch } from './format';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TextNode     = Extract<Node, { type: "text" }>;
type CodeNode     = Extract<Node, { type: "code" }>;
type EquationNode = Extract<Node, { type: "equation" }>;
type TextFormat   = Pick<TextNode, "bold" | "italic" | "underline" | "strikethrough" | "highlighted" | "link" | 'color'>;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isClean(node: Pick<TextNode, keyof TextFormat>): boolean {
  return (
    node.bold          === undefined &&
    node.italic        === undefined &&
    node.underline     === undefined &&
    node.strikethrough === undefined &&
    node.highlighted   === undefined &&
    node.color         === undefined &&
    node.link          === undefined
  );
}

function getTextLength(node: Node): number {
  if (node.type === "text" || node.type === "code") return node.text.length;
  if (node.type === "equation") return node.latex.length;
  return 0;
}

function tryMerge(a: Node, b: Node): Node | null {
  if (a.type !== b.type) return null;
  if (a.type === "code"     && b.type === "code")     return { ...a, text: a.text + b.text };
  if (a.type === "equation" && b.type === "equation") return { ...a, latex: a.latex + b.latex };
  if (a.type === "text"     && b.type === "text") {
    if ((isClean(a) && isClean(b)) || formatsMatch(a, b))
      return { ...a, text: a.text + b.text };
  }
  return null;
}

function sliceNode(node: Node, start: number, end: number): Node | null {
  if (start >= end) return null;
  if (node.type === "text")     { const text  = node.text.slice(start, end);  return text.length  ? { ...node, text }  : null; }
  if (node.type === "code")     { const text  = node.text.slice(start, end);  return text.length  ? { ...node, text }  : null; }
  if (node.type === "equation") { const latex = node.latex.slice(start, end); return latex.length ? { ...node, latex } : null; }
  return null;
}

// ─── insertAt (sole public API) ────────────────────────────────────────────────

/**
 * Insert a Node at a specific position within block content.
 *
 * - nodeIndex: which node to insert into
 * - offset: char position within that node
 *
 * End-of-node (offset === length) naturally becomes an append —
 * sliceNode produces no right half, incoming merges with left or gets pushed.
 * No separate append function needed.
 */
export function insertAt<T extends BlockType>(
  block: AnyBlock,
  nodeIndex: number,
  offset: number,
  incoming: Node
): Result<BlockContent<T>> {

  // ── code block ────────────────────────────────────────────────────────────
  if (block.type === "code") {
    if (incoming.type !== "code")
      return Result.Err(`code block only accepts a code node, got "${incoming.type}"`);
    const node = (block.content as [CodeNode])[0];
    if (offset < 0 || offset > node.text.length)
      return Result.Err(`offset (${offset}) out of bounds for code node`);
    const text = node.text.slice(0, offset) + incoming.text + node.text.slice(offset);
    return Result.Ok([{ ...node, text }] as BlockContent<T>);
  }

  // ── equation block ────────────────────────────────────────────────────────
  if (block.type === "equation") {
    if (incoming.type !== "equation")
      return Result.Err(`equation block only accepts an equation node, got "${incoming.type}"`);
    const node = (block.content as [EquationNode])[0];
    if (offset < 0 || offset > node.latex.length)
      return Result.Err(`offset (${offset}) out of bounds for equation node`);
    const latex = node.latex.slice(0, offset) + incoming.latex + node.latex.slice(offset);
    return Result.Ok([{ ...node, latex }] as unknown as BlockContent<T>);
  }

  // ── rich blocks ───────────────────────────────────────────────────────────
  const content = block.content as Node[];

  // Empty content — just push
  if (content.length === 0) {
    return Result.Ok([incoming] as BlockContent<T>);
  }

  if (nodeIndex < 0 || nodeIndex >= content.length)
    return Result.Err(`nodeIndex (${nodeIndex}) out of bounds (length=${content.length})`);

  const target    = content[nodeIndex];
  const targetLen = getTextLength(target);

  if (offset < 0 || offset > targetLen)
    return Result.Err(`offset (${offset}) out of bounds for node at index ${nodeIndex}`);

  const before = content.slice(0, nodeIndex);
  const after  = content.slice(nodeIndex + 1);
  const middle: Node[] = [];

  // Left half of split — empty when offset=0
  const left = sliceNode(target, 0, offset);
  if (left) middle.push(left);

  // Incoming — try merge with left half
  if (middle.length > 0) {
    const merged = tryMerge(middle[middle.length - 1], incoming);
    if (merged) middle[middle.length - 1] = merged;
    else middle.push(incoming);
  } else {
    middle.push(incoming);
  }

  // Right half — empty when offset=targetLen (end of node → natural append)
  const right = sliceNode(target, offset, targetLen);
  if (right) {
    const merged = tryMerge(middle[middle.length - 1], right);
    if (merged) middle[middle.length - 1] = merged;
    else middle.push(right);
  }

  // Merge across all boundaries
  const result: Node[] = [];
  for (const node of [...before, ...middle, ...after]) {
    const prev   = result[result.length - 1];
    const merged = prev ? tryMerge(prev, node) : null;
    if (merged) result[result.length - 1] = merged;
    else result.push(node);
  }

  return Result.Ok(result as unknown as BlockContent<T>);
}

// ─── deleteLastChar ────────────────────────────────────────────────────────────

export function deleteLastChar(block: AnyBlock): Result<BlockContent<BlockType>> {
  if (block.type === "code") {
    const node = (block.content as [CodeNode])[0];
    if (!node.text.length) return Result.Err("Nothing to delete");
    return Result.Ok([{ ...node, text: node.text.slice(0, -1) }] as unknown as BlockContent<BlockType>);
  }

  if (block.type === "equation") {
    const node = (block.content as [EquationNode])[0];
    if (!node.latex.length) return Result.Err("Nothing to delete");
    return Result.Ok([{ ...node, latex: node.latex.slice(0, -1) }] as unknown as BlockContent<BlockType>);
  }

  const next = [...(block.content as Node[])];

  for (let i = next.length - 1; i >= 0; i--) {
    const node = next[i];
    if (node.type === "text" || node.type === "code") {
      const trimmed = node.text.slice(0, -1);
      if (!trimmed.length) next.splice(i, 1);
      else next[i] = { ...node, text: trimmed };
      return Result.Ok(next as unknown as BlockContent<BlockType>);
    }
    if (node.type === "equation") {
      const trimmed = node.latex.slice(0, -1);
      if (!trimmed.length) next.splice(i, 1);
      else next[i] = { ...node, latex: trimmed };
      return Result.Ok(next as unknown as BlockContent<BlockType>);
    }
  }

  return Result.Err("Nothing to delete");
}


// ─── deleteRange ───────────────────────────────────────────────────────────────

/**
 * Delete content across a selection.
 * After deletion, left and right boundaries are merged if formats match.
 *
 * For code/equation blocks: deletes within the single tuple node's text/latex.
 */
export function deleteRange<T extends BlockType>(
  block: AnyBlock,
  startNodeIndex: number,
  startOffset: number,
  endNodeIndex: number,
  endOffset: number
): Result<BlockContent<T>> {

  // ── code block ────────────────────────────────────────────────────────────
  if (block.type === "code") {
    const node = (block.content as [CodeNode])[0];
    if (startOffset < 0 || endOffset > node.text.length || startOffset > endOffset)
      return Result.Err(`invalid range [${startOffset}, ${endOffset}] for code node`);
    const text = node.text.slice(0, startOffset) + node.text.slice(endOffset);
    return Result.Ok([{ ...node, text }]  as BlockContent<T>);
  }

  // ── equation block ────────────────────────────────────────────────────────
  if (block.type === "equation") {
    const node = (block.content as [EquationNode])[0];
    if (startOffset < 0 || endOffset > node.latex.length || startOffset > endOffset)
      return Result.Err(`invalid range [${startOffset}, ${endOffset}] for equation node`);
    const latex = node.latex.slice(0, startOffset) + node.latex.slice(endOffset);
    return Result.Ok([{ ...node, latex }] as BlockContent<T>);
  }

  // ── rich blocks ───────────────────────────────────────────────────────────
  const nodes = block.content as Node[];

  if (startNodeIndex < 0 || endNodeIndex >= nodes.length)
    return Result.Err(`node indices [${startNodeIndex}, ${endNodeIndex}] out of bounds`);
  if (startNodeIndex > endNodeIndex)
    return Result.Err(`startNodeIndex (${startNodeIndex}) > endNodeIndex (${endNodeIndex})`);

  const startNode = nodes[startNodeIndex];
  const endNode   = nodes[endNodeIndex];

  if (startOffset < 0 || startOffset > getTextLength(startNode))
    return Result.Err(`startOffset (${startOffset}) out of bounds`);
  if (endOffset < 0 || endOffset > getTextLength(endNode))
    return Result.Err(`endOffset (${endOffset}) out of bounds`);

  const before = nodes.slice(0, startNodeIndex);
  const after  = nodes.slice(endNodeIndex + 1);
  const middle: Node[] = [];

  // Keep left part of start node
  const left = sliceNode(startNode, 0, startOffset);
  if (left) middle.push(left);

  // Keep right part of end node
  const right = sliceNode(endNode, endOffset, getTextLength(endNode));
  if (right) {
    const merged = middle.length > 0 ? tryMerge(middle[middle.length - 1], right) : null;
    if (merged) middle[middle.length - 1] = merged;
    else middle.push(right);
  }

  // Merge all boundaries
  const result: Node[] = [];
  for (const node of [...before, ...middle, ...after]) {
    const prev   = result[result.length - 1];
    const merged = prev ? tryMerge(prev, node) : null;
    if (merged) result[result.length - 1] = merged;
    else result.push(node);
  }

  return Result.Ok(result  as BlockContent<T>);
}

// ─── splitBlock ────────────────────────────────────────────────────────────────

/**
 * Split a block at a given position into two blocks.
 * The original block keeps content before the cursor.
 * A new block gets content after the cursor — always of type "paragraph".
 *
 * Not supported for code/equation blocks — returns Err.
 */
export function splitBlock(
  block: AnyBlock,
  nodeIndex: number,
  offset: number
): Result<[AnyBlock, AnyBlock]> {
  if (block.type === "code" || block.type === "equation")
    return Result.Err(`splitBlock is not supported for "${block.type}" blocks`);

  const nodes = block.content as Node[];

  if (nodes.length > 0 && (nodeIndex < 0 || nodeIndex >= nodes.length))
    return Result.Err(`nodeIndex (${nodeIndex}) out of bounds`);

  const target    = nodes[nodeIndex] ?? null;
  const targetLen = target ? getTextLength(target) : 0;

  if (offset < 0 || offset > targetLen)
    return Result.Err(`offset (${offset}) out of bounds`);

  // Content before cursor stays in original block
  const beforeNodes: Node[] = [
    ...nodes.slice(0, nodeIndex),
    ...( target && offset > 0 ? [sliceNode(target, 0, offset)!].filter(Boolean) : [] ),
  ];

  // Content after cursor goes to new block
  const afterNodes: Node[] = [
    ...( target && offset < targetLen ? [sliceNode(target, offset, targetLen)!].filter(Boolean) : [] ),
    ...nodes.slice(nodeIndex + 1),
  ];

  const original: AnyBlock = {
    ...block,
    content: beforeNodes,
  } as AnyBlock;

  const newBlock: AnyBlock = {
    id: generateId(),
    type: "paragraph",
    content: afterNodes,
    meta: {},
  } as AnyBlock;

  return Result.Ok([original, newBlock]);
}

// ─── mergeBlocks ───────────────────────────────────────────────────────────────

/**
 * Merge blockB into blockA — blockB's content is appended to blockA's content.
 * blockA's type and meta are preserved.
 *
 * Not supported if either block is code or equation — returns Err.
 */
export function mergeBlocks(
  blockA: AnyBlock,
  blockB: AnyBlock
): Result<AnyBlock> {
  if (blockA.type === "code" || blockA.type === "equation")
    return Result.Err(`mergeBlocks: blockA cannot be of type "${blockA.type}"`);
  if (blockB.type === "code" || blockB.type === "equation")
    return Result.Err(`mergeBlocks: blockB cannot be of type "${blockB.type}"`);

  const nodesA = blockA.content as Node[];
  const nodesB = blockB.content as Node[];

  // Merge boundaries between the two arrays
  const result: Node[] = [...nodesA];
  for (const node of nodesB) {
    const prev   = result[result.length - 1];
    const merged = prev ? tryMerge(prev, node) : null;
    if (merged) result[result.length - 1] = merged;
    else result.push(node);
  }

  return Result.Ok({
    ...blockA,
    content: result,
  } as AnyBlock);
}


// ─── replaceRange ──────────────────────────────────────────────────────────────

/**
 * Replace a selected range with an incoming Node — atomic deleteRange + insertAt.
 * This is what fires when the user has a selection and types a character.
 *
 * Internally chains:
 *   1. deleteRange  — remove selected content
 *   2. insertAt     — insert incoming at the start of the deleted range
 */
export function replaceRange<T extends BlockType>(
  block: AnyBlock,
  startNodeIndex: number,
  startOffset: number,
  endNodeIndex: number,
  endOffset: number,
  incoming: Node
): Result<BlockContent<T>> {
  return deleteRange<T>(block, startNodeIndex, startOffset, endNodeIndex, endOffset)
    .andThen((content) =>
      insertAt<T>(
        { ...block, content } as AnyBlock,
        startNodeIndex,
        startOffset,
        incoming
      )
    );
}