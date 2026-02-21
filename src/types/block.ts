export type BlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bullet"
  | "number"
  | "todo"
  | "equation"
  | "code";

// ─── Node ──────────────────────────────────────────────────────────────────────

export type Node =
  | {
      type: "text";
      text: string;
      highlighted?: "yellow" | "green";
      color?: "red" | 'blue' | 'green' 
      bold?: true;
      italic?: true;
      underline?: true;
      strikethrough?: true;
      link?: string;
    }
  | { type: "code"; text: string }
  | { type: "equation"; latex: string };

// ─── Block Meta ────────────────────────────────────────────────────────────────

export type BlockMeta<T extends BlockType> = T extends "todo"
  ? { checked?: true; depth: number }
  : T extends "bullet" | "number"
  ? { depth: number }
  : T extends "code"
  ? { language?: string }
  : Record<string, never>;

// ─── Block Content ─────────────────────────────────────────────────────────────
// Rich blocks → text Node[]
// code block  → [{ type: "code";  text: string }]
// equation    → [{ type: "equation"; latex: string }]

export type BlockContent<T extends BlockType> = T extends "code"
  ? [Extract<Node, { type: "code" }>]
  : T extends "equation"
  ? [Extract<Node, { type: "equation" }>]
  : Node[];

// ─── Block ─────────────────────────────────────────────────────────────────────

export type Block<T extends BlockType = BlockType> = {
  id: string;
  type: T;
  meta: BlockMeta<T>;
  content: BlockContent<T>;
};

/**
 * Discriminated Union of Block
 */
export type AnyBlock = { [K in BlockType]: Block<K> }[BlockType];