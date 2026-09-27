export type AgentCommandId = "help" | "files" | "status" | "clear" | "stop" | "exit";
export type AgentSlashCommand = { id: AgentCommandId; command: string; label: string; description: string; aliases: readonly string[]; whileStreaming: boolean };
export const AGENT_SLASH_COMMANDS: readonly AgentSlashCommand[] = [
  { id: "help", command: "/help", label: "帮助", description: "查看命令与对话示例", aliases: ["help", "帮助", "?"], whileStreaming: false },
  { id: "files", command: "/files", label: "虚拟文件", description: "列出当前虚拟目录", aliases: ["/ls", "/dir"], whileStreaming: false },
  { id: "status", command: "/status", label: "会话状态", description: "查看本地模拟状态", aliases: [], whileStreaming: false },
  { id: "clear", command: "/clear", label: "清空对话", description: "清空记录并停止当前输出", aliases: ["clear", "cls", "/cls"], whileStreaming: true },
  { id: "stop", command: "/stop", label: "停止输出", description: "保留已经显示的模拟回复", aliases: ["stop"], whileStreaming: true },
  { id: "exit", command: "/exit", label: "返回终端", description: "退出虚拟 Agent 对话页", aliases: ["exit"], whileStreaming: true },
];

export function resolveAgentSlashCommand(input: string): AgentSlashCommand | undefined {
  const query = input.trim().toLowerCase();
  return AGENT_SLASH_COMMANDS.find((item) => item.command === query || item.aliases.includes(query));
}

/** Only a single slash-prefixed token opens completion; prose and multiline drafts do not. */
export function getAgentSlashMatches(input: string, streaming = false): AgentSlashCommand[] | null {
  const value = input.trimStart();
  if (!value.startsWith("/") || /\s/.test(value)) return null;
  const query = value.slice(1).toLowerCase();
  const matches = AGENT_SLASH_COMMANDS.filter((item) => (!streaming || item.whileStreaming) && (
    item.command.slice(1).startsWith(query) || item.label.includes(query) || item.aliases.some((alias) => alias.startsWith("/") && alias.slice(1).startsWith(query))
  ));
  // A bare slash + Enter while streaming should stop, never clear, by default.
  return streaming ? matches.sort((a, b) => ["stop", "clear", "exit"].indexOf(a.id) - ["stop", "clear", "exit"].indexOf(b.id)) : matches;
}

export function agentSlashHelp(): string {
  return "快捷命令\n\n" + AGENT_SLASH_COMMANDS.map((item) => `${item.command.padEnd(9)} ${item.description}`).join("\n")
    + "\n\n输入 / 打开菜单；↑↓ 选择，Enter 执行，Tab 补全，Esc 收起。\n也可以直接提问：介绍项目、看看文件、给我代码示例。\n所有命令和回复都只作用于本地虚拟会话。";
}


/** Keep the selected command stable when streaming ends and the available list grows. */
export function getAgentSlashSelection(matches: readonly AgentSlashCommand[], selectedId: string | null): number {
  const index = matches.findIndex((command) => command.id === selectedId);
  return index < 0 ? 0 : index;
}
