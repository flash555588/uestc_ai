export type AgentTurn = { id: number; prompt: string; reply: string; visible: number; status: "streaming" | "done" | "stopped" };
export type AgentChatState = { draft: string; turns: AgentTurn[]; nextId: number };
export type AgentChatAction = { type: "draft"; value: string } | { type: "send"; reply: string; animate: boolean } | { type: "tick"; id: number } | { type: "stop" } | { type: "clear" };
export function createAgentChatState(): AgentChatState { return { draft: "", turns: [], nextId: 1 }; }
export function agentChatReducer(state: AgentChatState, action: AgentChatAction): AgentChatState {
  if (action.type === "draft") return { ...state, draft: action.value.slice(0, 2000) };
  if (action.type === "clear") return { draft: "", turns: [], nextId: state.nextId };
  if (action.type === "send") {
    if (!state.draft.trim() || state.turns.some((turn) => turn.status === "streaming")) return state;
    const length = Array.from(action.reply).length;
    return { ...state, draft: "", nextId: state.nextId + 1, turns: [...state.turns.slice(-19), { id: state.nextId, prompt: state.draft.trim(), reply: action.reply, visible: action.animate ? 0 : length, status: action.animate ? "streaming" : "done" }] };
  }
  return { ...state, turns: state.turns.map((turn) => {
    if (turn.status !== "streaming") return turn;
    if (action.type === "stop") return { ...turn, status: "stopped" };
    if (action.id !== turn.id) return turn;
    const length = Array.from(turn.reply).length;
    const visible = Math.min(length, turn.visible + 5);
    return { ...turn, visible, status: visible === length ? "done" : "streaming" };
  }) };
}
