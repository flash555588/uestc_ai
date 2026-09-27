import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const source = await readFile(new URL("../app/lib/easterEgg.ts", import.meta.url), "utf8");
const moduleRecord = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: moduleRecord.exports });
const { advanceSequence, resolveTerminalCommand: run, resolveVirtualPath, virtualAgentReply, ENTRY_SEQUENCE } = moduleRecord.exports;
function enter(keys) { let progress = 0, completions = 0; for (const code of keys) { const next = advanceSequence(progress, code); progress = next.progress; if (next.completed) completions++; } return { progress, completions }; }

test("keyboard entry preserves overlapping starts and can repeat", () => {
  assert.equal(enter(ENTRY_SEQUENCE).completions, 1);
  assert.equal(enter([...ENTRY_SEQUENCE, ...ENTRY_SEQUENCE]).completions, 2);
  assert.equal(enter(["ArrowUp", ...ENTRY_SEQUENCE]).completions, 1);
});
test("agent is the sole launch command; old provider commands are removed", () => {
  assert.equal(run(" AGENT ").kind, "agent");
  for (const command of ["codex", "claude", "cluade", "gemini", "opencode", "qwen", "agent extra"]) assert.equal(run(command).kind, "message");
  assert.equal(run("clear").kind, "clear");
  assert.equal(run("cls").kind, "clear");
  assert.equal(run("exit").kind, "exit");
});
test("help, ls and pwd describe only the virtual workspace", () => {
  assert.ok(run("help").lines.join().includes("agent"));
  assert.ok(run("ls").lines.join().includes("README.md"));
  assert.ok(run("dir").lines.join().includes("docs/"));
  assert.equal(run("pwd").lines[0], "C:\\Users\\visitor\\workspace");
});
test("cd and cat support relative, parent, quoted and Windows virtual paths", () => {
  assert.equal(run("cd docs").cwd, "/workspace/docs");
  assert.ok(run('cat "guide.md"', "/workspace/docs").lines.join().includes("使用说明"));
  assert.equal(run("cd ..", "/workspace/docs").cwd, "/workspace");
  assert.equal(run("cd ..").cwd, "/workspace");
  assert.equal(run("cd C:\\Users\\visitor\\workspace\\examples").cwd, "/workspace/examples");
  assert.ok(run("cat readme.md").lines.join().includes("UESTC AI"));
});
test("invalid paths, quotes and shell operators never dispatch execution", () => {
  assert.equal(resolveVirtualPath("/etc/passwd"), null);
  assert.equal(resolveVirtualPath("C:\\Windows"), null);
  for (const command of ['cat "unfinished', "ls && agent", "agent; ls", "cat __proto__", "cd missing", "cat docs"]) assert.equal(run(command).kind, "message");
});
test("virtual replies are deterministic and grounded in the preset workspace", () => {
  assert.ok(virtualAgentReply("看看目录").includes("README.md"));
  assert.ok(virtualAgentReply("给我代码示例").includes("export function greet"));
  assert.ok(virtualAgentReply("help").includes("本地预设模板"));
  assert.equal(virtualAgentReply("做一个校园助手"), virtualAgentReply("做一个校园助手"));
});

test("greetings do not accidentally dispatch the code-example reply", () => {
  assert.ok(virtualAgentReply("hello").includes("你好"));
  assert.ok(!virtualAgentReply("hello").includes("export function"));
});

test("the removed footer clue is absent while the keyboard trigger stays available", async () => {
  const component = await readFile(new URL("../app/components/EasterEggEntrance.tsx", import.meta.url), "utf8");
  assert.ok(!component.includes("egg-mark"));
  assert.ok(!component.includes("hintGroups"));
  assert.ok(component.includes('window.addEventListener("keydown"'));
  assert.ok(component.includes("<EasterEggTerminal"));
});
