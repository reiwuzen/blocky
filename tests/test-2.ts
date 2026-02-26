import { Block, changeBlockType } from "../src/index";

const block: Block<"bullet"> = {
  id: "b-2",
  type: "bullet",
  meta: { depth: 5 },
  content: [
    {
      type: "text",
      text: "Nested bullet — Tab to indent, Shift+Tab to outdent",
    },
  ],
};

console.log(changeBlockType(block, "number").unwrap());
