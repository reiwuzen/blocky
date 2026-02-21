import { Result } from '@reiwuzen/result';
import type { AnyBlock, BlockType, Node } from '../types/block';

// ─── Serialize ─────────────────────────────────────────────────────────────────

/**
 * Serialize an array of blocks to a JSON string.
 * Wraps JSON.stringify in Result.try so any circular ref or
 * other stringify error surfaces as Err rather than throwing.
 */
export function serialize(blocks: AnyBlock[]): Result<string, unknown> {
  return Result.try(() => JSON.stringify(blocks));
}

// ─── Deserialize ───────────────────────────────────────────────────────────────

/**
 * Deserialize a JSON string back into AnyBlock[].
 * Validates:
 *   - valid JSON
 *   - top level is an array
 *   - each item has id (string), type (known BlockType), meta (object), content (array)
 */
export function deserialize(json: string): Result<AnyBlock[], string> {
  return Result.try(() => JSON.parse(json))
    .mapErr(() => "Invalid JSON string")
    .andThen((parsed) => {
      if (!Array.isArray(parsed))
        return Result.Err("Expected an array at top level");

      const validTypes = new Set<string>([
        "paragraph", "heading1", "heading2", "heading3",
        "bullet", "number", "todo", "code", "equation",
      ]);

      for (let i = 0; i < parsed.length; i++) {
        const block = parsed[i];

        if (typeof block !== "object" || block === null)
          return Result.Err(`Block at index ${i} is not an object`);

        if (typeof block.id !== "string" || !block.id.length)
          return Result.Err(`Block at index ${i} has invalid id`);

        if (!validTypes.has(block.type))
          return Result.Err(`Block at index ${i} has unknown type "${block.type}"`);

        if (typeof block.meta !== "object" || block.meta === null)
          return Result.Err(`Block at index ${i} has invalid meta`);

        if (!Array.isArray(block.content))
          return Result.Err(`Block at index ${i} has invalid content`);

        const contentErr = validateContent(block.content, block.type, i);
        if (contentErr) return Result.Err(contentErr);
      }

      return Result.Ok(parsed as AnyBlock[]);
    });
}

// ─── Content validator ─────────────────────────────────────────────────────────

function validateContent(
  content: unknown[],
  type: BlockType,
  blockIndex: number
): string | null {
  const isLeaf = type === "code" || type === "equation";

  if (isLeaf && content.length !== 1)
    return `Block at index ${blockIndex} (${type}) must have exactly 1 content node`;

  for (let i = 0; i < content.length; i++) {
    const node = content[i];
    const err  = validateNode(node, blockIndex, i);
    if (err) return err;
  }

  return null;
}

function validateNode(
  node: unknown,
  blockIndex: number,
  nodeIndex: number
): string | null {
  const prefix = `Block[${blockIndex}].content[${nodeIndex}]`;

  if (typeof node !== "object" || node === null)
    return `${prefix} is not an object`;

  const n = node as Record<string, unknown>;

  if (n.type === "text") {
    if (typeof n.text !== "string")
      return `${prefix} text node missing "text" string`;
    return null;
  }

  if (n.type === "code") {
    if (typeof n.text !== "string")
      return `${prefix} code node missing "text" string`;
    return null;
  }

  if (n.type === "equation") {
    if (typeof n.latex !== "string")
      return `${prefix} equation node missing "latex" string`;
    return null;
  }

  return `${prefix} has unknown node type "${n.type}"`;
}


// ─── serializeNodes ────────────────────────────────────────────────────────────

/**
 * Serialize a Node[] to a JSON string — for clipboard copy.
 * Preserves all formatting.
 */
export function serializeNodes(nodes: Node[]): Result<string, unknown> {
  return Result.try(() => JSON.stringify(nodes));
}

// ─── deserializeNodes ──────────────────────────────────────────────────────────

/**
 * Deserialize a JSON string back into Node[] — for clipboard paste.
 * Validates each node shape before returning.
 */
export function deserializeNodes(json: string): Result<Node[], string> {
  return Result.try(() => JSON.parse(json))
    .mapErr(() => "Invalid JSON string")
    .andThen((parsed) => {
      if (!Array.isArray(parsed))
        return Result.Err("Expected an array of nodes");

      for (let i = 0; i < parsed.length; i++) {
        const err = validateNode(parsed[i], 0, i);
        if (err) return Result.Err(err);
      }

      return Result.Ok(parsed as Node[]);
    });
}

// ─── toPlainText ───────────────────────────────────────────────────────────────

/**
 * Extract plain text from a Node[] — strips all formatting.
 * text   → text
 * code   → text
 * equation → latex
 */
export function toPlainText(nodes: Node[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text")     return n.text;
      if (n.type === "code")     return n.text;
      if (n.type === "equation") return n.latex;
      return "";
    })
    .join("");
}


// ─── toMarkdown ────────────────────────────────────────────────────────────────

/**
 * Convert a Node[] to a markdown inline string.
 * Used internally by blocksToMarkdown per block.
 */
function nodesToMarkdown(nodes: Node[]): string {
  return nodes
    .map((n) => {
      if (n.type === "code")     return `\`${n.text}\``;
      if (n.type === "equation") return `$${n.latex}$`;

      // text node — apply formatting wrappers
      let text = n.text;
      if (n.bold)          text = `**${text}**`;
      if (n.italic)        text = `*${text}*`;
      if (n.underline)     text = `<u>${text}</u>`;
      if (n.strikethrough) text = `~~${text}~~`;
      if (n.link)          text = `[${text}](${n.link})`;
      return text;
    })
    .join("");
}

/**
 * Convert an array of blocks to a markdown string.
 *
 * paragraph    → plain inline
 * heading1-3   → # / ## / ###
 * bullet       → - (indented by depth)
 * number       → 1. (indented by depth)
 * todo         → - [ ] / - [x] (indented by depth)
 * code         → ```language\n...\n```
 * equation     → $$...$$ (block equation)
 */
export function toMarkdown(blocks: AnyBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return nodesToMarkdown(block.content as Node[]);

        case "heading1":
          return `# ${nodesToMarkdown(block.content as Node[])}`;
        case "heading2":
          return `## ${nodesToMarkdown(block.content as Node[])}`;
        case "heading3":
          return `### ${nodesToMarkdown(block.content as Node[])}`;

        case "bullet": {
          const indent = "  ".repeat(block.meta.depth);
          return `${indent}- ${nodesToMarkdown(block.content as Node[])}`;
        }

        case "number": {
          const indent = "  ".repeat(block.meta.depth);
          return `${indent}1. ${nodesToMarkdown(block.content as Node[])}`;
        }

        case "todo": {
          const indent  = "  ".repeat(block.meta.depth);
          const checkbox = block.meta.checked ? "[x]" : "[ ]";
          return `${indent}- ${checkbox} ${nodesToMarkdown(block.content as Node[])}`;
        }

        case "code": {
          const lang = block.meta.language ?? "";
          return `\`\`\`${lang}\n${block.content[0].text}\n\`\`\``;
        }

        case "equation":
          return `$$${block.content[0].latex}$$`;
      }
    })
    .join("\n\n");
}