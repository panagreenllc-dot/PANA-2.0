// Run: npx tsx lib/ids.test.ts   
import assert from "node:assert/strict";
import { parseProjectId } from "./ids";

assert.equal(parseProjectId("42"), "42");
assert.equal(parseProjectId(7), "7");
assert.equal(parseProjectId(" 9 "), "9");
assert.equal(
  parseProjectId("3F2504E0-4F89-11D3-9A0C-0305E82C3301"),
  "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
);
assert.equal(parseProjectId("550e8400-e29b-41d4-a716-446655440000"), "550e8400-e29b-41d4-a716-446655440000");
for (const bad of ["", "0", "-1", "1.5", "abc", "12abc", "550e8400-e29b-41d4-a716", "1; DROP TABLE projects", null, undefined, {}]) {
  assert.equal(parseProjectId(bad), null, `should reject ${String(bad)}`);
}
console.log("parseProjectId: all tests passed");
