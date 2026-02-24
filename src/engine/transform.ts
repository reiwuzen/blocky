import type { AnyBlock, Block, BlockType, Node } from '../types/block';
import { Result } from '@reiwuzen/result';

// ─── Types ─────────────────────────────────────────────────────────────────────

type RichBlockType = Extract<BlockType,
  "paragraph" | "heading1" | "heading2" | "heading3" | "bullet" | "number" | "todo"
>;

export type TransformResult = {
  block: AnyBlock;
  converted: boolean;
};

// ─── Trigger map ───────────────────────────────────────────────────────────────

const TRIGGERS: Record<string, Exclude<RichBlockType, "paragraph">> = {
  "-":   "bullet",
  "1.":  "number",
  "[]":  "todo",
  "#":   "heading1",
  "##":  "heading2",
  "###": "heading3",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getRawText(block: Block<"paragraph">): string {
  const first = block.content[0];
  if (!first || first.type !== "text") return "";
  return first.text;
}

function stripPrefix(
  block: Block<"paragraph">,
  prefix: string
): Block<"paragraph">["content"] {
  const first = block.content[0];
  if (!first || first.type !== "text") return block.content;

  const stripped = first.text.slice(prefix.length + 1); // +1 for the space
  if (stripped.length === 0) return [];
  return [{ ...first, text: stripped }, ...block.content.slice(1)];
}



// ─── Core ──────────────────────────────────────────────────────────────────────

/**
 * Call this when a space is typed.
 *
 * Guards (returns converted=false if any fail):
 *   1. block.type must be "paragraph"
 *   2. cursorOffset must be ≤ trigger.length + 1
 *      — ensures the space was typed right after the trigger at position 0
 *      — blocks mid-text spaces like "hello - " from converting
 *   3. text must start with a known trigger prefix
 */
export function applyMarkdownTransform(
  block: AnyBlock,
  cursorOffset: number
): Result<TransformResult> {
  // Guard 1 — only paragraph blocks
  if (block.type !== "paragraph")
    return Result.Ok({ block, converted: false });

  const text = getRawText(block);

  // Guard 2 — find trigger first, then validate cursor is right after it
  // Sort longest first so ### beats ## beats #
  const match = Object.keys(TRIGGERS)
    .sort((a, b) => b.length - a.length)
    .find((trigger) => text === trigger || text.startsWith(trigger + " "));

  if (!match)
    return Result.Ok({ block, converted: false });

  // Guard 3 — cursor must be positioned right after "trigger + space"
  // e.g. "## My Title" → match="##", valid cursor range is 0..3
  // "hello ## Title" would never match since trigger must be at start
  const triggerEnd = match.length + 1; // +1 for the space
  if (cursorOffset < triggerEnd)
    return Result.Ok({ block, converted: false });

  const targetType = TRIGGERS[match];
  const strippedContent = stripPrefix(block, match);

  const converted: AnyBlock = {
    id: block.id,
    type: targetType,
    content: strippedContent,
    meta: buildMetaForTarget(targetType),
  } as unknown as AnyBlock;

  return Result.Ok({ block: converted, converted: true });
}


// ─── changeBlockType ───────────────────────────────────────────────────────────

/**
 * Convert a block to a new type while preserving content as much as possible.
 *
 * rich → rich         keep content as-is, update type + meta
 * rich → code         strip all formatting, concat all text → [CodeNode]
 * rich → equation     strip all formatting, concat all text → [EquationNode]
 * code → rich         single TextNode with code.text
 * equation → rich     single TextNode with equation.latex
 * code → equation     [EquationNode] with code.text as latex
 * equation → code     [CodeNode] with equation.latex as text
 */
export function changeBlockType<T extends BlockType>(
  block: AnyBlock,
  targetType: T
): Result<Block<T>> {
  if (block.type === targetType)
    return Result.Ok(block as unknown as Block<T>);

  const content = deriveContent(block, targetType);
  const meta    = buildMetaForTarget(targetType);

  return Result.Ok({
    id: block.id,
    type: targetType,
    content,
    meta,
  }  as Block<T>);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

type TextNode     = Extract<Node, { type: "text" }>;
type CodeNode     = Extract<Node, { type: "code" }>;
type EquationNode = Extract<Node, { type: "equation" }>;

/** Concat all readable text out of any block's content */
function extractText(block: AnyBlock): string {
  if (block.type === "code")     return (block.content as [CodeNode])[0].text;
  if (block.type === "equation") return (block.content as [EquationNode])[0].latex;
  // rich block — concat text from all nodes, ignore inline code/eq
  return (block.content)
    .map((n) => {
      if (n.type === "text")     return n.text;
      if (n.type === "code")     return n.text;
      if (n.type === "equation") return n.latex;
      return "";
    })
    .join("");
}

function deriveContent(block: AnyBlock, targetType: BlockType): AnyBlock["content"] {
  const text = extractText(block);

  // → code
  if (targetType === "code")
    return [{ type: "code", text }] as [CodeNode];

  // → equation
  if (targetType === "equation")
    return [{ type: "equation", latex: text }] as [EquationNode];

  // → rich block
  if (block.type === "code" || block.type === "equation") {
    // single clean TextNode, no formatters
    return text.length ? [{ type: "text", text }] as TextNode[] : [];
  }

  // rich → rich — keep content as-is
  return block.content;
}

function buildMetaForTarget(targetType: BlockType): AnyBlock["meta"] {
  switch (targetType) {
    case "bullet":
    case "number":
    case "todo":     return { depth: 0 };
    case "heading1":
    case "heading2":
    case "heading3":
    case "paragraph":
    case "code":
    case "equation": return {};
  }
}


// ─── toggleTodo ────────────────────────────────────────────────────────────────

/**
 * Toggle the checked state of a todo block.
 * checked: undefined → checked: true → checked: undefined (cycle)
 */
export function toggleTodo(block: AnyBlock): Result<Block<"todo">> {
  if (block.type !== "todo")
    return Result.Err(`toggleTodo expects a "todo" block, got "${block.type}"`);

  const todo = block as Block<"todo">;
  const checked = todo.meta.checked ? undefined : true;
  const meta = checked
    ? { ...todo.meta, checked }
    : (({ checked: _, ...rest }) => rest)(todo.meta);

  return Result.Ok({ ...todo, meta } as Block<"todo">);
}


// ─── indent / outdent ──────────────────────────────────────────────────────────

type IndentableBlock = Block<"bullet"> | Block<"number"> | Block<"todo">;
type IndentableType  = "bullet" | "number" | "todo";

const MAX_DEPTH = 6;

function isIndentable(block: AnyBlock): block is IndentableBlock {
  return block.type === "bullet" || block.type === "number" || block.type === "todo";
}

/**
 * Increase the depth of a bullet, number, or todo block by 1.
 * Max depth is 6. Returns Err if block type is not indentable.
 */
export function indentBlock(block: AnyBlock): Result<IndentableBlock> {
  if (!isIndentable(block))
    return Result.Err(`indentBlock only supports bullet, number, todo — got "${block.type}"`);

  if (block.meta.depth >= MAX_DEPTH)
    return Result.Err(`already at max depth (${MAX_DEPTH})`);

  return Result.Ok({
    ...block,
    meta: { ...block.meta, depth: block.meta.depth + 1 },
  } as IndentableBlock);
}

/**
 * Decrease the depth of a bullet, number, or todo block by 1.
 * Min depth is 0. Returns Err if block type is not indentable or already at 0.
 */
export function outdentBlock(block: AnyBlock): Result<IndentableBlock> {
  if (!isIndentable(block))
    return Result.Err(`outdentBlock only supports bullet, number, todo — got "${block.type}"`);

  if (block.meta.depth <= 0)
    return Result.Err(`already at min depth (0)`);

  return Result.Ok({
    ...block,
    meta: { ...block.meta, depth: block.meta.depth - 1 },
  } as IndentableBlock);
}