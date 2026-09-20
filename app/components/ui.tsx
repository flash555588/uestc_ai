import { AlertCircle, LoaderCircle, SearchX } from "lucide-react";

export function StatusPill({ children, tone = "neutral" }: {
  children: React.ReactNode;
  tone?: "neutral" | "live" | "warm" | "muted" | "danger";
}) {
  return <span className={`status-pill status-${tone}`}><span className="status-dot" />{children}</span>;
}

export function PageLoading({ label = "正在读取数据" }: { label?: string }) {
  return <div className="page-state" aria-live="polite"><LoaderCircle className="spin" size={20} /><strong>{label}</strong><span>内容会在连接平台后自动显示。</span></div>;
}

export function PageError({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="page-state state-error" role="alert"><AlertCircle size={20} /><strong>暂时无法显示</strong><span>{message}</span>{retry && <button className="text-button" onClick={retry}>重新载入</button>}</div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="page-state"><SearchX size={20} /><strong>{title}</strong><span>{description}</span></div>;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  return children ? <span className="field-error" role="alert">{children}</span> : null;
}

