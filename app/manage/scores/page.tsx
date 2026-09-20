"use client";

import { FormEvent, useMemo, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { AppShell } from "@/app/components/AppShell";
import { useSession } from "@/app/components/SessionProvider";
import { useToast } from "@/app/components/ToastProvider";
import { EmptyState, FieldError, PageError, PageLoading, StatusPill } from "@/app/components/ui";
import { api, formatApiError, jsonBody } from "@/app/lib/api";
import type { Competition, ScoreBatch } from "@/app/lib/domain";
import { validateForm } from "@/app/lib/formValidation";
import { formatBeijing } from "@/app/lib/time";
import { useApiResource } from "@/app/lib/useApiResource";

export default function ManageScoresPage() {
  const { user, loading: sessionLoading } = useSession();
  const toast = useToast();
  const allowed = user && ["organizer", "admin"].includes(user.role);
  const { data: catalog, loading: catalogLoading } = useApiResource<Competition[]>(allowed ? "/manage/catalog" : null);
  const [selectedCompetition, setSelectedCompetition] = useState<string | null>(null);
  const competitionId = selectedCompetition ?? catalog?.[0]?.id ?? "";
  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const availableProblems = useMemo(
    () => catalog?.find((item) => item.id === competitionId)?.tracks?.flatMap((track) => (track.problems ?? []).filter((problem) => problem.status !== "archived" && (problem.scoring_config?.external_weight_percent ?? 0) > 0).map((problem) => ({ ...problem, trackName: track.name }))) ?? [],
    [catalog, competitionId],
  );
  const problemId = selectedProblem && availableProblems.some((problem) => problem.id === selectedProblem)
    ? selectedProblem
    : availableProblems[0]?.id ?? "";
  const { data: batches, loading: batchLoading, error, reload: reloadBatches } = useApiResource<ScoreBatch[]>(competitionId ? `/manage/score-batches?competition_id=${competitionId}` : null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("external-evaluator");
  const [label, setLabel] = useState("");
  const [formError, setFormError] = useState("");
  const selectedName = useMemo(() => catalog?.find((item) => item.id === competitionId)?.name ?? "", [catalog, competitionId]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError("");
    const validationError = validateForm(event.currentTarget);
    if (validationError) return;
    if (!file) { setFormError("请先选择要导入的 CSV 成绩文件。"); return; }
    if (!competitionId) { setFormError("当前没有可导入成绩的赛事。"); return; }
    if (!problemId) { setFormError("当前赛事还没有可导入外部评分的赛题。"); return; }
    const body = new FormData();
    body.set("file", file); body.set("competition_id", competitionId); body.set("problem_id", problemId); body.set("source", source); body.set("label", label || file.name);
    try {
      const response = await api<{ accepted: number; errors: unknown[] }>("/scores/import-csv", { method: "POST", body });
      setFile(null); setLabel(""); await reloadBatches();
      toast.success(`已导入 ${response.accepted} 条成绩${response.errors.length ? `，${response.errors.length} 条未通过校验` : ""}`);
    } catch (requestError) { setFormError(formatApiError(requestError)); }
  }

  async function changeStatus(batch: ScoreBatch, status: ScoreBatch["status"]) {
    try { await api(`/manage/score-batches/${batch.id}`, { method: "PATCH", ...jsonBody({ status }) }); await reloadBatches(); toast.success(`成绩批次已设为${status === "confirmed" ? "榜单确认" : status === "draft" ? "草稿" : "撤回"}`); }
    catch (requestError) { setFormError(formatApiError(requestError)); }
  }

  if (sessionLoading || catalogLoading) return <AppShell title="外部评分" eyebrow="WORKSPACE"><PageLoading /></AppShell>;
  if (!allowed) return <AppShell title="外部评分" eyebrow="WORKSPACE"><PageError message="当前账户没有外部评分权限。" /></AppShell>;
  return <AppShell title="外部评分" eyebrow="EXTERNAL SCORING">
    <div className="page-intro score-intro"><p>每次导入对应一道赛题的一次外部评测。批次确认后，成绩会按该赛题设置的外部评分权重参与最终计算。</p><label className="form-field competition-picker"><span>当前赛事</span><select value={competitionId} onChange={(event) => { setSelectedCompetition(event.target.value); setSelectedProblem(null); }}>{catalog?.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div>
    <div className="score-manage-layout"><section className="score-import-panel"><header className="section-header"><div><span className="eyebrow"><i />IMPORT</span><h2>导入外部评分</h2></div></header><form className="score-import-form" onSubmit={upload} noValidate><div className="csv-format"><FileSpreadsheet size={19} /><div><strong>CSV 必填列</strong><code>submission_version_id,total_score</code><small>可选：metric_指标名、feedback_md</small></div></div><p className="score-import-note">CSV 只对应下面选定的赛题。版本 ID 由评测程序通过管理 API 获取；排名由平台在成绩确认后按最终分重新计算。</p><label className="form-field"><span>评测赛题</span><select value={problemId} onChange={(event) => setSelectedProblem(event.target.value)} required><option value="">请选择赛题</option>{availableProblems.map((problem) => <option value={problem.id} key={problem.id}>{problem.code} · {problem.title}（{problem.trackName}）</option>)}</select></label><label className="form-field"><span>来源标识</span><input value={source} onChange={(event) => setSource(event.target.value)} required /></label><label className="form-field"><span>批次名称</span><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder={`${selectedName} 第一轮评测`} /></label><label className="form-field file-field"><span>成绩文件</span><span className="file-input"><Upload size={16} /><input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />{file?.name ?? "选择 CSV 文件"}</span></label><FieldError>{formError}</FieldError><button className="primary-button form-submit">校验并导入</button></form></section></div>
    <section className="dashboard-section"><header className="section-header"><div><span className="eyebrow"><i />BATCHES</span><h2>外部评分批次</h2></div></header>{batchLoading ? <PageLoading /> : error ? <PageError message={error} retry={reloadBatches} /> : !batches?.length ? <EmptyState title="还没有外部评分批次" description="导入 CSV 后会在这里记录每一道赛题的评测批次。" /> : <div className="score-batch-list">{batches.map((batch) => <div key={batch.id}><StatusPill tone={batch.status === "confirmed" ? "live" : batch.status === "draft" ? "warm" : "muted"}>{batch.status === "confirmed" ? "榜单已确认" : batch.status === "draft" ? "草稿" : "已撤回"}</StatusPill><div><strong>{batch.problem_code ? `${batch.problem_code} · ${batch.problem_title}` : "未关联赛题的历史批次"}</strong><span>{batch.track_name ? `${batch.track_name} · ` : ""}{batch.label} · {batch.source} · {batch.score_count} 条 · {formatBeijing(batch.created_at, { dateStyle: "medium", timeStyle: "short" })}</span></div><select value={batch.status} onChange={(event) => void changeStatus(batch, event.target.value as ScoreBatch["status"])}><option value="draft">草稿</option><option value="confirmed">确认到榜单</option><option value="withdrawn">撤回</option></select></div>)}</div>}</section>
  </AppShell>;
}
