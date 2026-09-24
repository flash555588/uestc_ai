import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/lib/markdownDisplay.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { stripRepeatedLead } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("detail markdown removes only repeated leading title and summary", () => {
  assert.equal(
    stripRepeatedLead("# 题目\n\n摘要\n\n## 提交要求", "题目", "摘要"),
    "## 提交要求",
  );
  assert.equal(
    stripRepeatedLead("# 另一标题\n\n正文", "题目", "摘要"),
    "# 另一标题\n\n正文",
  );
  assert.equal(
    stripRepeatedLead("开场段落\n\n正文", "题目", "摘要"),
    "开场段落\n\n正文",
  );
});
