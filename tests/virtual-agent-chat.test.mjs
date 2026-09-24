import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const source = await readFile(new URL("../app/lib/virtualAgentChat.ts", import.meta.url), "utf8");
const record = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { exports: record.exports });
const { createAgentChatState: initial, agentChatReducer: reduce } = record.exports;
function send(state, animate = true) { return reduce(reduce(state, { type: "draft", value: "你好" }), { type: "send", reply: "你好，这是一条模拟回复。", animate }); }

test("input produces a simulated turn, streaming advances and completes", () => {
  let state = send(initial());
  assert.equal(state.turns[0].status, "streaming");
  assert.equal(state.turns[0].visible, 0);
  for (let index = 0; index < 10; index++) state = reduce(state, { type: "tick", id: 1 });
  assert.equal(state.turns[0].status, "done");
  assert.equal(state.turns[0].visible, Array.from(state.turns[0].reply).length);
});
test("stop freezes output and clear invalidates pending ticks", () => {
  let state = send(initial());
  state = reduce(state, { type: "tick", id: 1 });
  state = reduce(state, { type: "stop" });
  const visible = state.turns[0].visible;
  state = reduce(state, { type: "tick", id: 1 });
  assert.equal(state.turns[0].visible, visible);
  assert.equal(state.turns[0].status, "stopped");
  state = reduce(state, { type: "clear" });
  state = reduce(state, { type: "tick", id: 1 });
  assert.equal(state.turns.length, 0);
});
test("reduced-motion mode reveals immediately and busy sends cannot overlap", () => {
  assert.equal(send(initial(), false).turns[0].status, "done");
  let state = send(initial()); state = send(state);
  assert.equal(state.turns.length, 1);
});
test("draft and transcript lengths are bounded", () => {
  let state = reduce(initial(), { type: "draft", value: "x".repeat(4000) });
  assert.equal(state.draft.length, 2000);
  for (let index = 0; index < 30; index++) state = send(state, false);
  assert.equal(state.turns.length, 20);
});
