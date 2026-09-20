"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认删除",
  busy = false,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;
  return <div className="dialog-layer" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !busy) onCancel();
  }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description"><header><span className="dialog-alert-icon"><AlertTriangle size={19} /></span><button className="icon-button" type="button" onClick={onCancel} disabled={busy} aria-label="关闭确认窗口"><X size={18} /></button></header><h2 id="confirm-dialog-title">{title}</h2><p id="confirm-dialog-description">{description}</p>{error && <span className="field-error">{error}</span>}<footer><button ref={cancelButton} type="button" className="outline-button" onClick={onCancel} disabled={busy}>取消</button><button type="button" className="danger-button" onClick={onConfirm} disabled={busy}>{busy ? "正在删除" : confirmLabel}</button></footer></section></div>;
}
