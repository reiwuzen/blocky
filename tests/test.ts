import { Block, Node, AnyBlock } from "../src/types/block";
import { v7 } from "uuid";
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleHighlight,
  setLink,
  mergeAdjacentNodes,
} from "../src/engine/format";
import { applyMarkdownTransform } from "../src/engine/transform";
import { insertAt, deleteLastChar } from "../src/engine/content";

// ─── Blocks ────────────────────────────────────────────────────────────────────

const paragraphBlock: Block<"paragraph"> = {
  id: v7(),
  type: "paragraph",
  content: [{ type: "text", text: "Hello World" }],
  meta: {},
};

const codeBlock: Block<"code"> = {
  id: v7(),
  type: "code",
  content: [{ type: "code", text: "const x = 1" }],
  meta: {},
};

const equationBlock: Block<"equation"> = {
  id: v7(),
  type: "equation",
  content: [{ type: "equation", latex: "x^2" }],
  meta: {},
};

const emptyParagraph: Block<"paragraph"> = {
  id: v7(),
  type: "paragraph",
  content: [],
  meta: {},
};

const boldParagraph: Block<"paragraph"> = {
  id: v7(), type: "paragraph",
  content: [{ type: "text", text: "Hello", bold: true }],
  meta: {},
};

const singleChar: Block<"paragraph"> = {
  id: v7(), type: "paragraph",
  content: [{ type: "text", text: "H" }],
  meta: {},
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function log(label: string, value: unknown) {
  console.log(`\n── ${label}`);
  console.dir(value, { depth: null });
}

function run(label: string, result: ReturnType<typeof toggleBold>) {
  result.match(
    (nodes) => log(label, nodes),
    (err)   => console.error(`\n── ${label}\n   ERROR: ${err}`)
  );
}

// ─── format.ts tests ──────────────────────────────────────────────────────────

// "Hello World"
//  01234567890

// 1. Bold "Hello" → ["Hello"(bold), " World"]
run('1. Bold "Hello"', toggleBold(paragraphBlock.content, {
  startIndex: 0, startOffset: 0,
  endIndex: 0,   endOffset: 5,
}));

// 2. Toggle bold off → merges back to ["Hello World"]
toggleBold(paragraphBlock.content, {
  startIndex: 0, startOffset: 0,
  endIndex: 0,   endOffset: 5,
})
  .andThen((nodes) =>
    toggleBold(nodes, { startIndex: 0, startOffset: 0, endIndex: 0, endOffset: 5 })
  )
  .match(
    (nodes) => log('2. Unbold "Hello" (toggle off)', nodes),
    (err)   => console.error(`ERROR: ${err}`)
  );

// 3. Italic "lo Wo" → ["Hel", "lo Wo"(italic), "rld"]
run('3. Italic "lo Wo"', toggleItalic(paragraphBlock.content, {
  startIndex: 0, startOffset: 3,
  endIndex: 0,   endOffset: 8,
}));

// 4. Bold entire node
run("4. Bold entire node", toggleBold(paragraphBlock.content, {
  startIndex: 0, startOffset: 0,
  endIndex: 0,   endOffset: 11,
}));

// 5. Multi-node: bold "World" then italic across both
toggleBold(paragraphBlock.content, {
  startIndex: 0, startOffset: 6,
  endIndex: 0,   endOffset: 11,
})
  .inspect((nodes) => log('5a. Bold "World"', nodes))
  .andThen((nodes) =>
    toggleItalic(nodes, {
      startIndex: 0, startOffset: 3,
      endIndex: 1,   endOffset: 3,
    })
  )
  .match(
    (nodes) => log('5b. Italic across both nodes "lo Wor"', nodes),
    (err)   => console.error(`ERROR: ${err}`)
  );

// 6. Highlight "Hello" yellow
run('6. Highlight "Hello" yellow', toggleHighlight(paragraphBlock.content, {
  startIndex: 0, startOffset: 0,
  endIndex: 0,   endOffset: 5,
}, "yellow"));

// 7. Link on "World"
run('7. Link on "World"', setLink(paragraphBlock.content, {
  startIndex: 0, startOffset: 6,
  endIndex: 0,   endOffset: 11,
}, "https://example.com"));

// 8. Strikethrough "llo Wor"
run('8. Strikethrough "llo Wor"', toggleStrikethrough(paragraphBlock.content, {
  startIndex: 0, startOffset: 2,
  endIndex: 0,   endOffset: 9,
}));

// 9. Merge identical adjacent nodes
const fragmented: Node[] = [
  { type: "text", text: "Hel" },
  { type: "text", text: "lo " },
  { type: "text", text: "World" },
];
log("9. Merge identical adjacent nodes", mergeAdjacentNodes(fragmented));

// 10. Should NOT merge different formats
const mixed: Node[] = [
  { type: "text", text: "Hello ", bold: true },
  { type: "text", text: "World" },
];
log("10. Should NOT merge different formats", mergeAdjacentNodes(mixed));

// ─── format.ts edge cases (expect ERRORs) ─────────────────────────────────────

console.log("\n── format.ts edge cases (expect ERRORs below)");

toggleBold(paragraphBlock.content, {
  startIndex: 0, startOffset: 0,
  endIndex: 5,   endOffset: 3,
}).inspectErr((e) => console.error(`11. Out of bounds index → ${e}`));

toggleBold(paragraphBlock.content, {
  startIndex: 0, startOffset: 5,
  endIndex: 0,   endOffset: 3,
}).inspectErr((e) => console.error(`12. startOffset >= endOffset → ${e}`));

toggleBold(paragraphBlock.content, {
  startIndex: 2, startOffset: 0,
  endIndex: 0,   endOffset: 3,
}).inspectErr((e) => console.error(`13. startIndex > endIndex → ${e}`));

// ─── content.ts tests ─────────────────────────────────────────────────────────


// "Hello World" → nodeIndex=0, offset=11 is end
// "Hello"(bold) → nodeIndex=0, offset=5  is end

console.log("\n── insertAt: offset at end (natural append)");

// 14. Clean at end of clean → merges
insertAt(paragraphBlock, 0, 11, { type: "text", text: "!" }).match(
  (c) => log('14. Clean end + clean → "Hello World!"', c),
  (e) => console.error(`14. ERROR: ${e}`)
);

// 15. Bold at end of clean → new node (formats differ)
insertAt(paragraphBlock, 0, 11, { type: "text", text: " bold", bold: true }).match(
  (c) => log("15. Bold end + clean → new node", c),
  (e) => console.error(`15. ERROR: ${e}`)
);

// 16. Bold at end of bold → merges
insertAt(boldParagraph, 0, 5, { type: "text", text: " World", bold: true }).match(
  (c) => log("16. Bold end + bold → merge", c),
  (e) => console.error(`16. ERROR: ${e}`)
);

// 17. Italic at end of bold → new node
insertAt(boldParagraph, 0, 5, { type: "text", text: " World", italic: true }).match(
  (c) => log("17. Italic end + bold → new node", c),
  (e) => console.error(`17. ERROR: ${e}`)
);

// 18. Append to empty block (offset=0, content=[])
insertAt(emptyParagraph, 0, 0, { type: "text", text: "Hello" }).match(
  (c) => log("18. Append to empty block", c),
  (e) => console.error(`18. ERROR: ${e}`)
);

// 19. Inline code at end of paragraph
insertAt(paragraphBlock, 0, 11, { type: "code", text: "x = 1" }).match(
  (c) => log("19. Inline code at end of paragraph", c),
  (e) => console.error(`19. ERROR: ${e}`)
);

// 20. Code block — append at end (offset=11)
insertAt(codeBlock, 0, 11, { type: "code", text: "\nconst y = 2" }).match(
  (c) => log("20. Code block append at end", c),
  (e) => console.error(`20. ERROR: ${e}`)
);

// 21. Equation block — append at end (offset=3)
insertAt(equationBlock, 0, 3, { type: "equation", latex: " + y" }).match(
  (c) => log("21. Equation block append at end", c),
  (e) => console.error(`21. ERROR: ${e}`)
);

console.log("\n── insertAt: offset at start (prepend)");

// 22. Clean at start of clean → merges
insertAt(paragraphBlock, 0, 0, { type: "text", text: "Hey! " }).match(
  (c) => log('22. Clean start + clean → merges', c),
  (e) => console.error(`22. ERROR: ${e}`)
);

// 23. Bold at start of clean → new node
insertAt(paragraphBlock, 0, 0, { type: "text", text: "Hey! ", bold: true }).match(
  (c) => log('23. Bold start + clean → new node', c),
  (e) => console.error(`23. ERROR: ${e}`)
);

// 24. Code block — insert at start (offset=0)
insertAt(codeBlock, 0, 0, { type: "code", text: "// header\n" }).match(
  (c) => log("24. Code block insert at start", c),
  (e) => console.error(`24. ERROR: ${e}`)
);

console.log("\n── insertAt: offset mid-node (split)");

// 25. Clean mid clean → merges back into one node
// "Hello World" insert " hi" at 5 → "Hello hi World"
insertAt(paragraphBlock, 0, 5, { type: "text", text: " hi" }).match(
  (c) => log('25. Clean mid clean → "Hello hi World"', c),
  (e) => console.error(`25. ERROR: ${e}`)
);

// 26. Bold mid clean → splits into 3
// "Hello World" → ["Hello", " hi"(bold), " World"]
insertAt(paragraphBlock, 0, 5, { type: "text", text: " hi", bold: true }).match(
  (c) => log('26. Bold mid clean → ["Hello", " hi"(bold), " World"]', c),
  (e) => console.error(`26. ERROR: ${e}`)
);

// 27. Same format mid-node → merges back to 1
// "Hello"(bold) insert " there"(bold) at 3 → "Hel there lo"(bold)
insertAt(boldParagraph, 0, 3, { type: "text", text: " there", bold: true }).match(
  (c) => log('27. Same format mid-node → merges back to 1', c),
  (e) => console.error(`27. ERROR: ${e}`)
);

// 28. Insert mid code block
// "const x = 1" insert " y," at offset 6
insertAt(codeBlock, 0, 6, { type: "code", text: " y," }).match(
  (c) => log('28. Insert mid code block', c),
  (e) => console.error(`28. ERROR: ${e}`)
);

// 29. Insert mid equation block
// "x^2" insert "+z" at offset 2
insertAt(equationBlock, 0, 2, { type: "equation", latex: "+z" }).match(
  (c) => log('29. Insert mid equation block', c),
  (e) => console.error(`29. ERROR: ${e}`)
);

console.log("\n── insertAt: edge cases (expect ERRORs)");

// 30. nodeIndex out of bounds
insertAt(paragraphBlock, 5, 0, { type: "text", text: "x" }).inspectErr(
  (e) => console.error(`30. nodeIndex out of bounds → ${e}`)
);

// 31. offset out of bounds
insertAt(paragraphBlock, 0, 99, { type: "text", text: "x" }).inspectErr(
  (e) => console.error(`31. offset out of bounds → ${e}`)
);

// 32. Wrong node type for code block
insertAt(codeBlock, 0, 0, { type: "text", text: "x" }).inspectErr(
  (e) => console.error(`32. Wrong node type for code block → ${e}`)
);

// 33. Wrong node type for equation block
insertAt(equationBlock, 0, 0, { type: "text", text: "x" }).inspectErr(
  (e) => console.error(`33. Wrong node type for equation block → ${e}`)
);

// ─── deleteLastChar tests ──────────────────────────────────────────────────────

console.log("\n── deleteLastChar tests");

// 34. Delete last char from paragraph
deleteLastChar(paragraphBlock).match(
  (c) => log("34. Delete last char from paragraph", c),
  (e) => console.error(`34. ERROR: ${e}`)
);

// 35. Single char node → node removed entirely
deleteLastChar(singleChar).match(
  (c) => log("35. Single char → node removed", c),
  (e) => console.error(`35. ERROR: ${e}`)
);

// 36. Delete from code block
deleteLastChar(codeBlock).match(
  (c) => log("36. Delete from code block", c),
  (e) => console.error(`36. ERROR: ${e}`)
);

// 37. Delete from equation block
deleteLastChar(equationBlock).match(
  (c) => log("37. Delete from equation block", c),
  (e) => console.error(`37. ERROR: ${e}`)
);

// 38. Empty paragraph → Err
deleteLastChar(emptyParagraph).inspectErr(
  (e) => console.error(`38. Empty paragraph → ${e}`)
);

// 39. Empty code block → Err
const emptyCode: Block<"code"> = {
  id: v7(), type: "code",
  content: [{ type: "code", text: "" }],
  meta: {},
};
deleteLastChar(emptyCode).inspectErr(
  (e) => console.error(`39. Empty code block → ${e}`)
);


// ─── changeBlockType tests ────────────────────────────────────────────────────

import { changeBlockType } from "../src/engine/transform";

console.log("\n── changeBlockType tests");

// 42. rich → rich (paragraph → bullet) — content preserved
changeBlockType(paragraphBlock, "bullet").match(
  (b) => log("42. paragraph → bullet (content preserved)", b),
  (e) => console.error(`42. ERROR: ${e}`)
);

// 43. rich → rich (paragraph → heading1) — content preserved
changeBlockType(paragraphBlock, "heading1").match(
  (b) => log("43. paragraph → heading1 (content preserved)", b),
  (e) => console.error(`43. ERROR: ${e}`)
);

// 44. rich → code — strips formatters, concats text
changeBlockType(boldParagraph, "code").match(
  (b) => log("44. bold paragraph → code (stripped, concat)", b),
  (e) => console.error(`44. ERROR: ${e}`)
);

// 45. rich with mixed nodes → code — concats all text
const mixedParagraph: Block<"paragraph"> = {
  id: v7(), type: "paragraph",
  content: [
    { type: "text", text: "Hello", bold: true },
    { type: "text", text: " World" },
    { type: "code", text: "x = 1" },
  ],
  meta: {},
};
changeBlockType(mixedParagraph, "code").match(
  (b) => log("45. mixed paragraph → code (all text concat)", b),
  (e) => console.error(`45. ERROR: ${e}`)
);

// 46. rich → equation — concats text as latex
changeBlockType(paragraphBlock, "equation").match(
  (b) => log("46. paragraph → equation (text as latex)", b),
  (e) => console.error(`46. ERROR: ${e}`)
);

// 47. code → rich (paragraph) — single clean TextNode
changeBlockType(codeBlock, "paragraph").match(
  (b) => log("47. code → paragraph (single TextNode)", b),
  (e) => console.error(`47. ERROR: ${e}`)
);

// 48. equation → rich (paragraph) — single clean TextNode with latex as text
changeBlockType(equationBlock, "paragraph").match(
  (b) => log("48. equation → paragraph (latex as text)", b),
  (e) => console.error(`48. ERROR: ${e}`)
);

// 49. code → equation — text becomes latex
changeBlockType(codeBlock, "equation").match(
  (b) => log("49. code → equation (text as latex)", b),
  (e) => console.error(`49. ERROR: ${e}`)
);

// 50. equation → code — latex becomes text
changeBlockType(equationBlock, "code").match(
  (b) => log("50. equation → code (latex as text)", b),
  (e) => console.error(`50. ERROR: ${e}`)
);

// 51. same type → returns block unchanged
changeBlockType(paragraphBlock, "paragraph").match(
  (b) => log("51. same type → unchanged", b),
  (e) => console.error(`51. ERROR: ${e}`)
);


// ─── toggleColor tests ────────────────────────────────────────────────────────

import { toggleColor } from "../src/engine/format";

console.log("\n── toggleColor tests");

// 52. Color "Hello" red → ["Hello"(red), " World"]
toggleColor(paragraphBlock.content, {
  startIndex: 0, startOffset: 0,
  endIndex: 0,   endOffset: 5,
}, "red").match(
  (n) => log('52. Color "Hello" red', n),
  (e) => console.error(`52. ERROR: ${e}`)
);

// 53. Toggle color off (already red) → removes color
toggleColor(
  [{ type: "text", text: "Hello", color: "red" }],
  { startIndex: 0, startOffset: 0, endIndex: 0, endOffset: 5 },
  "red"
).match(
  (n) => log("53. Toggle color off → removes color", n),
  (e) => console.error(`53. ERROR: ${e}`)
);

// 54. Color + bold together — both preserved
toggleColor(
  [{ type: "text", text: "Hello", bold: true }],
  { startIndex: 0, startOffset: 0, endIndex: 0, endOffset: 5 },
  "blue"
).match(
  (n) => log("54. Color + bold → both preserved", n),
  (e) => console.error(`54. ERROR: ${e}`)
);

// 55. Color mid-node → splits into 3
toggleColor(paragraphBlock.content, {
  startIndex: 0, startOffset: 3,
  endIndex: 0,   endOffset: 8,
}, "green").match(
  (n) => log('55. Color mid-node "lo Wo" green → splits into 3', n),
  (e) => console.error(`55. ERROR: ${e}`)
);


// ─── deleteRange, splitBlock, mergeBlocks, toggleTodo tests ───────────────────

import { deleteRange, splitBlock, mergeBlocks } from "../src/engine/content";
import { toggleTodo } from "../src/engine/transform";

console.log("\n── deleteRange tests");

// "Hello World" → delete "lo Wo" (offset 3→8 in node 0)
deleteRange(paragraphBlock, 0, 3, 0, 8).match(
  (c) => log('56. Delete "lo Wo" → "Helrld"', c),
  (e) => console.error(`56. ERROR: ${e}`)
);

// Delete entire node content
deleteRange(paragraphBlock, 0, 0, 0, 11).match(
  (c) => log("57. Delete all → empty content", c),
  (e) => console.error(`57. ERROR: ${e}`)
);

// Delete across multiple nodes
const multiNode: Block<"paragraph"> = {
  id: v7(), type: "paragraph",
  content: [
    { type: "text", text: "Hello", bold: true },
    { type: "text", text: " World" },
  ],
  meta: {},
};
deleteRange(multiNode, 0, 3, 1, 3).match(
  (c) => log('58. Delete across nodes "lo Wo" → ["Hel", "rld"]', c),
  (e) => console.error(`58. ERROR: ${e}`)
);

// Delete in code block
deleteRange(codeBlock, 0, 6, 0, 9).match(
  (c) => log('59. Delete "= 1" from code block', c),
  (e) => console.error(`59. ERROR: ${e}`)
);

// Delete in equation block
deleteRange(equationBlock, 0, 1, 0, 3).match(
  (c) => log('60. Delete "^2" from equation → "x"', c),
  (e) => console.error(`60. ERROR: ${e}`)
);

// Edge — invalid range
deleteRange(paragraphBlock, 0, 8, 0, 3).inspectErr(
  (e) => console.error(`61. Invalid range → ${e}`)
);

console.log("\n── splitBlock tests");

// Split "Hello World" at offset 5 → ["Hello"] + ["World"]
splitBlock(paragraphBlock, 0, 5).match(
  ([a, b]) => { log('62. Split at offset 5 → block A', a); log('62. Split at offset 5 → block B', b); },
  (e) => console.error(`62. ERROR: ${e}`)
);

// Split at offset 0 → empty block A + full content in B
splitBlock(paragraphBlock, 0, 0).match(
  ([a, b]) => { log("63. Split at start → empty A", a); log("63. Split at start → full B", b); },
  (e) => console.error(`63. ERROR: ${e}`)
);

// Split at end → full content in A + empty B
splitBlock(paragraphBlock, 0, 11).match(
  ([a, b]) => { log("64. Split at end → full A", a); log("64. Split at end → empty B", b); },
  (e) => console.error(`64. ERROR: ${e}`)
);

// Split not supported for code
splitBlock(codeBlock, 0, 5).inspectErr(
  (e) => console.error(`65. Split code block → ${e}`)
);

console.log("\n── mergeBlocks tests");

const blockA: Block<"paragraph"> = {
  id: v7(), type: "paragraph",
  content: [{ type: "text", text: "Hello" }],
  meta: {},
};
const blockB: Block<"paragraph"> = {
  id: v7(), type: "paragraph",
  content: [{ type: "text", text: " World" }],
  meta: {},
};

// Merge two clean paragraphs → single node "Hello World"
mergeBlocks(blockA, blockB).match(
  (b) => log('66. Merge clean + clean → "Hello World"', b),
  (e) => console.error(`66. ERROR: ${e}`)
);

// Merge where boundary formats differ → two nodes preserved
const blockBold: Block<"paragraph"> = {
  id: v7(), type: "paragraph",
  content: [{ type: "text", text: " World", bold: true }],
  meta: {},
};
mergeBlocks(blockA, blockBold).match(
  (b) => log('67. Merge clean + bold → two nodes', b),
  (e) => console.error(`67. ERROR: ${e}`)
);

// Merge not supported for code
mergeBlocks(codeBlock, blockA).inspectErr(
  (e) => console.error(`68. Merge code block → ${e}`)
);

console.log("\n── toggleTodo tests");

const todoBlock: Block<"todo"> = {
  id: v7(), type: "todo",
  content: [{ type: "text", text: "Buy milk" }],
  meta: { depth: 0 },
};

// Toggle on → checked: true
toggleTodo(todoBlock).match(
  (b) => log("69. toggleTodo → checked", b),
  (e) => console.error(`69. ERROR: ${e}`)
);

// Toggle off → checked removed
toggleTodo({ ...todoBlock, meta: { depth: 0, checked: true } }).match(
  (b) => log("70. toggleTodo → unchecked", b),
  (e) => console.error(`70. ERROR: ${e}`)
);

// Not a todo block → Err
toggleTodo(paragraphBlock).inspectErr(
  (e) => console.error(`71. toggleTodo on paragraph → ${e}`)
);


// ─── indentBlock / outdentBlock tests ─────────────────────────────────────────

import { indentBlock, outdentBlock } from "../src/engine/transform";

console.log("\n── indentBlock / outdentBlock tests");

const bulletBlock: Block<"bullet"> = {
  id: v7(), type: "bullet",
  content: [{ type: "text", text: "Item" }],
  meta: { depth: 0 },
};

const deepBullet: Block<"bullet"> = {
  id: v7(), type: "bullet",
  content: [{ type: "text", text: "Deep item" }],
  meta: { depth: 6 },
};

const numberBlock: Block<"number"> = {
  id: v7(), type: "number",
  content: [{ type: "text", text: "Step 1" }],
  meta: { depth: 2 },
};

// 72. Indent bullet depth 0 → 1
indentBlock(bulletBlock).match(
  (b) => log("72. indent bullet depth 0 → 1", b),
  (e) => console.error(`72. ERROR: ${e}`)
);

// 73. Indent todo depth 0 → 1
indentBlock(todoBlock).match(
  (b) => log("73. indent todo depth 0 → 1", b),
  (e) => console.error(`73. ERROR: ${e}`)
);

// 74. Indent number depth 2 → 3
indentBlock(numberBlock).match(
  (b) => log("74. indent number depth 2 → 3", b),
  (e) => console.error(`74. ERROR: ${e}`)
);

// 75. Indent at max depth → Err
indentBlock(deepBullet).inspectErr(
  (e) => console.error(`75. indent at max depth → ${e}`)
);

// 76. Outdent bullet depth 1 → 0
indentBlock(bulletBlock)
  .andThen((b) => outdentBlock(b))
  .match(
    (b) => log("76. outdent bullet depth 1 → 0", b),
    (e) => console.error(`76. ERROR: ${e}`)
  );

// 77. Outdent number depth 2 → 1
outdentBlock(numberBlock).match(
  (b) => log("77. outdent number depth 2 → 1", b),
  (e) => console.error(`77. ERROR: ${e}`)
);

// 78. Outdent at depth 0 → Err
outdentBlock(bulletBlock).inspectErr(
  (e) => console.error(`78. outdent at depth 0 → ${e}`)
);

// 79. Indent paragraph → Err (not indentable)
indentBlock(paragraphBlock).inspectErr(
  (e) => console.error(`79. indent paragraph → ${e}`)
);

// 80. Outdent code → Err (not indentable)
outdentBlock(codeBlock).inspectErr(
  (e) => console.error(`80. outdent code → ${e}`)
);


// ─── toggleBold on mixed node array ───────────────────────────────────────────

console.log("\n── toggleBold on [text][code][text][text][equation][text]");

const mixedNodes: Node[] = [
  { type: "text",     text:  "Hello "              },  // index 0
  { type: "code",     text:  "x = 1"               },  // index 1
  { type: "text",     text:  " world"              },  // index 2
  { type: "text",     text:  " foo",  bold: true   },  // index 3
  { type: "equation", latex: "x^2"                 },  // index 4
  { type: "text",     text:  " bar"                },  // index 5
];

// 81. Bold within a single text node — no code/equation touched
toggleBold(mixedNodes, {
  startIndex: 0, startOffset: 0,
  endIndex: 0,   endOffset: 6,
}).match(
  (n) => log('81. Bold node[0] "Hello " only', n),
  (e) => console.error(`81. ERROR: ${e}`)
);

// 82. Bold node[2] text only
toggleBold(mixedNodes, {
  startIndex: 2, startOffset: 1,
  endIndex: 2,   endOffset: 6,
}).match(
  (n) => log('82. Bold node[2] "world" only', n),
  (e) => console.error(`82. ERROR: ${e}`)
);

// 83. Bold node[3] (already bold) → toggles off
toggleBold(mixedNodes, {
  startIndex: 3, startOffset: 0,
  endIndex: 3,   endOffset: 4,
}).match(
  (n) => log('83. Toggle off bold on node[3] "foo"', n),
  (e) => console.error(`83. ERROR: ${e}`)
);

// 84. Bold node[5] clean text → new bold node
toggleBold(mixedNodes, {
  startIndex: 5, startOffset: 0,
  endIndex: 5,   endOffset: 4,
}).match(
  (n) => log('84. Bold node[5] " bar"', n),
  (e) => console.error(`84. ERROR: ${e}`)
);

// 85. Selection starts on text, ends on text, but code node sits between — Err
toggleBold(mixedNodes, {
  startIndex: 0, startOffset: 0,
  endIndex: 2,   endOffset: 3,
}).match(
  (n) => log('85. Bold across node[0]→node[2] spanning code node[1]', n),
  (e) => console.error(`85. Selection spans code node → ${e}`)
);

// 86. Selection spanning equation node — Err
toggleBold(mixedNodes, {
  startIndex: 3, startOffset: 0,
  endIndex: 5,   endOffset: 4,
}).match(
  (n) => log('86. Bold across node[3]→node[5] spanning equation node[4]', n),
  (e) => console.error(`86. Selection spans equation node → ${e}`)
);

// 87. Selection starting ON a code node — Err
toggleBold(mixedNodes, {
  startIndex: 1, startOffset: 0,
  endIndex: 2,   endOffset: 3,
}).inspectErr(
  (e) => console.error(`87. Selection starts on code node → ${e}`)
);

// 88. Selection ending ON an equation node — Err
toggleBold(mixedNodes, {
  startIndex: 3, startOffset: 0,
  endIndex: 4,   endOffset: 3,
}).inspectErr(
  (e) => console.error(`88. Selection ends on equation node → ${e}`)
);

// 89. Bold node[2](clean)→node[3](bold) — not all bold → applies bold to both → merges into one node
toggleBold(mixedNodes, {
  startIndex: 2, startOffset: 0,
  endIndex: 3,   endOffset: 4,
}).match(
  (n) => log('89. Bold node[2]+node[3] → both bold → merge into " world foo"(bold)', n),
  (e) => console.error(`89. ERROR: ${e}`)
);


// ─── replaceRange tests ────────────────────────────────────────────────────────

import { replaceRange } from "../src/engine/content";

console.log("\n── replaceRange tests");

// "Hello World" → replace "Hello" with "Hey"
replaceRange(paragraphBlock, 0, 0, 0, 5, { type: "text", text: "Hey" }).match(
  (c) => log('90. Replace "Hello" with "Hey" → "Hey World"', c),
  (e) => console.error(`90. ERROR: ${e}`)
);

// Replace mid-word "lo Wo" with "p"
replaceRange(paragraphBlock, 0, 3, 0, 8, { type: "text", text: "p" }).match(
  (c) => log('91. Replace "lo Wo" with "p" → "Help rld"', c),
  (e) => console.error(`91. ERROR: ${e}`)
);

// Replace with bold text — surrounding clean text should not merge
replaceRange(paragraphBlock, 0, 6, 0, 11, { type: "text", text: "Earth", bold: true }).match(
  (c) => log('92. Replace "World" with "Earth"(bold) → ["Hello ", "Earth"(bold)]', c),
  (e) => console.error(`92. ERROR: ${e}`)
);

// Replace entire content with single node
replaceRange(paragraphBlock, 0, 0, 0, 11, { type: "text", text: "Hi" }).match(
  (c) => log('93. Replace all → "Hi"', c),
  (e) => console.error(`93. ERROR: ${e}`)
);

// Replace across multiple nodes
replaceRange(multiNode, 0, 3, 1, 3, { type: "text", text: "X" }).match(
  (c) => log('94. Replace across nodes → ["Hel"(bold), "Xrld"]', c),
  (e) => console.error(`94. ERROR: ${e}`)
);

// Replace with inline code node
replaceRange(paragraphBlock, 0, 6, 0, 11, { type: "code", text: "x + 1" }).match(
  (c) => log('95. Replace "World" with inline code node', c),
  (e) => console.error(`95. ERROR: ${e}`)
);

// Replace in code block
replaceRange(codeBlock, 0, 6, 0, 11, { type: "code", text: "2" }).match(
  (c) => log('96. Replace "= 1" in code block with "2"', c),
  (e) => console.error(`96. ERROR: ${e}`)
);

// Invalid range → Err
replaceRange(paragraphBlock, 0, 8, 0, 3, { type: "text", text: "x" }).inspectErr(
  (e) => console.error(`97. Invalid range → ${e}`)
);


// ─── serialize / deserialize tests ────────────────────────────────────────────

import { serialize, deserialize } from "../src/engine/serializer";

console.log("\n── serialize tests");

// 98. Serialize a valid block array → JSON string
serialize([paragraphBlock, codeBlock, equationBlock]).match(
  (json) => log("98. Serialize blocks → JSON", json),
  (e)    => console.error(`98. ERROR: ${e}`)
);

// 99. Serialize empty array
serialize([]).match(
  (json) => log("99. Serialize empty array", json),
  (e)    => console.error(`99. ERROR: ${e}`)
);

console.log("\n── deserialize tests");

// 100. Round-trip — serialize then deserialize
serialize([paragraphBlock, codeBlock, equationBlock])
  .andThen((json) => deserialize(json))
  .match(
    (blocks) => log("100. Round-trip serialize → deserialize", blocks),
    (e)      => console.error(`100. ERROR: ${e}`)
  );

// 101. Deserialize valid JSON manually
const validJson = JSON.stringify([
  { id: "abc", type: "paragraph", meta: {}, content: [{ type: "text", text: "Hello" }] },
  { id: "def", type: "code",      meta: {}, content: [{ type: "code", text: "x = 1" }] },
]);
deserialize(validJson).match(
  (blocks) => log("101. Deserialize valid JSON", blocks),
  (e)      => console.error(`101. ERROR: ${e}`)
);

// 102. Invalid JSON string → Err
deserialize("not json at all").inspectErr(
  (e) => console.error(`102. Invalid JSON → ${e}`)
);

// 103. Top level not array → Err
deserialize(JSON.stringify({ id: "abc", type: "paragraph" })).inspectErr(
  (e) => console.error(`103. Not an array → ${e}`)
);

// 104. Block missing id → Err
deserialize(JSON.stringify([
  { id: "", type: "paragraph", meta: {}, content: [] }
])).inspectErr(
  (e) => console.error(`104. Missing id → ${e}`)
);

// 105. Unknown block type → Err
deserialize(JSON.stringify([
  { id: "abc", type: "unknown", meta: {}, content: [] }
])).inspectErr(
  (e) => console.error(`105. Unknown block type → ${e}`)
);

// 106. code block with 0 content nodes → Err (must be tuple of 1)
deserialize(JSON.stringify([
  { id: "abc", type: "code", meta: {}, content: [] }
])).inspectErr(
  (e) => console.error(`106. code block empty content → ${e}`)
);

// 107. Node with unknown type → Err
deserialize(JSON.stringify([
  { id: "abc", type: "paragraph", meta: {}, content: [{ type: "image", src: "x.png" }] }
])).inspectErr(
  (e) => console.error(`107. Unknown node type → ${e}`)
);

// 108. code node missing text field → Err
deserialize(JSON.stringify([
  { id: "abc", type: "code", meta: {}, content: [{ type: "code" }] }
])).inspectErr(
  (e) => console.error(`108. code node missing text → ${e}`)
);


// ─── duplicateBlock / moveBlock tests ─────────────────────────────────────────

import { duplicateBlock, moveBlock } from "../src/utils/block";

console.log("\n── duplicateBlock tests");

// 109. Duplicate preserves all content, only id changes
const dup = duplicateBlock(paragraphBlock, "new-id-123");
log("109. Duplicate paragraph — new id, same content", dup);
console.log("109. id changed:", dup.id !== paragraphBlock.id);
console.log("109. content same:", JSON.stringify(dup.content) === JSON.stringify(paragraphBlock.content));

console.log("\n── moveBlock tests");

const blocks: AnyBlock[] = [paragraphBlock, codeBlock, equationBlock, boldParagraph];

// 110. Move second block up
moveBlock(blocks, codeBlock.id, "up").match(
  (b) => log("110. Move codeBlock up → now at index 0", b.map(x => x.type)),
  (e) => console.error(`110. ERROR: ${e}`)
);

// 111. Move second block down
moveBlock(blocks, codeBlock.id, "down").match(
  (b) => log("111. Move codeBlock down → now at index 2", b.map(x => x.type)),
  (e) => console.error(`111. ERROR: ${e}`)
);

// 112. Move first block up → no change (already at top)
moveBlock(blocks, paragraphBlock.id, "up").match(
  (b) => log("112. Move first block up → unchanged", b.map(x => x.type)),
  (e) => console.error(`112. ERROR: ${e}`)
);

// 113. Move last block down → no change (already at bottom)
moveBlock(blocks, boldParagraph.id, "down").match(
  (b) => log("113. Move last block down → unchanged", b.map(x => x.type)),
  (e) => console.error(`113. ERROR: ${e}`)
);

// 114. Unknown id → Err
moveBlock(blocks, "does-not-exist", "up").inspectErr(
  (e) => console.error(`114. Unknown id → ${e}`)
);


// ─── serializeNodes / deserializeNodes / toPlainText tests ────────────────────

import { serializeNodes, deserializeNodes, toPlainText } from "../src/engine/serializer";

console.log("\n── serializeNodes tests");

const richNodes: Node[] = [
  { type: "text",     text:  "Hello",  bold: true       },
  { type: "text",     text:  " World"                   },
  { type: "code",     text:  "x = 1"                   },
  { type: "equation", latex: "x^2"                     },
  { type: "text",     text:  " end",   italic: true     },
];

// 115. Serialize nodes → JSON string with formatting preserved
serializeNodes(richNodes).match(
  (json) => log("115. serializeNodes → JSON", json),
  (e)    => console.error(`115. ERROR: ${e}`)
);

// 116. Round-trip — serialize then deserialize
serializeNodes(richNodes)
  .andThen((json) => deserializeNodes(json))
  .match(
    (nodes) => log("116. Round-trip serializeNodes → deserializeNodes", nodes),
    (e)     => console.error(`116. ERROR: ${e}`)
  );

// 117. Serialize empty nodes
serializeNodes([]).match(
  (json) => log("117. Serialize empty nodes", json),
  (e)    => console.error(`117. ERROR: ${e}`)
);

console.log("\n── deserializeNodes tests");

// 118. Valid JSON array of nodes
deserializeNodes(JSON.stringify([
  { type: "text", text: "Hello", bold: true },
  { type: "code", text: "x = 1" },
])).match(
  (nodes) => log("118. Deserialize valid nodes", nodes),
  (e)     => console.error(`118. ERROR: ${e}`)
);

// 119. Invalid JSON → Err
deserializeNodes("not json").inspectErr(
  (e) => console.error(`119. Invalid JSON → ${e}`)
);

// 120. Not an array → Err
deserializeNodes(JSON.stringify({ type: "text", text: "hi" })).inspectErr(
  (e) => console.error(`120. Not an array → ${e}`)
);

// 121. Unknown node type → Err
deserializeNodes(JSON.stringify([{ type: "image", src: "x.png" }])).inspectErr(
  (e) => console.error(`121. Unknown node type → ${e}`)
);

// 122. text node missing text field → Err
deserializeNodes(JSON.stringify([{ type: "text" }])).inspectErr(
  (e) => console.error(`122. text node missing text → ${e}`)
);

console.log("\n── toPlainText tests");

// 123. Mixed nodes → plain string
const plain = toPlainText(richNodes);
log("123. toPlainText mixed nodes", plain);
// expected: "Hello Worldx = 1x^2 end"

// 124. Empty nodes → empty string
log("124. toPlainText empty", toPlainText([]));

// 125. Only equation nodes
log("125. toPlainText equation only", toPlainText([
  { type: "equation", latex: "x^2 + y^2" },
]));


// ─── toMarkdown tests ──────────────────────────────────────────────────────────

import { toMarkdown } from "../src/engine/serializer";

console.log("\n── toMarkdown tests");

const markdownBlocks: AnyBlock[] = [
  { id: v7(), type: "heading1",  content: [{ type: "text", text: "Title" }],                                    meta: {} },
  { id: v7(), type: "paragraph", content: [{ type: "text", text: "Hello ", bold: true }, { type: "text", text: "world" }], meta: {} },
  { id: v7(), type: "bullet",    content: [{ type: "text", text: "Item 1" }],                                   meta: { depth: 0 } },
  { id: v7(), type: "bullet",    content: [{ type: "text", text: "Nested" }],                                   meta: { depth: 1 } },
  { id: v7(), type: "number",    content: [{ type: "text", text: "Step 1" }],                                   meta: { depth: 0 } },
  { id: v7(), type: "todo",      content: [{ type: "text", text: "Done" }],                                     meta: { depth: 0, checked: true } },
  { id: v7(), type: "todo",      content: [{ type: "text", text: "Pending" }],                                  meta: { depth: 0 } },
  { id: v7(), type: "code",      content: [{ type: "code", text: "const x = 1" }],                             meta: { language: "ts" } },
  { id: v7(), type: "equation",  content: [{ type: "equation", latex: "x^2 + y^2" }],                         meta: {} },
];

// 126. Full block array → markdown string
log("126. toMarkdown full block array", toMarkdown(markdownBlocks));

// 127. Inline formatting
log("127. toMarkdown inline formatting", toMarkdown([{
  id: v7(), type: "paragraph",
  content: [
    { type: "text", text: "bold",          bold: true },
    { type: "text", text: " italic",       italic: true },
    { type: "text", text: " strike",       strikethrough: true },
    { type: "text", text: " link",         link: "https://example.com" },
    { type: "code", text: "inline code"   },
    { type: "equation", latex: "x^2"      },
  ],
  meta: {},
}]));

// 128. Empty blocks array
log("128. toMarkdown empty", toMarkdown([]));

// ─── history tests ─────────────────────────────────────────────────────────────

import { createHistory, push, undo, redo, canUndo, canRedo, currentBlocks } from "../src/engine/history";

console.log("\n── history tests");

const state0 = [paragraphBlock];
const state1 = [paragraphBlock, codeBlock];
const state2 = [paragraphBlock, codeBlock, equationBlock];

let h = createHistory(state0);
log("129. Initial history", { canUndo: canUndo(h), canRedo: canRedo(h), blocks: currentBlocks(h).map(b => b.type) });

// 130. Push new state
h = push(h, state1);
log("130. After push state1", { canUndo: canUndo(h), canRedo: canRedo(h), blocks: currentBlocks(h).map(b => b.type) });

// 131. Push again
h = push(h, state2);
log("131. After push state2", { past: h.past.length, blocks: currentBlocks(h).map(b => b.type) });

// 132. Undo → back to state1
undo(h).match(
  (h2) => log("132. Undo → state1", { blocks: currentBlocks(h2).map(b => b.type), future: h2.future.length }),
  (e)  => console.error(`132. ERROR: ${e}`)
);

// 133. Undo twice → back to state0
undo(h)
  .andThen((h2) => undo(h2))
  .match(
    (h2) => log("133. Undo twice → state0", { blocks: currentBlocks(h2).map(b => b.type) }),
    (e)  => console.error(`133. ERROR: ${e}`)
  );

// 134. Undo then redo → back to state2
undo(h)
  .andThen((h2) => redo(h2))
  .match(
    (h2) => log("134. Undo then redo → state2", { blocks: currentBlocks(h2).map(b => b.type) }),
    (e)  => console.error(`134. ERROR: ${e}`)
  );

// 135. Undo past beginning → Err
undo(h)
  .andThen((h2) => undo(h2))
  .andThen((h2) => undo(h2))
  .inspectErr((e) => console.error(`135. Undo past beginning → ${e}`));

// 136. Redo with no future → Err
redo(h).inspectErr(
  (e) => console.error(`136. Redo with no future → ${e}`)
);

// 137. Push after undo clears future
undo(h).match(
  (h2) => {
    const h3 = push(h2, [boldParagraph]);
    log("137. Push after undo → future cleared", { future: h3.future.length, blocks: currentBlocks(h3).map(b => b.type) });
  },
  (e) => console.error(`137. ERROR: ${e}`)
);

// 138. maxSize cap — push 3 states with maxSize=2
let hCapped = createHistory(state0);
hCapped = push(hCapped, state1, 2);
hCapped = push(hCapped, state2, 2);
hCapped = push(hCapped, [boldParagraph], 2);
log("138. maxSize=2 — past capped at 2", { pastLength: hCapped.past.length });