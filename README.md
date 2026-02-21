# @reiwuzen/blocky

Pure TypeScript block editor engine. No UI, no store, no framework dependencies.

Handles block content, inline formatting, and markdown transformations. Bring your own rendering and state management.

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
  | { type: "text"; text: string; bold?: true; italic?: true; underline?: true; strikethrough?: true; highlighted?: "yellow" | "green"; link?: string }
  | { type: "code"; text: string }
  | { type: "equation"; latex: string }
```

Rich blocks hold `TextNode[]` and can also contain inline `code` and `equation` nodes.
Leaf blocks (`code`, `equation`) always hold a single-element tuple `[Node]`.

---

## Engine

All functions return `Result<T>` from [`@reiwuzen/result`](https://npmjs.com/package/@reiwuzen/result) — no silent failures, no thrown exceptions.

```ts
result.match(
  (value) => { /* success */ },
  (error) => { /* failure */ }
)
```

---

### `insertAt`

The single API for all content insertion — end, start, and mid-node.

```ts
import { insertAt } from "@reiwuzen/blocky";

insertAt(block, nodeIndex, offset, incoming): Result<BlockContent<T>>
```

```
"Hello World"
 01234567890

offset=0  → prepend
offset=5  → mid
offset=11 → append
```

```ts
// append — merges with existing node
insertAt(block, 0, 11, { type: "text", text: "!" })
// → "Hello World!"

// append bold to clean — new node
insertAt(block, 0, 11, { type: "text", text: " bold", bold: true })
// → ["Hello World", " bold"(bold)]

// mid clean — merges back
insertAt(block, 0, 5, { type: "text", text: " hi" })
// → "Hello hi World"

// mid bold into clean — splits into 3
insertAt(block, 0, 5, { type: "text", text: " hi", bold: true })
// → ["Hello", " hi"(bold), " World"]
```

---

### `deleteLastChar`

Delete the last character from the last node. Removes the node if it becomes empty.

```ts
import { deleteLastChar } from "@reiwuzen/blocky";

deleteLastChar(block): Result<BlockContent<BlockType>>
```

```ts
deleteLastChar(block)      // "Hello World" → "Hello Worl"
deleteLastChar(block)      // "H" → [] (node removed)
deleteLastChar(emptyBlock) // Err("Nothing to delete")
```

---

### `toggleBold` / `toggleItalic` / ...

Apply or toggle formatting across a selection. Auto-detects toggle — all selected nodes already formatted → removes it.

```ts
import { toggleBold, toggleItalic, toggleUnderline, toggleStrikethrough, toggleHighlight, setLink, removeLink } from "@reiwuzen/blocky";

type NodeSelection = {
  startIndex: number;  // which node
  startOffset: number; // char offset within that node
  endIndex: number;
  endOffset: number;   // exclusive
}
```

```ts
toggleBold(block.content, { startIndex: 0, startOffset: 0, endIndex: 0, endOffset: 5 })
// "Hello World" → [{ text: "Hello", bold: true }, { text: " World" }]
```

---

### `applyMarkdownTransform`

Call on every space keypress. Converts a `paragraph` to another block type when content starts with a markdown shortcut.

```ts
import { applyMarkdownTransform } from "@reiwuzen/blocky";

applyMarkdownTransform(block, cursorOffset): Result<{ block: AnyBlock; converted: boolean }>
```

| Typed | Result |
|-------|--------|
| `- ` | `bullet` |
| `1. ` | `number` |
| `[] ` | `todo` |
| `# ` | `heading1` |
| `## ` | `heading2` |
| `### ` | `heading3` |

Only fires on `paragraph` blocks. Trigger text is stripped after conversion.

```ts
applyMarkdownTransform(block, cursorOffset).match(
  ({ block, converted }) => { if (converted) replaceBlock(block) },
  (err) => console.error(err)
)
```

---

## Package Structure

```
src/
├── index.ts
├── types/
│   └── block.ts       ← Block, Node, BlockType, BlockContent, BlockMeta
└── engine/
    ├── format.ts      ← toggleBold, toggleItalic, ...
    ├── content.ts     ← insertAt, deleteLastChar
    └── transform.ts   ← applyMarkdownTransform
```

---

## License

MIT