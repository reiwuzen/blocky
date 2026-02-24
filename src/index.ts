// ─── Content ───────────────────────────────────────────────────────────────────
export { insertAt, deleteLastChar, deleteRange, replaceRange, splitBlock, mergeBlocks } from "./engine/content";

// ─── Format ────────────────────────────────────────────────────────────────────
export { formatNodes, toggleBold, toggleItalic, toggleUnderline, toggleStrikethrough, toggleHighlight, toggleColor, setLink, removeLink, mergeAdjacentNodes } from "./engine/format";

// ─── Transform ─────────────────────────────────────────────────────────────────
export { applyMarkdownTransform, changeBlockType, toggleTodo, indentBlock, outdentBlock } from "./engine/transform";

// ─── Serializer ────────────────────────────────────────────────────────────────
export { serialize, deserialize, serializeNodes, deserializeNodes, toPlainText, toMarkdown } from "./engine/serializer";


// ─── History ───────────────────────────────────────────────────────────────────
export { createHistory, push, undo, redo, canUndo, canRedo, currentBlocks } from "./engine/history";
export type { History, HistoryEntry } from "./engine/history";

// ─── Utils ─────────────────────────────────────────────────────────────────────
export { generateId, createBlock, createBlockAfter,insertBlockAfter,duplicateBlockAfter, deleteBlock, duplicateBlock, moveBlock } from "./engine/block";

// ─── Types ─────────────────────────────────────────────────────────────────────
export type { Node, Block, BlockContent, BlockMeta, BlockType, AnyBlock } from "./types/block";

export type {NodeSelection} from './engine/format'

