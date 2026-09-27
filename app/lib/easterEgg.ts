/** Local demo data and command routing. No user string is executed as code or a shell command. */
export const ENTRY_SEQUENCE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "KeyB", "KeyA"] as const;
export const VIRTUAL_ROOT = "/workspace";
export const VIRTUAL_FILES: Record<string, string> = {
  "/workspace/README.md": "# UESTC AI 虚拟工作区\n\n这是一个可交互的本地演示，不是你的真实文件系统。\n\n- 输入 agent 打开虚拟 Agent 对话\n- docs/guide.md：使用说明\n- examples/hello.ts：示例代码\n- notes/ideas.md：项目灵感\n",
  "/workspace/docs/guide.md": "# 使用说明\n\n终端：help、ls、dir、pwd、cd、cat、clear、cls、exit。\n对话：输入问题后回车，Shift+Enter 换行。\n输入 / 打开命令菜单；↑↓ 选择，Enter 执行，Tab 补全，Esc 收起。\nhelp 查看例子，clear 清空对话，exit 返回终端。\n所有输出均为本地模拟，不调用 AI 服务、不操作本机文件。\n",
  "/workspace/examples/hello.ts": "export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet('UESTC AI'));\n",
  "/workspace/notes/ideas.md": "# 灵感清单\n\n1. 校园知识问答助手\n2. 竞赛资料整理工具\n3. 可复现的模型实验记录\n",
};
export type TerminalResult = { kind: "agent" } | { kind: "message"; lines: string[]; cwd?: string } | { kind: "clear" | "exit" };

export function advanceSequence(progress: number, code: string): { progress: number; completed: boolean } {
  const observed = [...ENTRY_SEQUENCE.slice(0, progress), code];
  if (observed.length === ENTRY_SEQUENCE.length && observed.every((key, index) => key === ENTRY_SEQUENCE[index])) return { progress: 0, completed: true };
  for (let length = Math.min(observed.length, ENTRY_SEQUENCE.length - 1); length > 0; length--) {
    if (observed.slice(-length).every((key, index) => key === ENTRY_SEQUENCE[index])) return { progress: length, completed: false };
  }
  return { progress: 0, completed: false };
}

export function resolveVirtualPath(input: string, cwd = VIRTUAL_ROOT): string | null {
  let value = input.replaceAll("\\", "/");
  if (/^[a-z]:/i.test(value)) {
    if (!/^c:\/users\/visitor\/workspace(?:\/|$)/i.test(value)) return null;
    value = value.replace(/^c:\/users\/visitor\/workspace/i, VIRTUAL_ROOT);
  }
  if (value === "~" || value === "/") value = VIRTUAL_ROOT;
  if (value.startsWith("~/")) value = VIRTUAL_ROOT + value.slice(1);
  const parts = (value.startsWith("/") ? [] : cwd.split("/").filter(Boolean));
  for (const part of value.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (parts.length > 1) parts.pop(); continue; }
    parts.push(part);
  }
  if (parts[0]?.toLowerCase() !== "workspace") return null;
  const result = "/" + parts.join("/");
  const paths = [VIRTUAL_ROOT, ...Object.keys(VIRTUAL_FILES), ...Object.keys(VIRTUAL_FILES).map((path) => path.slice(0, path.lastIndexOf("/")))];
  return paths.find((path) => path.toLowerCase() === result.toLowerCase()) ?? result;
}

function isDirectory(path: string): boolean {
  return path === VIRTUAL_ROOT || Object.keys(VIRTUAL_FILES).some((file) => file.startsWith(path + "/"));
}
function displayPath(path: string): string { return "C:\\Users\\visitor" + path.replaceAll("/", "\\"); }
function tokenize(raw: string): string[] | null {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|([^\s"']+)/g;
  let consumed = 0;
  for (const match of raw.matchAll(pattern)) {
    if (raw.slice(consumed, match.index).trim()) return null;
    tokens.push(match[1] ?? match[2] ?? match[3]);
    consumed = match.index! + match[0].length;
  }
  return raw.slice(consumed).trim() ? null : tokens;
}

export function resolveTerminalCommand(raw: string, cwd = VIRTUAL_ROOT): TerminalResult {
  const message = (...lines: string[]): TerminalResult => ({ kind: "message", lines });
  const tokens = tokenize(raw.trim());
  if (!tokens) return message("引号没有闭合。请检查命令。 ");
  const [name = "", ...args] = tokens;
  const command = name.toLowerCase();
  if (!command) return message();
  if (["agent", "help", "clear", "cls", "exit", "pwd"].includes(command) && args.length) return message(`用法：${command}`);
  if (command === "agent") return { kind: "agent" };
  if (command === "clear" || command === "cls") return { kind: "clear" };
  if (command === "exit") return { kind: "exit" };
  if (command === "pwd") return message(displayPath(cwd));
  if (command === "help") return message("UESTC AI · 虚拟终端", "", "agent          进入虚拟 Agent 对话", "ls / dir [路径] 列出虚拟文件", "pwd            显示当前虚拟目录", "cd [路径]       切换虚拟目录；cd .. 返回上级", "cat <文件>      查看预设文件内容", "clear / cls    清屏", "exit           关闭当前终端标签页", "", "仅在内存中运行，不执行系统命令，不访问真实文件。 ");
  if (["ls", "dir", "cd", "cat"].includes(command)) {
    if (args.length > 1 || (command === "cat" && args.length !== 1)) return message(`用法：${command} ${command === "cat" ? "<文件>" : "[路径]"}`);
    const path = resolveVirtualPath(args[0] ?? (command === "cd" ? VIRTUAL_ROOT : cwd), cwd);
    if (!path) return message("路径超出虚拟工作区。");
    if (command === "cd") return isDirectory(path) ? { kind: "message", lines: [], cwd: path } : message(`目录不存在：${args[0]}`);
    if (command === "cat") return Object.hasOwn(VIRTUAL_FILES, path) ? message(...VIRTUAL_FILES[path].trimEnd().split("\n")) : message(`文件不存在或不是文本文件：${args[0]}`);
    if (Object.hasOwn(VIRTUAL_FILES, path)) return message(path.slice(path.lastIndexOf("/") + 1));
    if (!isDirectory(path)) return message(`路径不存在：${args[0]}`);
    const entries = new Set(Object.keys(VIRTUAL_FILES).filter((file) => file.startsWith(path + "/")).map((file) => {
      const relative = file.slice(path.length + 1);
      return relative.includes("/") ? relative.split("/")[0] + "/" : relative;
    }));
    return message(`目录：${displayPath(path)}  [虚拟]`, "", ...Array.from(entries).sort().map((entry) => `${entry.endsWith("/") ? "<DIR> " : "      "} ${entry}`));
  }
  return message(`未识别命令：${name.slice(0, 48)}`, "输入 help 查看命令，输入 agent 开始对话。");
}

/** Deliberately canned responses for an explicitly labelled virtual-agent demonstration. */
export function virtualAgentReply(input: string, cwd = VIRTUAL_ROOT): string {
  const text = input.trim();
  if (/^(help|\/help|帮助)$/i.test(text)) return "可以试试：\n• 介绍这个虚拟项目\n• 看看当前目录\n• 给我一个 TypeScript 示例\n• 帮我规划校园助手\n\nEnter 发送，Shift+Enter 换行。clear 清空对话，exit 返回终端。\n这些回复来自本地预设模板。";
  if (/目录|文件|\bls\b|\bdir\b/i.test(text)) {
    const result = resolveTerminalCommand("ls", cwd);
    return "当前虚拟工作区的内容如下：\n\n" + (result.kind === "message" ? result.lines.join("\n") : "");
  }
  if (/代码|函数|typescript|示例/i.test(text)) return "可以先从这个最小 TypeScript 示例开始：\n\n" + VIRTUAL_FILES["/workspace/examples/hello.ts"] + "\n它接收一个名字并返回问候语。代码只作为文本展示，没有执行或写入文件。";
  if (/项目|介绍|readme|总结/i.test(text)) return "这是 UESTC AI 的虚拟工作区。\n\nREADME.md 介绍入口；docs/guide.md 保存使用说明；examples/hello.ts 提供代码样例；notes/ideas.md 记录项目灵感。\n\n你可以先探索文件，再提出一个目标，让这个演示会话展示下一步计划。";
  if (/^(你好|hi|hello|嗨)[!！。\s]*$/i.test(text)) return "你好，我是 UESTC AI 虚拟 Agent。\n\n你可以让我介绍虚拟项目、列出文件、展示代码，或者为一个想法整理步骤。";
  if (/停止|stop/i.test(text)) return "已停止当前演示流程。你可以输入新的问题，或输入 exit 返回终端。";
  return `收到，你想完成的是：\n“${text.slice(0, 240)}${text.length > 240 ? "…" : ""}”\n\n可以这样推进：\n1. 明确使用者、输入内容和预期结果。\n2. 先做一个能验证核心流程的最小原型。\n3. 用正常、空输入和失败场景检查结果。\n\n你想先细化方案，还是看一个代码示例？`;
}
