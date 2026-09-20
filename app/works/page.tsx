"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Search } from "lucide-react";
import { AppShell } from "@/app/components/AppShell";
import { EmptyState, PageError, PageLoading } from "@/app/components/ui";
import type { PublicWork } from "@/app/lib/domain";
import { formatBeijing } from "@/app/lib/time";
import { useApiResource } from "@/app/lib/useApiResource";

function displayDate(value: string) {
  return formatBeijing(value, { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function WorksPage() {
  const { data, loading, error, reload } = useApiResource<PublicWork[]>("/works");
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("all");
  const tracks = useMemo(() => Array.from(new Map((data ?? []).map((item) => [item.track_slug, item.track_name])).entries()), [data]);
  const works = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data ?? []).filter((item) => {
      const matchesTrack = track === "all" || item.track_slug === track;
      const searchable = `${item.title} ${item.team_name} ${item.problem_code} ${item.track_name} ${item.competition_name}`.toLowerCase();
      return matchesTrack && (!needle || searchable.includes(needle));
    });
  }, [data, query, track]);

  return (
    <AppShell title="作品档案" eyebrow="SUBMITTED WORKS">
      <div className="page-intro work-archive-intro">
        <p>正式提交后，当前作品的 README、提交信息和附件立即公开；截止前再次保存会直接覆盖当前稿。成绩与排名在赛后统一发布。</p>
        <div className="work-archive-toolbar">
          <label className="search-field"><Search size={15} /><span className="sr-only">搜索作品</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作品、队伍或题目" /></label>
          <label><span className="sr-only">筛选赛道</span><select value={track} onChange={(event) => setTrack(event.target.value)}><option value="all">全部赛道</option>{tracks.map(([slug, name]) => <option value={slug} key={slug}>{name}</option>)}</select></label>
        </div>
      </div>
      {loading ? <PageLoading label="正在读取作品档案" /> : error ? <PageError message={error} retry={reload} /> : !works.length ? <EmptyState title={data?.length ? "没有匹配作品" : "还没有正式作品"} description={data?.length ? "试试其他关键词或赛道。" : "参赛者完成正式提交后，作品会立即出现在这里。"} /> : (
        <div className="work-archive-list">{works.map((work, index) => (
          <Link href={`/works/${work.id}`} key={work.id}>
            <span className="work-archive-index">{String(index + 1).padStart(2, "0")}</span>
            <div className="work-archive-copy"><span>{work.competition_name}</span><h2>{work.title}</h2><p>{work.team_name} · {work.problem_code} · {work.track_name}</p></div>
            <div className="work-version-count"><CheckCircle2 size={14} /><strong>正式提交</strong><span>当前公开稿</span></div>
            <time>{displayDate(work.version.created_at)}</time>
            <ArrowRight size={17} />
          </Link>
        ))}</div>
      )}
    </AppShell>
  );
}
