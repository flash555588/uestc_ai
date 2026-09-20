"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Newspaper } from "lucide-react";
import { AppShell } from "@/app/components/AppShell";
import { EmptyState, PageError, PageLoading } from "@/app/components/ui";
import type { ContentItem } from "@/app/lib/domain";
import { formatBeijing } from "@/app/lib/time";
import { useApiResource } from "@/app/lib/useApiResource";

const filters = [{ value: "all", label: "全部" }, { value: "announcement", label: "公告" }, { value: "blog", label: "博客" }, { value: "research", label: "题目调研" }];

function displayDate(value: string | null) {
  return value ? formatBeijing(value, { year: "numeric", month: "2-digit", day: "2-digit" }) : "草稿";
}

export default function NewsPage() {
  const { data, loading, error, reload } = useApiResource<ContentItem[]>("/content");
  const [kind, setKind] = useState("all");
  const items = useMemo(() => (data ?? []).filter((item) => kind === "all" || item.kind === kind), [data, kind]);
  return (
    <AppShell title="资讯" eyebrow="PUBLISHING">
      <div className="page-intro archive-intro"><p>赛事公告、技术文章、赛题调研和社团活动记录。内容以 Markdown 发布，形成长期可检索的社团档案。</p><div className="segmented-control">{filters.map((item) => <button type="button" className={kind === item.value ? "selected" : ""} key={item.value} onClick={() => setKind(item.value)}>{item.label}</button>)}</div></div>
      {loading ? <PageLoading /> : error ? <PageError message={error} retry={reload} /> : !items.length ? <EmptyState title="这个分类还没有内容" description="发布后会自动进入档案。" /> : <div className="article-archive">{items.map((item, index) => (
        <Link href={`/news/${item.slug}`} key={item.id}>
          <time>{displayDate(item.published_at)}</time><span className="article-kind">{item.kind}</span><div><small>{String(index + 1).padStart(2, "0")}</small><h2>{item.title}</h2><p>{item.excerpt}</p></div><ArrowRight size={18} />
        </Link>
      ))}</div>}
      <div className="archive-end"><Newspaper size={18} /><span>UESTC AI 社内容档案</span></div>
    </AppShell>
  );
}
