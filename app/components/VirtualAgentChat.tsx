"use client";

import { useEffect, useId, useReducer, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { TerminalWelcomeArt } from "@/app/components/TerminalWelcomeArt";
import { virtualAgentReply } from "@/app/lib/easterEgg";
import { agentChatReducer, createAgentChatState } from "@/app/lib/virtualAgentChat";
import { agentSlashHelp, getAgentSlashMatches, getAgentSlashSelection, resolveAgentSlashCommand } from "@/app/lib/agentSlashCommands";

export function VirtualAgentChat({ active, cwd, onExit }: { active: boolean; cwd: string; onExit: () => void }) {
  const [state, dispatch] = useReducer(agentChatReducer, undefined, createAgentChatState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const followBottom = useRef(true);
  const reducedMotion = useRef(false);
  const menuId = useId();
  const pending = state.turns.find((turn) => turn.status === "streaming");
  const matches = getAgentSlashMatches(state.draft, Boolean(pending));
  const menuOpen = active && !menuDismissed && matches !== null;
  const selection = getAgentSlashSelection(matches ?? [], selectedId);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reducedMotion.current = preference.matches; };
    sync(); preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);
  useEffect(() => { if (active) inputRef.current?.focus(); }, [active]);
  useEffect(() => {
    if (!active || !pending) return;
    const timer = window.setTimeout(() => dispatch({ type: "tick", id: pending.id }), 24);
    return () => window.clearTimeout(timer);
  }, [active, pending]);
  useEffect(() => {
    if (active && followBottom.current && transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [active, state.turns]);
  useEffect(() => {
    if (menuOpen) selectedOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [selection, menuOpen, state.draft]);

  function editDraft(value: string) {
    dispatch({ type: "draft", value });
    setSelectedId(getAgentSlashMatches(value, Boolean(pending))?.[0]?.id ?? null); setMenuDismissed(false); setNotice("");
  }
  function sendMessage(raw: string) {
    const prompt = raw.trim();
    if (!prompt) return;
    const command = resolveAgentSlashCommand(prompt);
    if (pending && !command?.whileStreaming) { setNotice("先停止当前输出，再发送消息或执行此命令。"); return; }
    setMenuDismissed(true); setSelectedId(null); setNotice("");
    if (command?.id === "exit") { onExit(); return; }
    if (command?.id === "clear") { dispatch({ type: "clear" }); setNotice("对话已清空。"); inputRef.current?.focus(); return; }
    if (command?.id === "stop") {
      dispatch({ type: "stop" }); dispatch({ type: "draft", value: "" });
      setNotice(pending ? "已停止模拟输出。" : "当前没有正在输出的回复。"); inputRef.current?.focus(); return;
    }
    let reply: string;
    if (command?.id === "help") reply = agentSlashHelp();
    else if (command?.id === "files") reply = virtualAgentReply("看看目录", cwd);
    else if (command?.id === "status") reply = `UESTC AI · 会话状态\n\n运行方式：本地模拟\n虚拟目录：${cwd}\n当前保留的对话轮数：${state.turns.length}\n模型连接：未连接\n真实文件访问：无\n系统命令执行：无`;
    else if (prompt.startsWith("/")) reply = `未识别斜杠命令：${prompt.slice(0, 64)}\n输入 / 打开命令菜单，或输入 /help 查看说明。`;
    else reply = virtualAgentReply(prompt, cwd);
    followBottom.current = true;
    // Apply the chosen completion before send so the recorded prompt is not the partial query.
    dispatch({ type: "draft", value: prompt });
    dispatch({ type: "send", reply, animate: !reducedMotion.current });
    inputRef.current?.focus();
  }
  function submit(event?: FormEvent) {
    event?.preventDefault();
    sendMessage(menuOpen && matches?.length ? matches[selection].command : state.draft);
  }
  function inputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (menuOpen) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setMenuDismissed(true); return; }
      if (matches?.length) {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault(); setSelectedId(matches[(selection + (event.key === "ArrowUp" ? -1 : 1) + matches.length) % matches.length].id); return;
        }
        if (event.key === "Tab" && !event.shiftKey) {
          event.preventDefault(); dispatch({ type: "draft", value: matches[selection].command }); setMenuDismissed(true); return;
        }
      }
    }
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); }
  }

  return <section className="virtual-agent" aria-label="UESTC AI 虚拟 Agent 对话">
    <header className="va-toolbar"><div><strong>UESTC AI</strong><span>agent / 本地模拟</span></div><button type="button" onClick={onExit} aria-label="退出 Agent 返回终端">返回终端 ↗</button></header>
    <div className="va-transcript" ref={transcriptRef} onScroll={() => { const el = transcriptRef.current; if (el) followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      <TerminalWelcomeArt />
      <div className="va-intro"><p>你好，我是 UESTC AI 虚拟 Agent。</p><p>可以让我介绍项目、查看虚拟文件、展示代码，或整理一个计划。</p><span>所有回复均由本地模板生成，不访问真实文件或外部 AI 服务。输入 / 查看命令。</span></div>
      <div role="log" aria-label="对话记录" aria-live="polite" aria-relevant="additions">{state.turns.map((turn) => <article className="va-turn" key={turn.id}>
        <div className="va-user"><span aria-hidden="true">›</span><p>{turn.prompt}</p></div>
        <div className="va-answer"><span className="va-agent-mark" aria-hidden="true">●</span><div><span className="va-speaker">UESTC AI</span><pre aria-live="off">{Array.from(turn.reply).slice(0, turn.visible).join("")}{turn.status === "streaming" && <span className="va-caret" aria-hidden="true">▍</span>}</pre>{turn.status === "stopped" && <small>已停止模拟输出</small>}</div></div>
      </article>)}</div>
    </div>
    <div className="va-composer-region">
      {menuOpen && <div className="va-slash-menu">
        <div className="va-slash-header"><strong>{pending ? "输出中的可用命令" : "快捷命令"}</strong><span>↑↓ 选择 · Enter 执行 · Tab 补全</span></div>
        <div className="va-slash-options" id={menuId} role="listbox" aria-label="Agent 斜杠命令">
          {matches?.map((command, index) => <button ref={index === selection ? selectedOptionRef : undefined} type="button" role="option" id={`${menuId}-${command.id}`} aria-selected={index === selection} tabIndex={-1} className={index === selection ? "is-selected" : ""} key={command.id} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setSelectedId(command.id)} onClick={() => sendMessage(command.command)}>
            <code>{command.command}</code><span><strong>{command.label}</strong><small>{command.description}</small></span><span className="va-slash-enter" aria-hidden="true">↵</span>
          </button>)}
        </div>
        {!matches?.length && <div className="va-slash-empty">没有匹配命令。{pending ? "可使用 /stop、/clear 或 /exit。" : "输入 / 查看全部命令。"}</div>}
      </div>}
      <form className="va-composer" onSubmit={submit}>
        <span aria-hidden="true">›</span>
        <textarea data-terminal-input ref={inputRef} role="combobox" aria-haspopup="listbox" aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined} aria-autocomplete="list" aria-activedescendant={menuOpen && matches?.length ? `${menuId}-${matches[selection].id}` : undefined} aria-label="向虚拟 Agent 输入消息" placeholder="输入消息，或输入 / 查看命令…" value={state.draft} rows={Math.min(5, state.draft.split("\n").length)} maxLength={2000} autoComplete="off" spellCheck={false} onChange={(event) => editDraft(event.target.value)} onKeyDown={inputKeyDown} />
        {pending ? <button type="button" onClick={() => sendMessage("/stop")} aria-label="停止模拟输出">■ 停止</button> : <button type="submit" disabled={!state.draft.trim()} aria-label="发送消息">发送 ↵</button>}
      </form>
      <footer className="va-footer"><span role="status">{notice || (pending ? "正在显示模拟回复…" : "本地演示 · 未连接真实模型")}</span><span><button type="button" className="va-slash-trigger" onClick={() => { editDraft("/"); inputRef.current?.focus(); }} aria-label="打开斜杠命令菜单">/ 命令</button> · Enter 发送 · Shift+Enter 换行</span></footer>
    </div>
  </section>;
}
