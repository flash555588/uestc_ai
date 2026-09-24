import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const source = await readFile(new URL("../app/lib/terminalColorArt.ts", import.meta.url), "utf8");
const moduleRecord = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { exports: moduleRecord.exports });
const { colorizeTerminalArt, buildColoredConsoleArt, CONSOLE_ART_COLORS } = moduleRecord.exports;
const logo = await readFile(new URL("../public/terminal-art/uestc-ai.txt", import.meta.url), "utf8");

test("color segments preserve the latest user-supplied block artwork exactly", () => {
  const rows = colorizeTerminalArt(logo);
  assert.equal(rows.map((segments) => segments.map((segment) => segment.text).join("")).join("\n"), logo);
  assert.equal(rows.length, logo.split("\n").length);
});
test("the same user-supplied color sequence drives page spans and console %c styles", () => {
  const rows = colorizeTerminalArt(logo);
  const segments = rows.flat();
  const { format, styles } = buildColoredConsoleArt(logo);
  assert.equal(CONSOLE_ART_COLORS.length, 17);
  assert.equal(segments[0].color, "#ff0000");
  assert.equal(segments.at(-1).color, "#00E0F9");
  assert.equal((format.match(/%c/g) ?? []).length, styles.length);
  assert.equal(format.replaceAll("%c", ""), logo);
  assert.deepEqual(Array.from(styles), Array.from(segments, (segment) => `color:${segment.color};font-family:monospace`));
});
test("empty and single-line input remain valid", () => {
  assert.equal(buildColoredConsoleArt("").format, "");
  assert.equal(buildColoredConsoleArt("abc").format.replaceAll("%c", ""), "abc");
});

test("the active welcome asset uses eight rows of user-provided blocks, not dots or slashes", async () => {
  const source = await readFile(new URL("../app/lib/terminalWelcomeArt.ts", import.meta.url), "utf8");
  const record = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: record.exports });
  assert.equal(record.exports.TERMINAL_WELCOME_ART, logo);
  assert.equal(logo.trimEnd().split("\n").length, 8);
  assert.ok(logo.includes("█") && logo.includes("▒"));
  assert.ok(!/[\u2800-\u28ff/\\]/.test(logo));
  const view = await readFile(new URL("../app/components/TerminalWelcomeArt.tsx", import.meta.url), "utf8");
  assert.ok(view.includes("TERMINAL_WELCOME_ART"));
  assert.ok(!view.includes("CODEX_ONBOARDING_LOGO"));
});
