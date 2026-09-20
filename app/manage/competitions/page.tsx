"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, CalendarPlus, Plus } from "lucide-react";
import { AppShell } from "@/app/components/AppShell";
import { useSession } from "@/app/components/SessionProvider";
import { useToast } from "@/app/components/ToastProvider";
import { EmptyState, FieldError, PageError, PageLoading, StatusPill } from "@/app/components/ui";
import { api, formatApiError, jsonBody } from "@/app/lib/api";
import type { Competition } from "@/app/lib/domain";
import { validateForm } from "@/app/lib/formValidation";
import { useApiResource } from "@/app/lib/useApiResource";

export default function ManageCompetitionsPage() {
  const { user, loading: sessionLoading } = useSession();
  const toast = useToast();
  const allowed = user && ["organizer", "admin"].includes(user.role);
  const { data, loading, error, reload } = useApiResource<Competition[]>(allowed ? "/manage/catalog" : null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function createCompetition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError("");
    const validationError = validateForm(event.currentTarget);
    if (validationError) return;
    setSubmitting(true);
    try {
      await api("/competitions", { method: "POST", ...jsonBody({ name, slug, summary, status: "draft" }) });
      setName(""); setSlug(""); setSummary(""); setShowCreate(false); await reload();
      toast.success("赛事草稿已创建");
    } catch (requestError) { setFormError(formatApiError(requestError)); }
    finally { setSubmitting(false); }
  }

  if (sessionLoading) return <AppShell title="赛事管理" eyebrow="WORKSPACE"><PageLoading /></AppShell>;
  if (!allowed) return <AppShell title="赛事管理" eyebrow="WORKSPACE"><PageError message="当前账户没有赛事管理权限。" /></AppShell>;
  return <AppShell title="赛事管理" eyebrow="COMPETITION OPERATIONS" actions={<button className="primary-button compact-button" onClick={() => setShowCreate((value) => !value)}><Plus size={15} />新建赛事</button>}>
    <div className="page-intro"><p>赛事从草稿开始。先配置时间、赛道和赛题，确认公开页面无误后再发布。</p></div>
    {showCreate && <form className="manage-create-band" onSubmit={createCompetition} noValidate><div className="manage-create-title"><CalendarPlus size={18} /><div><strong>新建赛事草稿</strong><span>创建后继续配置赛道与题目</span></div></div><label className="form-field"><span>赛事名称</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="form-field"><span>URL 标识</span><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="2027-spring" required /></label><label className="form-field grow-field"><span>赛事简介</span><input value={summary} onChange={(event) => setSummary(event.target.value)} required /></label><button className="primary-button" disabled={submitting}>{submitting ? "正在创建" : "创建草稿"}</button><FieldError>{formError}</FieldError></form>}
    {loading ? <PageLoading /> : error ? <PageError message={error} retry={reload} /> : !data?.length ? <EmptyState title="还没有赛事" description="点击右上角创建第一场赛事。" /> : <div className="manage-competition-list">{data.map((competition) => <Link href={`/manage/competitions/${competition.id}`} key={competition.id}><div className="manage-competition-state"><StatusPill tone={competition.status === "published" ? "live" : competition.status === "draft" ? "warm" : "muted"}>{competition.status === "published" ? "已发布" : competition.status === "draft" ? "草稿" : competition.status}</StatusPill><span>{competition.slug}</span></div><div><h2>{competition.name}</h2><p>{competition.summary}</p></div><dl><div><dt>赛道</dt><dd>{competition.tracks?.length ?? 0}</dd></div><div><dt>题目</dt><dd>{competition.tracks?.reduce((sum, track) => sum + (track.problems?.length ?? 0), 0) ?? 0}</dd></div></dl><ArrowRight size={17} /></Link>)}</div>}
  </AppShell>;
}
