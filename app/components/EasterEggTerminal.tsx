"use client";

import { useEffect, useReducer, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { resolveTerminalCommand } from "@/app/lib/easterEgg";
import { VirtualAgentChat } from "@/app/components/VirtualAgentChat";
import { TERMINAL_WELCOME_ART } from "@/app/lib/terminalWelcomeArt";
import { buildColoredConsoleArt } from "@/app/lib/terminalColorArt";
import { createTerminalState, MAX_TERMINAL_TABS, PROFILE_NAMES, terminalPrompt, terminalReducer, type TerminalProfile } from "@/app/lib/easterEggTerminal";

function ProfileIcon({ profile }: { profile: TerminalProfile }) {
  return <span className={`wt-profile-icon wt-profile-${profile}`} aria-hidden="true"><svg viewBox="0 0 20 16" fill="none"><path d="m5 4 4 4-5 4M11 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" /></svg></span>;
}

type Props = { maximized: boolean; onMaximize: () => void; onMinimize: () => void; onClose: () => void };

export function EasterEggTerminal({ maximized, onMaximize, onMinimize, onClose }: Props) {
  const [state, dispatch] = useReducer(terminalReducer, undefined, createTerminalState);
  const [menuOpen, setMenuOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabNavigationRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = state.tabs.find((tab) => tab.id === state.activeId)!;
  const prompt = terminalPrompt(active.profile, active.cwd);
  const full = state.tabs.length >= MAX_TERMINAL_TABS;

  useEffect(() => {
    if (tabNavigationRef.current) {
      document.getElementById(`wt-tab-${state.activeId}`)?.focus();
      tabNavigationRef.current = false;
    } else inputRef.current?.focus();
  }, [state.activeId, active.app]);
  useEffect(() => {
    if (viewportRef.current) viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [state.activeId, active.entries, active.showBanner]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [menuOpen]);

  function newTab(profile: TerminalProfile = "powershell") {
    dispatch({ type: "new", profile });
    setMenuOpen(false);
  }
  function closeTab(id: number) {
    dispatch({ type: "close", id });
    if (state.tabs.length === 1) onClose();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const command = active.input.trim();
    if (!command) return;
    const result = resolveTerminalCommand(command, active.cwd);
    if (result.kind === "game") {
      dispatch({ type: "execute", command, result: { kind: "message", lines: ["正在打开 Claude's Day...", "游戏在终端窗口内运行。"] } });
      setGameOpen(true);
      return;
    }
    if (result.kind === "agent") {
      const art = buildColoredConsoleArt(TERMINAL_WELCOME_ART);
      console.log(art.format, ...art.styles);
    }
    dispatch({ type: "execute", command, result });
    if (result.kind === "exit" && state.tabs.length === 1) onClose();
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && menuOpen) {
      event.preventDefault(); event.stopPropagation(); setMenuOpen(false);
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "t") {
      event.preventDefault(); newTab();
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "w") {
      event.preventDefault(); closeTab(active.id);
    }
    if (active.app === "shell" && event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "l") {
      event.preventDefault(); dispatch({ type: "execute", command: "cls", result: { kind: "clear" } });
    }
  }
  function tabKeyboard(event: KeyboardEvent<HTMLButtonElement>, id: number) {
    const index = state.tabs.findIndex((tab) => tab.id === id);
    const nextIndex = event.key === "ArrowRight" ? (index + 1) % state.tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + state.tabs.length) % state.tabs.length
        : event.key === "Home" ? 0 : event.key === "End" ? state.tabs.length - 1 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const target = state.tabs[nextIndex].id;
    tabNavigationRef.current = true;
    dispatch({ type: "select", id: target });
    document.getElementById(`wt-tab-${target}`)?.focus();
  }

  return <section className="wt-window" aria-label="Windows Terminal 风格的浏览器模拟终端" onKeyDown={keyboard}>
    <h2 id="egg-title" className="sr-only">Windows Terminal 风格终端 · 浏览器模拟</h2>
    <header className="wt-titlebar" onDoubleClick={(event) => { if (event.target === event.currentTarget) onMaximize(); }}>
      <div className="wt-tablist" role="tablist" aria-label="终端标签页">
        {state.tabs.map((tab) => <div className={`wt-tab ${tab.id === state.activeId ? "wt-tab-active" : ""}`} key={tab.id}>
          <button type="button" role="tab" id={`wt-tab-${tab.id}`} aria-selected={tab.id === state.activeId} aria-controls="wt-panel" tabIndex={tab.id === state.activeId ? 0 : -1} onKeyDown={(event) => tabKeyboard(event, tab.id)} onClick={() => dispatch({ type: "select", id: tab.id })}>
            <ProfileIcon profile={tab.profile} /><span>{tab.app === "agent" ? "UESTC AI · agent" : PROFILE_NAMES[tab.profile]}</span>
          </button>
          <button type="button" className="wt-tab-close" aria-label={`关闭标签页 ${tab.app === "agent" ? "UESTC AI · agent" : PROFILE_NAMES[tab.profile]}`} onClick={() => closeTab(tab.id)}>×</button>
        </div>)}
      </div>
      <div className="wt-new-controls" ref={menuRef}>
        <button type="button" className="wt-new" disabled={full} title="新建 PowerShell 标签页" aria-label="新建 PowerShell 标签页" onClick={() => newTab()}>+</button>
        <button type="button" className="wt-dropdown" title="终端配置文件" aria-label="选择终端配置文件" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg></button>
        {menuOpen && <div className="wt-profiles" role="group" aria-label="终端配置文件">
          <button type="button" disabled={full} onClick={() => newTab("powershell")}><ProfileIcon profile="powershell" />Windows PowerShell</button>
          <button type="button" disabled={full} onClick={() => newTab("cmd")}><ProfileIcon profile="cmd" />命令提示符</button>
          <div className="wt-menu-note">浏览器内模拟，不连接本机终端{full ? " · 已达 8 个标签页上限" : ""}</div>
        </div>}
      </div>
      <div className="wt-caption-buttons">
        <button type="button" title="最小化" aria-label="最小化终端" onClick={() => { setMenuOpen(false); onMinimize(); }}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10" /></svg></button>
        <button type="button" title={maximized ? "向下还原" : "最大化"} aria-label={maximized ? "还原终端大小" : "最大化终端"} onClick={onMaximize}><svg viewBox="0 0 12 12" aria-hidden="true">{maximized ? <><path d="M4 1.5h6.5V8" /><rect x="1.5" y="4" width="6.5" height="6.5" /></> : <rect x="1.5" y="1.5" width="9" height="9" />}</svg></button>
        <button type="button" className="wt-window-close" title="关闭" aria-label="关闭终端窗口" onClick={() => { setMenuOpen(false); onClose(); }}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m1.5 1.5 9 9m0-9-9 9" /></svg></button>
      </div>
    </header>
    {gameOpen && <section className="egg-game-overlay" aria-label="Claude's Day 小游戏">
      <header className="egg-game-toolbar">
        <strong>CLAUDE&apos;S DAY</strong>
        <button type="button" onClick={() => setGameOpen(false)}>返回终端</button>
      </header>
      <iframe className="egg-game-frame" src="/claudes-day/index.html" title="Claude's Day 像素小游戏" sandbox="allow-scripts allow-same-origin" />
    </section>}
    {state.tabs.filter((tab) => tab.app === "agent").map((tab) => <div className="va-tab-panel" hidden={tab.id !== state.activeId} key={tab.id}><VirtualAgentChat active={tab.id === state.activeId} cwd={tab.cwd} onExit={() => dispatch({ type: "leave-agent", id: tab.id })} /></div>)}
    {active.app === "shell" && <div className="wt-viewport" id="wt-panel" role="tabpanel" aria-labelledby={`wt-tab-${active.id}`} ref={viewportRef}>
      <div role="log" aria-label="终端输出" aria-live="polite" aria-relevant="additions text">
        {active.showBanner && <div className="wt-banner">
          <div>UESTC AI Virtual Workspace</div>
          <div className="wt-dim">输入 agent 开始对话，或输入 help 查看常规命令。文件与输出均为本地模拟。</div>
        </div>}
        {active.entries.map((entry) => <div className="wt-entry" key={entry.id}>
          <div className="wt-echo">{entry.prompt} {entry.command}</div>
          {entry.result.kind === "agent" ? <div className="wt-dim">已返回虚拟工作区。</div> : <div className="wt-result">{entry.result.lines.map((line, index) => <div key={index}>{line}</div>)}</div>}
        </div>)}
      </div>
      <form className="wt-prompt" onSubmit={submit}>
        <label htmlFor="egg-command">{prompt}</label>
        <input id="egg-command" data-terminal-input ref={inputRef} value={active.input} onChange={(event) => dispatch({ type: "input", value: event.target.value })} onKeyDown={(event) => {
          if (event.isDefaultPrevented() || event.nativeEvent.isComposing) return;
          if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); dispatch({ type: "history", direction: event.key === "ArrowUp" ? -1 : 1 }); }
        }} autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={160} aria-label="输入终端命令" />
        <button className="wt-enter" type="submit" aria-label="提交命令">↵</button>
      </form>
    </div>}
  </section>;
}
