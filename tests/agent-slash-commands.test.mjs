import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const source = await readFile(new URL("../app/lib/agentSlashCommands.ts", import.meta.url), "utf8");
const record = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { exports: record.exports });
const { AGENT_SLASH_COMMANDS: commands, getAgentSlashMatches: match, resolveAgentSlashCommand: resolve, getAgentSlashSelection: selection, agentSlashHelp } = record.exports;

test("slash opens all commands and supports prefix, Chinese labels and aliases", () => {
  assert.equal(match("/").length, 6);
  assert.equal(match(" /fi")[0].id, "files");
  assert.equal(match("/帮助")[0].id, "help");
  assert.equal(match("/ls")[0].id, "files");
  assert.equal(match("/STATUS")[0].id, "status");
});
test("prose, whitespace and multiline drafts never accidentally open completion", () => {
  for (const input of ["hello", "解释 /help", "/help ", "/help\nmore"]) assert.equal(match(input), null);
  assert.equal(match("/not-found").length, 0);
});
test("streaming only exposes stop, clear and exit", () => {
  assert.deepEqual(Array.from(match("/", true), (item) => item.id), ["stop", "clear", "exit"]);
  assert.equal(match("/help", true).length, 0);
});
test("commands resolve exactly without interpreting arguments or shell syntax", () => {
  for (const command of commands) assert.equal(resolve(command.command).id, command.id);
  assert.equal(resolve(" /CLS ").id, "clear");
  assert.equal(resolve("help").id, "help");
  assert.equal(resolve("/ls").id, "files");
  for (const input of ["/help extra", "/stop;ls", "/unknown", "normal text"]) assert.equal(resolve(input), undefined);
});
test("help is derived from the same registry as the menu", () => {
  for (const command of commands) assert.ok(agentSlashHelp().includes(command.command));
});


test("a selected stop command stays selected when the streaming reply completes", () => {
  const busy = match("/", true);
  const idle = match("/", false);
  assert.equal(busy[selection(busy, "stop")].id, "stop");
  assert.equal(idle[selection(idle, "stop")].id, "stop");
  assert.equal(selection([], "stop"), 0);
});
