"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FilePlus2, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/app/components/AppShell";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { MarkdownEditor } from "@/app/components/MarkdownEditor";
import { useSession } from "@/app/components/SessionProvider";
import { useToast } from "@/app/components/ToastProvider";
import { FieldError, PageError, PageLoading, StatusPill } from "@/app/components/ui";
import { api, formatApiError, jsonBody } from "@/app/lib/api";
import type { Competition, Problem, Track } from "@/app/lib/domain";
import { validateForm } from "@/app/lib/formValidation";
import { useApiResource } from "@/app/lib/useApiResource";

function rubricText(problem?: Problem) {
  return Object.entries(problem?.judging_schema.rubric ?? {}).map(([name, weight]) => `${name}: ${weight}`).join("\n");
}

function parseRubric(value: string) {
  const rubric: Record<string, number> = {};
  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`评分项格式错误：${line}`);
    const name = line.slice(0, separator).trim();
    const weight = Number(line.slice(separator + 1).trim());
    if (!Number.isFinite(weight) || weight < 0) throw new Error(`评分权重无效：${line}`);
    rubric[name] = weight;
  }
  return rubric;
}

const initialStatement = "# 赛题名称\n\n在这里说明任务背景、目标与数据。\n\n## 任务要求\n\n说明参赛者需要完成什么。\n\n## 提交要求\n\n说明作品材料与复现要求。\n";

export default function ManageProblemPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const allowed = user && ["organizer", "admin"].includes(user.role);
  const { data: catalog, loading, error, reload } = useApiResource<Competition[]>(allowed ? "/manage/catalog" : null);
  const isNew = params.id === "new";
  const existing = useMemo(
    () => catalog?.flatMap((competition) => competition.tracks ?? []).flatMap((track) => track.problems ?? []).find((problem) => problem.id === params.id),
    [catalog, params.id],
  );
  const requestedTrackId = searchParams.get("track") ?? existing?.track_id ?? "";
  const tracks = useMemo(
    () => catalog?.flatMap((competition) => (competition.tracks ?? []).map((track) => ({ track, competition }))) ?? [],
    [catalog],
  );
  const selected = tracks.find((item) => item.track.id === requestedTrackId) ?? tracks[0];

  if (sessionLoading || loading) return <AppShell title="赛题编辑" eyebrow="WORKSPACE"><PageLoading /></AppShell>;
  if (!allowed) return <AppShell title="赛题编辑" eyebrow="WORKSPACE"><PageError message="当前账户没有赛题管理权限。" /></AppShell>;
  if (error || (!isNew && !existing) || !selected) return <AppShell title="赛题编辑" eyebrow="WORKSPACE"><PageError message={error || "赛题或赛道不存在。"} retry={reload} /></AppShell>;

  return <ProblemEditor
    key={existing?.id ?? `new-${selected.track.id}`}
    problem={existing}
    initialTrack={selected.track}
    competition={selected.competition}
    tracks={tracks}
    isNew={isNew}
    onCreated={(id) => router.replace(`/manage/problems/${id}`)}
    onDeleted={() => router.replace(`/manage/competitions/${selected.competition.id}`)}
    reload={reload}
  />;
}

function ProblemEditor({ problem, initialTrack, competition, tracks, isNew, onCreated, onDeleted, reload }: {
  problem?: Problem;
  initialTrack: Track;
  competition: Competition;
  tracks: { track: Track; competition: Competition }[];
  isNew: boolean;
  onCreated: (id: string) => void;
  onDeleted: () => void;
  reload: () => Promise<void>;
}) {
  const [trackId, setTrackId] = useState(initialTrack.id);
  const [code, setCode] = useState(problem?.code ?? "");
  const [slug, setSlug] = useState(problem?.slug ?? "");
  const [title, setTitle] = useState(problem?.title ?? "");
  const [summary, setSummary] = useState(problem?.summary ?? "");
  const [status, setStatus] = useState(problem?.status ?? "draft");
  const [difficulty, setDifficulty] = useState(problem?.difficulty ?? 3);
  const [computeNote, setComputeNote] = useState(problem?.compute_note ?? "");
  const [sourceUrl, setSourceUrl] = useState(problem?.source_url ?? "");
  const [externalWeight, setExternalWeight] = useState(String(problem?.scoring_config?.external_weight_percent ?? 0));
  const [externalWeightError, setExternalWeightError] = useState("");
  const [statement, setStatement] = useState(problem?.statement_md ?? initialStatement);
  const [submissionFields, setSubmissionFields] = useState((problem?.submission_schema.fields ?? ["repository", "report"]).join(", "));
  const [rubric, setRubric] = useState(rubricText(problem) || "engineering: 0.4\ncompleteness: 0.3\nidea: 0.3");
  const [formError, setFormError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const toast = useToast();
  const selectedTrack = tracks.find((item) => item.track.id === trackId) ?? { track: initialTrack, competition };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setExternalWeightError("");
    const validationError = validateForm(event.currentTarget);
    if (validationError) return;
    const parsedExternalWeight = Number(externalWeight);
    if (!Number.isFinite(parsedExternalWeight) || parsedExternalWeight < 0 || parsedExternalWeight > 100) {
      setExternalWeightError("请输入 0 到 100 之间的比例。");
      return;
    }
    try {
      const body = {
        code,
        slug,
        title,
        summary,
        status,
        difficulty,
        compute_note: computeNote,
        source_url: sourceUrl || null,
        statement_md: statement,
        submission_schema: {
          fields: submissionFields.split(",").map((field) => field.trim()).filter(Boolean),
          readme_required: true,
        },
        judging_schema: { rubric: parseRubric(rubric) },
        scoring_config: { external_weight_percent: parsedExternalWeight },
      };
      if (isNew) {
        const result = await api<Problem>(`/tracks/${trackId}/problems`, { method: "POST", ...jsonBody(body) });
        await reload();
        toast.success(status === "published" ? "赛题已创建并发布" : "赛题草稿已创建");
        onCreated(result.id);
      } else if (problem) {
        await api(`/manage/problems/${problem.id}`, { method: "PATCH", ...jsonBody(body) });
        await reload();
        toast.success("赛题已保存");
      }
    } catch (requestError) {
      setFormError(formatApiError(requestError));
    }
  }

  async function remove() {
    if (!problem) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api(`/manage/problems/${problem.id}`, { method: "DELETE" });
      toast.success("赛题已删除");
      onDeleted();
    } catch (requestError) {
      setDeleteError(formatApiError(requestError));
    } finally {
      setDeleting(false);
    }
  }

  return <>
    <AppShell title={isNew ? "发布赛题" : `编辑：${problem?.title}`} eyebrow="PROBLEM WORKBENCH" actions={<Link className="outline-button" href={`/manage/competitions/${selectedTrack.competition.id}`}><ArrowLeft size={15} />返回赛事</Link>}>
      <div className="problem-editor-layout">
        <form className="manage-form problem-editor-form" onSubmit={save} noValidate>
          <div className="manage-form-header">
            <div>
              <StatusPill tone={status === "published" ? "live" : status === "draft" ? "warm" : "muted"}>{status === "published" ? "发布后公开" : status === "draft" ? "草稿" : "候选"}</StatusPill>
              <h2>{isNew ? "新建赛题" : "赛题设置"}</h2>
            </div>
            <div className="editor-head-actions">
              {!isNew && <button type="button" className="danger-button subtle" onClick={() => setDeleteOpen(true)}><Trash2 size={14} />删除</button>}
              <button className="primary-button"><Save size={14} />{isNew ? "创建赛题" : "保存赛题"}</button>
            </div>
          </div>
          <>
            <div className="form-grid">
              <label className="form-field"><span>所属赛道</span><select value={trackId} onChange={(event) => setTrackId(event.target.value)} disabled={!isNew}>{tracks.map((item) => <option value={item.track.id} key={item.track.id}>{item.competition.name} / {item.track.name}</option>)}</select></label>
              <label className="form-field"><span>状态</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">草稿</option><option value="candidate">候选题</option><option value="published">正式发布</option><option value="archived">归档</option></select></label>
            </div>
            <div className="form-grid">
              <label className="form-field"><span>题目编号</span><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="DL-001" required /></label>
              <label className="form-field"><span>URL 标识</span><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="problem-name" required /></label>
            </div>
            <label className="form-field"><span>题目名称</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
            <label className="form-field"><span>一句话简介</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} /></label>
            <div className="form-grid">
              <label className="form-field"><span>难度（1—5）</span><input type="number" min="1" max="5" value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))} /></label>
              <label className="form-field"><span>参考资料 URL</span><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label>
            </div>
            <label className="form-field"><span>算力与环境说明</span><input value={computeNote} onChange={(event) => setComputeNote(event.target.value)} /></label>
            <label className="form-field external-score-field" data-invalid={Boolean(externalWeightError)}><span>外部评分权重</span><span className="unit-input"><input type="number" min="0" max="100" step="1" value={externalWeight} onChange={(event) => { setExternalWeight(event.target.value); setExternalWeightError(""); }} aria-invalid={Boolean(externalWeightError)} /><b>%</b></span><FieldError>{externalWeightError}</FieldError><small>0% 仅在线评审，100% 仅外部评分；中间值会与在线评审按比例合并。</small></label>
            <MarkdownEditor label="题面" name="problem-statement" value={statement} onChange={setStatement} required height={580} />
            <div className="form-grid">
              <label className="form-field"><span>提交字段</span><textarea value={submissionFields} onChange={(event) => setSubmissionFields(event.target.value)} rows={5} /><small>使用英文逗号分隔，例如 repository, demo_url, report</small></label>
              <label className="form-field"><span>评分项与权重</span><textarea className="mono-textarea" value={rubric} onChange={(event) => setRubric(event.target.value)} rows={5} /><small>每行一个，例如 engineering: 0.4</small></label>
            </div>
          </>
          <FieldError>{formError}</FieldError>
        </form>
        <aside className="problem-editor-guide"><FilePlus2 size={19} /><strong>发布检查</strong><ul><li>题目目标与交付物明确</li><li>提交字段和评分项一致</li><li>外部数据和授权可访问</li><li>平台只记录材料，不执行代码</li></ul><p>将状态设为“正式发布”并保存后，题目会出现在公开赛道页面。</p></aside>
      </div>
    </AppShell>
    <ConfirmDialog open={deleteOpen} title={`删除赛题“${problem?.title ?? ""}”？`} description="没有作品提交时可以删除；已有提交的赛题必须保留版本记录并改为归档。" busy={deleting} error={deleteError} onCancel={() => { setDeleteOpen(false); setDeleteError(""); }} onConfirm={() => void remove()} />
  </>;
}
