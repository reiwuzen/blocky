import type { Node } from '../types/block';
import { Result } from '@reiwuzen/result';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TextNode = Extract<Node, { type: "text" }>;

type TextFormat = Pick<
  TextNode,
  "bold" | "italic" | "underline" | "strikethrough" | "highlighted" | "color" | "link"
>;

export type NodeSelection = {
  startIndex: number;
  startOffset: number;
  endIndex: number;
  endOffset: number;
};

// ─── Validation ────────────────────────────────────────────────────────────────

function validateSelection(nodes: Node[], sel: NodeSelection): Result<void> {
  const { startIndex, startOffset, endIndex, endOffset } = sel;

  if (startIndex < 0 || endIndex >= nodes.length)
    return Result.Err(
      `indices [${startIndex}, ${endIndex}] out of bounds (length=${nodes.length})`
    );

  if (startIndex > endIndex)
    return Result.Err(`startIndex (${startIndex}) > endIndex (${endIndex})`);

  const startNode = nodes[startIndex];
  const endNode = nodes[endIndex];

  if (!isTextNode(startNode) || !isTextNode(endNode))
    return Result.Err(`Selection must start and end on a text node`);

  if (startOffset < 0 || startOffset > startNode.text.length)
    return Result.Err(
      `startOffset (${startOffset}) out of bounds for "${startNode.text}"`
    );

  if (endOffset < 0 || endOffset > endNode.text.length)
    return Result.Err(
      `endOffset (${endOffset}) out of bounds for "${endNode.text}"`
    );

  if (startIndex === endIndex && startOffset >= endOffset)
    return Result.Err(
      `startOffset (${startOffset}) must be < endOffset (${endOffset}) within same node`
    );

  if (!nodes.slice(startIndex, endIndex + 1).every(isTextNode))
    return Result.Err(`Selection contains non-text nodes (code/equation)`);

  return Result.Ok(undefined);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function isTextNode(node: Node): node is TextNode {
  return node.type === "text";
}

function isFormatActive(
  nodes: TextNode[],
  sel: NodeSelection,
  format: keyof TextFormat,
  value: unknown = true
): boolean {
  return nodes
    .slice(sel.startIndex, sel.endIndex + 1)
    .every((n) => n[format] === value);
}

function applyFormat(
  node: TextNode,
  format: keyof TextFormat,
  value: unknown,
  remove: boolean
): TextNode {
  const next = { ...node };
  if (remove) {
    delete next[format];
  } else {
    (next as Record<string, unknown>)[format] = value;
  }
  return next;
}

function splitNode(
  node: TextNode,
  start: number,
  end: number,
  format: keyof TextFormat,
  value: unknown,
  remove: boolean
): TextNode[] {
  const parts: TextNode[] = [];
  if (start > 0)
    parts.push({ ...node, text: node.text.slice(0, start) });
  parts.push(
    applyFormat({ ...node, text: node.text.slice(start, end) }, format, value, remove)
  );
  if (end < node.text.length)
    parts.push({ ...node, text: node.text.slice(end) });
  return parts;
}

// ─── Core Engine ───────────────────────────────────────────────────────────────

export function formatNodes(
  nodes: Node[],
  sel: NodeSelection,
  format: keyof TextFormat,
  value: unknown = true
): Result<Node[]> {
  return validateSelection(nodes, sel).map(() => {
    const { startIndex, startOffset, endIndex, endOffset } = sel;
    const textNodes = nodes as TextNode[];
    const remove = isFormatActive(textNodes, sel, format, value);
    const result: Node[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      if (i < startIndex || i > endIndex) {
        result.push(node);
        continue;
      }

      if (!isTextNode(node)) {
        result.push(node);
        continue;
      }

      const isSingle = startIndex === endIndex;
      const isFirst  = i === startIndex;
      const isLast   = i === endIndex;

      if (isSingle) {
        result.push(...splitNode(node, startOffset, endOffset, format, value, remove));
      } else if (isFirst) {
        result.push(...splitNode(node, startOffset, node.text.length, format, value, remove));
      } else if (isLast) {
        result.push(...splitNode(node, 0, endOffset, format, value, remove));
      } else {
        result.push(applyFormat(node, format, value, remove));
      }
    }

    return mergeAdjacentNodes(result);
  });
}

// ─── Merge adjacent nodes ──────────────────────────────────────────────────────

export function mergeAdjacentNodes(nodes: Node[]): Node[] {
  const result: Node[] = [];
  for (const node of nodes) {
    const prev = result[result.length - 1];
    if (prev && isTextNode(prev) && isTextNode(node) && formatsMatch(prev, node)) {
      result[result.length - 1] = { ...prev, text: prev.text + node.text };
    } else {
      result.push(node);
    }
  }
  return result;
}

export function formatsMatch(a: TextNode, b: TextNode): boolean {
  const keys: (keyof TextFormat)[] = [
    "bold", "italic", "underline", "strikethrough", "highlighted", "color", "link",
  ];
  return keys.every((k) => a[k] === b[k]);
}

// ─── Convenience wrappers ──────────────────────────────────────────────────────

export const toggleBold = (nodes: Node[], sel: NodeSelection) =>
  formatNodes(nodes, sel, "bold");

export const toggleItalic = (nodes: Node[], sel: NodeSelection) =>
  formatNodes(nodes, sel, "italic");

export const toggleUnderline = (nodes: Node[], sel: NodeSelection) =>
  formatNodes(nodes, sel, "underline");

export const toggleStrikethrough = (nodes: Node[], sel: NodeSelection) =>
  formatNodes(nodes, sel, "strikethrough");

export const toggleHighlight = (
  nodes: Node[],
  sel: NodeSelection,
  color: "yellow" | "green" = "yellow"
) => formatNodes(nodes, sel, "highlighted", color);

export const toggleColor = (
  nodes: Node[],
  sel: NodeSelection,
  color: "red" | "blue" | "green"
) => formatNodes(nodes, sel, "color", color);

export const setLink = (nodes: Node[], sel: NodeSelection, href: string) =>
  formatNodes(nodes, sel, "link", href);

export const removeLink = (nodes: Node[], sel: NodeSelection) =>
  formatNodes(nodes, sel, "link", undefined);
