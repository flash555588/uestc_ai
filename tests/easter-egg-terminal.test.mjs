import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const source = await readFile(new URL("../app/lib/easterEggTerminal.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
const moduleRecord = { exports: {} };
vm.runInNewContext(compiled, { exports: moduleRecord.exports });
const { createTerminalState, terminalReducer: reduce, terminalPrompt, MAX_TERMINAL_TABS } = moduleRecord.exports;
const run = (state, command = "agent") => reduce(state, { type: "execute", command, result: { kind: "agent" } });

test("profiles use Windows prompts and preserve independent tab sessions", () => {
  let state = run(createTerminalState());
  state = reduce(state, { type: "new", profile: "cmd" });
  assert.equal(state.tabs[1].entries.length, 0);
  assert.equal(state.tabs[0].entries.length, 1);
  assert.equal(terminalPrompt("cmd"), "C:\\Users\\visitor\\workspace>");
  assert.equal(terminalPrompt("powershell"), "PS C:\\Users\\visitor\\workspace>");
  state = reduce(state, { type: "select", id: 1 });
  assert.equal(state.activeId, 1);
});

test("history up/down restores an unfinished input draft", () => {
  let state = run(createTerminalState());
  state = reduce(state, { type: "input", value: "gem" });
  state = reduce(state, { type: "history", direction: -1 });
  assert.equal(state.tabs[0].input, "agent");
  state = reduce(state, { type: "history", direction: 1 });
  assert.equal(state.tabs[0].input, "gem");
});

test("cls clears only the active screen and keeps command history", () => {
  let state = run(createTerminalState());
  state = reduce(state, { type: "execute", command: "cls", result: { kind: "clear" } });
  assert.equal(state.tabs[0].showBanner, false);
  assert.equal(state.tabs[0].entries.length, 0);
  assert.equal(state.tabs[0].history.length, 2);
});

test("close selects an adjacent tab; closing the last tab resets a valid session", () => {
  let state = reduce(createTerminalState(), { type: "new", profile: "cmd" });
  state = reduce(state, { type: "close", id: state.activeId });
  assert.equal(state.tabs.length, 1);
  assert.equal(state.activeId, 1);
  state = reduce(state, { type: "execute", command: "exit", result: { kind: "exit" } });
  assert.equal(state.tabs.length, 1);
  assert.equal(state.tabs[0].entries.length, 0);
  assert.equal(state.tabs[0].id, state.activeId);
});

test("tabs, scrollback, history and input remain bounded", () => {
  let state = createTerminalState();
  for (let index = 0; index < 20; index++) state = reduce(state, { type: "new", profile: "powershell" });
  assert.equal(state.tabs.length, MAX_TERMINAL_TABS);
  for (let index = 0; index < 120; index++) state = run(state);
  const tab = state.tabs.find((item) => item.id === state.activeId);
  assert.equal(tab.entries.length, 40);
  assert.equal(tab.history.length, 100);
  state = reduce(state, { type: "input", value: "x".repeat(100) });
  assert.equal(state.tabs.find((item) => item.id === state.activeId).input.length, 100);
});

test("agent enters the virtual chat and returns without destroying shell history", () => {
  let state = run(createTerminalState());
  assert.equal(state.tabs[0].app, "agent");
  state = reduce(state, { type: "leave-agent", id: state.activeId });
  assert.equal(state.tabs[0].app, "shell");
  assert.equal(state.tabs[0].history[0], "agent");
  assert.equal(state.tabs[0].input, "");
});

test("directory changes update the prompt without rewriting previous history", () => {
  let state = createTerminalState();
  state = reduce(state, { type: "execute", command: "cd docs", result: { kind: "message", lines: [], cwd: "/workspace/docs" } });
  assert.equal(state.tabs[0].cwd, "/workspace/docs");
  assert.equal(state.tabs[0].entries[0].prompt, "PS C:\\Users\\visitor\\workspace>");
  assert.equal(terminalPrompt("powershell", state.tabs[0].cwd), "PS C:\\Users\\visitor\\workspace\\docs>");
});
