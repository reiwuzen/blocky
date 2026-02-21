# @reiwuzen/blocky

Pure TypeScript block editor engine. No UI, no framework, no opinions on rendering.

Handles everything an editor needs at the data layer — content mutation, formatting, markdown shortcuts, serialization, and history. Bring your own renderer.

---

## Install

```bash
npm install @reiwuzen/blocky
```

---

## Concepts

### Block

```ts
type Block<T extends BlockType> = {
  id: string;
  type: T;
  meta: BlockMeta<T>;
  content: BlockContent<T>;
}
```

### Block Types

| Type | Content | Meta |
|------|---------|------|
| `paragraph` | `TextNode[]` | — |
| `heading1` / `heading2` / `heading3` | `TextNode[]` | — |
| `bullet` | `TextNode[]` | `{ depth: number }` |
| `number` | `TextNode[]` | `{ depth: number }` |
| `todo` | `TextNode[]` | `{ depth: number, checked?: true }` |
| `code` | `[CodeNode]` | `{ language?: string }` |
| `equation` | `[EquationNode]` | — |

### Node

```ts
type Node =
  | {
      type: "text";
      text: string;
      bold?: true;
      italic?: true;
      underline?: true;
      strikethrough?: true;
      highlighted?: "yellow" | "green";
      color?: "red" | "blue" | "green";
      link?: string;
    }
  | { type: "code";     text: string  }
  | { type: "equation"; latex: string }
```

Rich blocks hold `TextNode[]` and can contain inline `code` and `equation` nodes.
Leaf blocks (`code`, `equation`) always hold a single-element tuple `[Node]`.

---

## Result

All engine functions return `Result<T>` from [`@reiwuzen/result`](https://npmjs.com/package/@reiwuzen/result) — no silent failures, no thrown exceptions.

```ts
result.match(
  (value) => { /* success */ },
  (error) => { /* failure, error is a string */ }
)

// chaining
deleteRange(block, 0, 0, 0, 5)
  .andThen((content) => insertAt({ ...block, content }, 0, 0, incoming))
  .match(...)
```

---

## API

### Content — `engine/content`

```ts
// Insert a node at any position — end, start, or mid-node
insertAt(block, nodeIndex, offset, incoming): Result<BlockContent<T>>

// Delete the last character from the last node
deleteLastChar(block): Result<BlockContent>

// Delete a selected range
deleteRange(block, startNodeIndex, startOffset, endNodeIndex, endOffset): Result<BlockContent<T>>

// Replace a selected range with a node — atomic deleteRange + insertAt
replaceRange(block, startNodeIndex, startOffset, endNodeIndex, endOffset, incoming): Result<BlockContent<T>>

// Split a block at cursor position → [original, newParagraph]
splitBlock(block, nodeIndex, offset): Result<[AnyBlock, AnyBlock]>

// Merge blockB content into blockA
mergeBlocks(blockA, blockB): Result<AnyBlock>
```

### Format — `engine/format`

```ts
type NodeSelection = {
  startIndex: number;
  startOffset: number;
  endIndex: number;
  endOffset: number; // exclusive
}

toggleBold(nodes, selection): Result<Node[]>
toggleItalic(nodes, selection): Result<Node[]>
toggleUnderline(nodes, selection): Result<Node[]>
toggleStrikethrough(nodes, selection): Result<Node[]>
toggleHighlight(nodes, selection, "yellow" | "green"): Result<Node[]>
toggleColor(nodes, selection, "red" | "blue" | "green"): Result<Node[]>
setLink(nodes, selection, href): Result<Node[]>
removeLink(nodes, selection): Result<Node[]>
```

Auto-detects toggle — if all selected nodes already have the format, it removes it.

### Transform — `engine/transform`

```ts
// Call on every space keypress — converts paragraph to another type
// if content starts with a markdown shortcut at position 0
applyMarkdownTransform(block, cursorOffset): Result<{ block, converted: boolean }>

// Convert a block to a new type, preserving content where possible
changeBlockType(block, targetType): Result<Block<T>>

// Toggle checked state on a todo block
toggleTodo(block): Result<Block<"todo">>

// Increase / decrease depth for bullet, number, todo (max depth: 6)
indentBlock(block): Result<IndentableBlock>
outdentBlock(block): Result<IndentableBlock>
```

**Markdown shortcuts:**

| Typed | Result |
|-------|--------|
| `- ` | `bullet` |
| `1. ` | `number` |
| `[] ` | `todo` |
| `# ` | `heading1` |
| `## ` | `heading2` |
| `### ` | `heading3` |

### Serializer — `engine/serializer`

```ts
// Blocks ↔ JSON
serialize(blocks): Result<string>
deserialize(json): Result<AnyBlock[]>

// Nodes ↔ JSON (clipboard)
serializeNodes(nodes): Result<string>
deserializeNodes(json): Result<Node[]>

// Plain text extraction
toPlainText(nodes): string

// Blocks → markdown string
toMarkdown(blocks): string
```

### History — `engine/history`

Pure functions — no classes, no mutation.

```ts
createHistory(initialBlocks): History
push(history, blocks, maxSize?): History   // default maxSize: 100
undo(history): Result<History>
redo(history): Result<History>
canUndo(history): boolean
canRedo(history): boolean
currentBlocks(history): AnyBlock[]
```

```ts
// Typical usage
let h = createHistory(initialBlocks);

// after every engine operation
h = push(h, newBlocks);

// undo / redo
undo(h).match(
  (h2) => { h = h2; render(currentBlocks(h)); },
  (e)  => console.error(e)
);
```

### Utils — `utils/block`

```ts
generateId(fn?): string
createBlock(type, idFn?): Result<Block<T>>
insertBlockAfter(blocks, afterId, type, idFn?): Result<{ blocks, newId }>
deleteBlock(blocks, id): { blocks, prevId }
duplicateBlock(block, newId): AnyBlock
moveBlock(blocks, id, "up" | "down"): Result<AnyBlock[]>
```

---

## Package Structure

```
src/
├── index.ts
├── types/
│   └── block.ts
└── engine/
    ├── content.ts      ← insertAt, deleteLastChar, deleteRange, replaceRange, splitBlock, mergeBlocks
    ├── format.ts       ← toggleBold, toggleItalic, toggleColor, setLink, ...
    ├── transform.ts    ← applyMarkdownTransform, changeBlockType, toggleTodo, indent/outdent
    ├── serializer.ts   ← serialize, deserialize, toMarkdown, toPlainText, ...
    └── history.ts      ← createHistory, push, undo, redo
```

---

## Local Development

```bash
# in /@reiwuzen/blocky
npm install
npm run dev

# in your project
"dependencies": { "@reiwuzen/blocky": "../@reiwuzen/blocky" }
```

---

## License

MIT