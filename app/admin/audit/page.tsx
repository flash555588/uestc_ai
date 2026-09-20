"use client";

import { AdminTabs } from "@/app/components/AdminTabs";
import { AppShell } from "@/app/components/AppShell";
import { useSession } from "@/app/components/SessionProvider";
import { EmptyState, PageError, PageLoading } from "@/app/components/ui";
import type { AuditEntry } from "@/app/lib/domain";
import { formatBeijing } from "@/app/lib/time";
import { useApiResource } from "@/app/lib/useApiResource";

const actionLabels: Record<string, string> = {
  "competition.created": "创建赛事", "competition.updated": "更新赛事", "track.created": "创建赛道", "track.updated": "更新赛道",
  "problem.created": "创建赛题", "problem.updated": "更新赛题", "problem.deleted": "删除赛题", "content.created": "创建内容", "content.updated": "更新内容", "content.deleted": "删除内容",
  "competition.deleted": "删除赛事", "track.deleted": "删除赛道",
  "submission.version_created": "生成提交版本", "review.saved": "保存评审", "score_batch.imported": "导入成绩", "score_batch.status_changed": "更改成绩批次",
  "user.role_changed": "调整用户角色", "team.created": "创建队伍", "team.deleted": "删除队伍", "registration.created": "报名赛道", "registration.deleted": "取消报名", "submission.deleted": "删除草稿作品",
};

export default function AdminAuditPage() {
  const { user, loading: sessionLoading } = useSession();
  const allowed = user?.role === "admin";
  const { data, loading, error, reload } = useApiResource<AuditEntry[]>(allowed ? "/admin/audit?limit=200" : null);
  if (sessionLoading) return <AppShell title="审计记录" eyebrow="ADMIN"><PageLoading /></AppShell>;
  if (!allowed) return <AppShell title="审计记录" eyebrow="ADMIN"><PageError message="当前账户没有系统管理权限。" /></AppShell>;
  return <AppShell title="系统管理" eyebrow="ADMINISTRATION"><AdminTabs /><div className="page-intro"><p>关键写操作会保留操作者、对象、时间和变更字段，便于赛事复核。</p></div>{loading ? <PageLoading /> : error ? <PageError message={error} retry={reload} /> : !data?.length ? <EmptyState title="还没有审计记录" description="后台写操作会记录在这里。" /> : <div className="audit-list"><div className="audit-head"><span>时间</span><span>操作</span><span>操作者</span><span>对象</span><span>详情</span></div>{data.map((entry) => <div key={entry.id}><time>{formatBeijing(entry.created_at, { dateStyle: "short", timeStyle: "medium" })}</time><strong>{actionLabels[entry.action] ?? entry.action}</strong><span>{entry.actor_name ?? "系统"}</span><code>{entry.entity_type} / {entry.entity_id.slice(0, 8)}</code><small>{Object.keys(entry.details).length ? JSON.stringify(entry.details) : "—"}</small></div>)}</div>}</AppShell>;
}
