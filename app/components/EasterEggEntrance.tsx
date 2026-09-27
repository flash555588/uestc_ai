"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { advanceSequence, ENTRY_SEQUENCE } from "@/app/lib/easterEgg";
import { EasterEggTerminal } from "@/app/components/EasterEggTerminal";
import "./easter-egg.css";


const keyButtons = [
  { code: "ArrowUp", label: "↑" }, { code: "ArrowDown", label: "↓" },
  { code: "ArrowLeft", label: "←" }, { code: "ArrowRight", label: "→" },
  { code: "KeyB", label: "B" }, { code: "KeyA", label: "A" },
];

export function EasterEggEntrance() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);

  function open() {
    setMinimized(false);
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    dialogRef.current?.querySelector<HTMLElement>("[data-terminal-input]")?.focus();
  }
  function close() {
    setMinimized(false);
    dialogRef.current?.close();
  }
  function feed(code: string) {
    if (unlocked) return;
    const next = advanceSequence(progressRef.current, code);
    progressRef.current = next.progress;
    setProgress(next.progress);
    if (next.completed) { setUnlocked(true); open(); }
  }

  useEffect(() => {
    if (unlocked) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']")) return;
      if (!ENTRY_SEQUENCE.includes(event.code as typeof ENTRY_SEQUENCE[number])) return;
      const next = advanceSequence(progressRef.current, event.code);
      progressRef.current = next.progress;
      setProgress(next.progress);
      if (next.completed) {
        event.preventDefault();
        setUnlocked(true);
        if (!dialogRef.current?.open) dialogRef.current?.showModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [unlocked]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (!unlocked && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
  }

  return <>
    {minimized && <button type="button" className="wt-restore" onClick={open} aria-label="恢复最小化的终端"><span aria-hidden="true">&gt;_</span> Windows Terminal <small>恢复</small></button>}
    <dialog ref={dialogRef} className={`egg-dialog${unlocked ? " egg-dialog-terminal" : ""}${unlocked && maximized ? " egg-window-maximized" : ""}`} aria-labelledby="egg-title" onCancel={() => setMinimized(false)} onKeyDown={handleDialogKeyDown}>
      {!unlocked ? <>
        <div className="egg-topline"><span>UESTC / AI — SITE INFO</span><button type="button" aria-label="关闭站点信息" onClick={close}>关闭 ×</button></div>
        <section className="egg-content egg-diagnostic" aria-live="polite">
          <span className="egg-overline">站点 / 诊断</span>
          <h2 id="egg-title">站点信息</h2>
          <p>本地键位校验：十个输入信号依次匹配后，记录状态会更新。</p>
          <dl className="egg-diagnostics">
            <div><dt>通道</dt><dd>键盘 / 触控</dd></div>
            <div><dt>校验向量</dt><dd>U² D² (LR)² B A</dd></div>
            <div><dt>符号约定</dt><dd>U ↑　D ↓　L ←　R →</dd></div>
          </dl>
          <p className="egg-small">本面板只在本地匹配按键序列。输入框中的按键不参与校验。</p>
          <details className="egg-touch"><summary>触屏键位检测</summary><div className="egg-keys" aria-label="触屏键位">{keyButtons.map(({ code, label }) => <button type="button" key={code} onClick={() => feed(code)} aria-label={`输入 ${label}`}>{label}</button>)}</div></details>
          <div className="egg-signal" role="status">校验进度 {progress} / {ENTRY_SEQUENCE.length}<span aria-hidden="true">{"●".repeat(progress)}{"○".repeat(ENTRY_SEQUENCE.length - progress)}</span></div>
        </section>
        <div className="egg-footnote">公开站点信息 · 本地键位检测</div>
      </> : <EasterEggTerminal maximized={maximized} onMaximize={() => setMaximized((value) => !value)} onMinimize={() => { setMinimized(true); dialogRef.current?.close(); }} onClose={close} />}
    </dialog>
  </>;
}
