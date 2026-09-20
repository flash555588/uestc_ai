"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound, LockKeyhole, MailCheck, UserPlus } from "lucide-react";
import { AppShell } from "@/app/components/AppShell";
import { useSession } from "@/app/components/SessionProvider";
import { useToast } from "@/app/components/ToastProvider";
import { FieldError } from "@/app/components/ui";
import { api, formatApiError, jsonBody } from "@/app/lib/api";
import { validateForm } from "@/app/lib/formValidation";

function isCampusEmail(value: string) {
  return value.trim().toLowerCase().endsWith("@std.uestc.edu.cn");
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const { refresh } = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const externalEmail = mode === "register" && email.includes("@") && !isCampusEmail(email);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function changeEmail(value: string) {
    if (value !== email && codeSent) {
      setCodeSent(false);
      setVerificationCode("");
      setCooldown(0);
    }
    setEmail(value);
    setEmailError("");
    setError("");
  }

  async function sendCode() {
    setError(""); setEmailError(""); setInviteError(""); setCodeError("");
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setEmailError("请输入有效的邮箱地址。");
      return;
    }
    if (!isCampusEmail(normalized) && !inviteCode.trim()) {
      setInviteError("非学生邮箱需要管理员提供的注册邀请码。");
      return;
    }
    setSendingCode(true);
    try {
      const result = await api<{ status: string; retry_after: number }>("/auth/verification-codes", {
        method: "POST",
        ...jsonBody({ email: normalized, invite_code: inviteCode.trim() || undefined }),
      });
      setCodeSent(true);
      setCooldown(result.retry_after);
      toast.success("验证码已发送，请检查邮箱");
    } catch (requestError) {
      const message = formatApiError(requestError);
      if (!isCampusEmail(normalized)) setInviteError(message); else setEmailError(message);
    } finally {
      setSendingCode(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setEmailError(""); setInviteError(""); setCodeError("");
    const validationError = validateForm(event.currentTarget);
    if (validationError) return;
    if (mode === "register" && !/^\d{6}$/.test(verificationCode)) {
      setCodeError("请输入邮件中的 6 位验证码。");
      return;
    }
    if (mode === "register" && externalEmail && !inviteCode.trim()) {
      setInviteError("非学生邮箱需要管理员提供的注册邀请码。");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/auth/${mode}`, {
        method: "POST",
        ...jsonBody(mode === "login" ? { email, password } : {
          email,
          password,
          name,
          verification_code: verificationCode,
          invite_code: inviteCode.trim() || undefined,
        }),
      });
      await refresh();
      const destination = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/dashboard";
      window.location.assign(destination);
    } catch (requestError) {
      const message = formatApiError(requestError);
      if (mode === "register" && message.includes("验证码")) setCodeError(message); else setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title={mode === "login" ? "登录" : "创建账户"} eyebrow="ACCOUNT">
      <div className="auth-layout">
        <section className="auth-note"><span>平台账户</span><h2>一个账户，连接队伍、作品与评审记录。</h2><p>公开内容无需登录。学生可使用 <strong>@std.uestc.edu.cn</strong> 邮箱注册，其他邮箱需要管理员邀请码。</p><div><LockKeyhole size={18} /><span>会话保存在 HttpOnly Cookie 中，前端不会读取你的令牌。</span></div></section>
        <form className="form-panel auth-form" onSubmit={submit} noValidate>
          <div className="segmented-control" aria-label="账户操作"><button type="button" className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); }}>登录</button><button type="button" className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setError(""); }}>注册</button></div>
          {mode === "register" && <label className="form-field"><span>姓名或昵称</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>}
          <label className="form-field" data-invalid={Boolean(emailError)}><span>邮箱</span><input type="email" value={email} onChange={(event) => changeEmail(event.target.value)} autoComplete="email" required /><FieldError>{emailError}</FieldError></label>
          {externalEmail && <label className="form-field" data-invalid={Boolean(inviteError)}><span>注册邀请码</span><input value={inviteCode} onChange={(event) => { setInviteCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setInviteError(""); }} autoComplete="off" minLength={12} maxLength={12} required /><FieldError>{inviteError}</FieldError><small>非学生邮箱需要一次性邀请码。</small></label>}
          <label className="form-field"><span>密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /><small>至少 8 个字符</small></label>
          {mode === "register" && <label className="form-field verification-field" data-invalid={Boolean(codeError)}><span>邮箱验证码</span><span className="verification-control"><input value={verificationCode} onChange={(event) => { setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setCodeError(""); }} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="6 位数字" /><button type="button" className="outline-button" disabled={sendingCode || cooldown > 0} onClick={() => void sendCode()}><MailCheck size={15} />{sendingCode ? "正在发送" : cooldown > 0 ? `${cooldown} 秒后重发` : codeSent ? "重新发送" : "发送验证码"}</button></span><FieldError>{codeError}</FieldError>{codeSent && <small>验证码已发送，10 分钟内有效。</small>}</label>}
          <FieldError>{error}</FieldError>
          <button className="primary-button form-submit" disabled={submitting}>{mode === "login" ? <LockKeyhole size={16} /> : <UserPlus size={16} />}{submitting ? "正在处理" : mode === "login" ? "进入工作台" : "创建账户"}{mode === "register" ? <KeyRound size={16} /> : <ArrowRight size={16} />}</button>
        </form>
      </div>
    </AppShell>
  );
}
