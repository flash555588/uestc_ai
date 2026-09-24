import type { TerminalResult } from "./easterEgg";

export type TerminalProfile = "powershell" | "cmd";
export const PROFILE_NAMES: Record<TerminalProfile, string> = { powershell: "Windows PowerShell", cmd: "命令提示符" };
export const MAX_TERMINAL_TABS = 8;
export type TerminalEntry = { id: number; command: string; prompt: string; result: Extract<TerminalResult, { kind: "agent" | "message" }> };
export type TerminalSession = {
  id: number;
  profile: TerminalProfile;
  app: "shell" | "agent";
  cwd: string;
  entries: TerminalEntry[];
  input: string;
  history: string[];
  historyIndex: number;
  historyDraft: string;
  showBanner: boolean;
};
export type TerminalState = { tabs: TerminalSession[]; activeId: number; nextId: number; nextEntryId: number };
export type TerminalAction =
  | { type: "new"; profile: TerminalProfile }
  | { type: "select"; id: number }
  | { type: "close"; id: number }
  | { type: "leave-agent"; id: number }
  | { type: "input"; value: string }
  | { type: "history"; direction: -1 | 1 }
  | { type: "execute"; command: string; result: TerminalResult };

function session(id: number, profile: TerminalProfile): TerminalSession {
  return { id, profile, app: "shell", cwd: "/workspace", entries: [], input: "", history: [], historyIndex: 0, historyDraft: "", showBanner: true };
}

export function createTerminalState(): TerminalState {
  return { tabs: [session(1, "powershell")], activeId: 1, nextId: 2, nextEntryId: 1 };
}

export function terminalPrompt(profile: TerminalProfile, cwd = "/workspace"): string {
  const path = "C:\\Users\\visitor" + cwd.replaceAll("/", "\\");
  return `${profile === "powershell" ? "PS " : ""}${path}>`;
}
export function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  if (action.type === "new") {
    if (state.tabs.length >= MAX_TERMINAL_TABS) return state;
    return { ...state, tabs: [...state.tabs, session(state.nextId, action.profile)], activeId: state.nextId, nextId: state.nextId + 1 };
  }
  if (action.type === "leave-agent") return { ...state, tabs: state.tabs.map((tab) => tab.id === action.id ? { ...tab, app: "shell", input: "" } : tab) };
  if (action.type === "select") return state.tabs.some((tab) => tab.id === action.id) ? { ...state, activeId: action.id } : state;
  if (action.type === "close") {
    const index = state.tabs.findIndex((tab) => tab.id === action.id);
    if (index < 0) return state;
    if (state.tabs.length === 1) return { ...state, tabs: [session(state.nextId, "powershell")], activeId: state.nextId, nextId: state.nextId + 1 };
    const tabs = state.tabs.filter((tab) => tab.id !== action.id);
    return { ...state, tabs, activeId: state.activeId === action.id ? tabs[Math.min(index, tabs.length - 1)].id : state.activeId };
  }
  if (action.type === "execute" && action.result.kind === "exit") return terminalReducer(state, { type: "close", id: state.activeId });
  return {
    ...state,
    nextEntryId: action.type === "execute" ? state.nextEntryId + 1 : state.nextEntryId,
    tabs: state.tabs.map((tab) => {
      if (tab.id !== state.activeId) return tab;
      if (action.type === "input") return { ...tab, input: action.value.slice(0, 160), historyIndex: tab.history.length, historyDraft: "" };
      if (action.type === "history") {
        if (!tab.history.length) return tab;
        const historyIndex = Math.max(0, Math.min(tab.history.length, tab.historyIndex + action.direction));
        const historyDraft = tab.historyIndex === tab.history.length ? tab.input : tab.historyDraft;
        return { ...tab, historyIndex, historyDraft, input: historyIndex === tab.history.length ? historyDraft : tab.history[historyIndex] };
      }
      const history = [...tab.history, action.command].slice(-100);
      const base = { ...tab, input: "", history, historyIndex: history.length, historyDraft: "" };
      if (action.result.kind === "clear") return { ...base, entries: [], showBanner: false };
      if (action.result.kind === "agent" || action.result.kind === "message") {
        return { ...base, app: action.result.kind === "agent" ? "agent" : tab.app, cwd: action.result.kind === "message" ? action.result.cwd ?? tab.cwd : tab.cwd, entries: [...tab.entries.slice(-39), { id: state.nextEntryId, command: action.command, prompt: terminalPrompt(tab.profile, tab.cwd), result: action.result }] };
      }
      return base;
    }),
  };
}
