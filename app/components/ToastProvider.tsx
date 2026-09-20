"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((message: string, tone: ToastTone) => {
    const id = ++nextId.current;
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    timers.current.set(id, setTimeout(() => dismiss(id), 4200));
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({
    success: (message: string) => show(message, "success"),
    error: (message: string) => show(message, "error"),
    info: (message: string) => show(message, "info"),
  }), [show]);

  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? AlertCircle : Info;
        return <div className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} key={toast.id}>
          <Icon size={18} />
          <span>{toast.message}</span>
          <button type="button" onClick={() => dismiss(toast.id)} aria-label="关闭提示"><X size={15} /></button>
        </div>;
      })}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
