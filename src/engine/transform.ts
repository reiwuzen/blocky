import type { AnyBlock, Block, BlockType, Node } from "../types/block";
import { Result } from "@reiwuzen/result";

// ─── Types ─────────────────────────────────────────────────────────────────────

type RichBlockType = Extract<
  BlockType,
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bullet"
  | "number"
  | "todo"
>;

export type TransformResult = {
  block: AnyBlock;
  /** true if the block type was actually changed, false if no trigger matched */
  converted: boolean;
};

// ─── Trigger map ───────────────────────────────────────────────────────────────

const TRIGGERS: Record<string, Exclude<RichBlockType, "paragraph">> = {
  "-": "bullet",
  "1.": "number",
  "[]": "todo",
  "#": "heading1",
  "##": "heading2",
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
  prefix: string,
): Block<"paragraph">["content"] {
  const first = block.content[0];
  if (!first || first.type !== "text") return block.content;

  const stripped = first.text.slice(prefix.length + 1); // +1 for the space
  if (stripped.length === 0) return [];
  return [{ ...first, text: stripped }, ...block.content.slice(1)];
}

// ─── applyMarkdownTransform ────────────────────────────────────────────────────

/**
 * Attempt to convert a paragraph block into another type based on a
 * Markdown-style prefix typed by the user.
 *
 * Call this when a **space** is typed inside a paragraph block.
 *
 * Supported triggers (must appear at position 0, immediately before the space):
 *
 * | Typed    | Converts to |
 * |----------|-------------|
 * | `-`      | bullet      |
 * | `1.`     | number      |
 * | `[]`     | todo        |
 * | `#`      | heading1    |
 * | `##`     | heading2    |
 * | `###`    | heading3    |
 *
 * Guards — returns `converted: false` without mutating if any fail:
 *   1. `block.type` must be `"paragraph"`
 *   2. The text must start with a known trigger prefix
 *   3. `cursorOffset` must be ≥ `trigger.length + 1` — ensures the space
 *      was typed right after the trigger (blocks mid-text triggers like
 *      `"hello - "` from accidentally converting)
 *
 * On success the returned block has the trigger prefix stripped from its
 * content and a freshly built `meta` for the target type.
 */
export function applyMarkdownTransform(
  block: AnyBlock,
  cursorOffset: number,
): Result<TransformResult> {
  if (block.type !== "paragraph") return Result.Ok({ block, converted: false });

  const text = getRawText(block);

  // Sort longest first so "###" beats "##" beats "#"
  const match = Object.keys(TRIGGERS)
    .sort((a, b) => b.length - a.length)
    .find((trigger) => text === trigger || text.startsWith(trigger + " "));

  if (!match) return Result.Ok({ block, converted: false });

  const triggerEnd = match.length + 1; // +1 for the space
  if (cursorOffset < triggerEnd) return Result.Ok({ block, converted: false });

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
 * Convert a block to a new type, preserving content and meta where possible.
 *
 * Content conversion rules:
 *
 * | From        | To          | Content result                         |
 * |-------------|-------------|----------------------------------------|
 * | rich        | rich        | kept as-is                             |
 * | rich        | code        | all text concatenated → `[CodeNode]`   |
 * | rich        | equation    | all text concatenated → `[EquationNode]`|
 * | code        | rich        | `code.text` → single `TextNode`        |
 * | equation    | rich        | `equation.latex` → single `TextNode`   |
 * | code        | equation    | `code.text` as `latex`                 |
 * | equation    | code        | `equation.latex` as `text`             |
 *
 * Meta conversion rules:
 * - list → list  : `meta` (including `depth`) is preserved
 * - anything else: fresh default `meta` is built for the target type
 */
export function changeBlockType<T extends BlockType>(
  block: AnyBlock,
  targetType: T,
): Result<Block<T>> {
  if (block.type === targetType) return Result.Ok(block as Block<T>);

  const content = deriveContent(block, targetType);
  const meta = deriveMeta(block, targetType);

  return Result.Ok({
    id: block.id,
    type: targetType,
    content,
    meta,
  } as Block<T>);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

type TextNode = Extract<Node, { type: "text" }>;
type CodeNode = Extract<Node, { type: "code" }>;
type EquationNode = Extract<Node, { type: "equation" }>;

function extractText(block: AnyBlock): string {
  if (block.type === "code") return (block.content as [CodeNode])[0].text;
  if (block.type === "equation")
    return (block.content as [EquationNode])[0].latex;
  return block.content
    .map((n) => {
      if (n.type === "text") return n.text;
      if (n.type === "code") return n.text;
      if (n.type === "equation") return n.latex;
      return "";
    })
    .join("");
}

function deriveContent(
  block: AnyBlock,
  targetType: BlockType,
): AnyBlock["content"] {
  const text = extractText(block);
  if (targetType === "code") return [{ type: "code", text }] as [CodeNode];
  if (targetType === "equation")
    return [{ type: "equation", latex: text }] as [EquationNode];
  if (block.type === "code" || block.type === "equation") {
    return text.length ? ([{ type: "text", text }] as TextNode[]) : [];
  }
  return block.content;
}

function buildMetaForTarget(targetType: BlockType): AnyBlock["meta"] {
  switch (targetType) {
    case "bullet":
    case "number":
    case "todo":
      return { depth: 0 };
    default:
      return {};
  }
}

function isList(type: BlockType): boolean {
  return type === "bullet" || type === "todo" || type === "number";
}

function deriveMeta(block: AnyBlock, targetType: BlockType): AnyBlock["meta"] {
  if (isList(block.type) && isList(targetType)) return block.meta;
  return buildMetaForTarget(targetType);
}

// ─── toggleTodo ────────────────────────────────────────────────────────────────

/**
 * Toggle the checked state of a todo block.
 *
 * Cycle: `undefined → true → undefined`
 *
 * Returns `Err` if the block is not of type `"todo"`.
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

const MAX_DEPTH = 6;

function isIndentable(block: AnyBlock): block is IndentableBlock {
  return (
    block.type === "bullet" || block.type === "number" || block.type === "todo"
  );
}

/**
 * Increase the indentation depth of a list block (`bullet`, `number`, `todo`) by 1.
 *
 * - Maximum depth is `6`.
 * - Returns `Err` if the block type is not indentable or is already at max depth.
 */
export function indentBlock(block: AnyBlock): Result<IndentableBlock> {
  if (!isIndentable(block))
    return Result.Err(
      `indentBlock only supports bullet, number, todo — got "${block.type}"`,
    );
  if (block.meta.depth >= MAX_DEPTH)
    return Result.Err(`already at max depth (${MAX_DEPTH})`);

  return Result.Ok({
    ...block,
    meta: { ...block.meta, depth: block.meta.depth + 1 },
  } as IndentableBlock);
}

/**
 * Decrease the indentation depth of a list block (`bullet`, `number`, `todo`) by 1.
 *
 * - Minimum depth is `0`.
 * - Returns `Err` if the block type is not indentable or is already at depth 0.
 */
export function outdentBlock(block: AnyBlock): Result<IndentableBlock> {
  if (!isIndentable(block))
    return Result.Err(
      `outdentBlock only supports bullet, number, todo — got "${block.type}"`,
    );
  if (block.meta.depth <= 0) return Result.Err(`already at min depth (0)`);

  return Result.Ok({
    ...block,
    meta: { ...block.meta, depth: block.meta.depth - 1 },
  } as IndentableBlock);
}

// ─── areBlocksSame ─────────────────────────────────────────────────────────────

/**
 * Deep-equality check between two block arrays.
 *
 * Two arrays are considered the same when:
 *   - They have the same length
 *   - Every block at the same index has the same `id`, `type`, `meta`, and `content`
 *
 * Content nodes are compared field-by-field. Unknown extra fields on nodes are
 * ignored so the check stays stable across schema additions.
 *
 * Useful for preventing redundant saves or snapshot writes:
 * ```ts
 * if (!areBlocksSame(current, saved)) {
 *   await createSnapshot(current);
 * }
 * ```
 */
export function areBlocksSame(
  blocks: AnyBlock[],
  withBlocks: AnyBlock[],
): boolean {
  if (blocks.length !== withBlocks.length) return false;

  return blocks.every((a, i) => {
    const b = withBlocks[i];

    if (a.type !== b.type) return false;

    // Meta — all values are primitives so JSON.stringify is safe and correct
    if (JSON.stringify(a.meta) !== JSON.stringify(b.meta)) return false;

    // Content — must have same length
    if (a.content.length !== b.content.length) return false;

    return a.content.every((an, j) => {
      const bn = b.content[j];
      if (an.type !== bn.type) return false;

      switch (an.type) {
        case "code":
          return an.text === (bn as typeof an).text;

        case "equation":
          return an.latex === (bn as typeof an).latex;

        case "text": {
          const bt = bn as typeof an;
          return (
            an.text === bt.text &&
            an.bold === bt.bold &&
            an.italic === bt.italic &&
            an.underline === bt.underline &&
            an.strikethrough === bt.strikethrough &&
            an.highlighted === bt.highlighted &&
            an.color === bt.color &&
            an.link === bt.link
          );
        }

        default:
          return false;
      }
    });
  });
}
