"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, Code2, Newspaper, Trophy } from "lucide-react";
import { AppShell } from "@/app/components/AppShell";
import { EmptyState, PageError, PageLoading, StatusPill } from "@/app/components/ui";
import { api, formatApiError } from "@/app/lib/api";
import type { Competition, ContentItem, Track } from "@/app/lib/domain";
import { formatBeijing } from "@/app/lib/time";

const accents = ["coral", "ink", "sage", "sand"];

function trackAccent(track: Track, index: number) {
  const value = track.config?.accent;
  return value && accents.includes(value) ? value : accents[index % accents.length];
}

function shortDate(value?: string | null) {
  if (!value) return "待公布";
  return formatBeijing(value, { month: "2-digit", day: "2-digit" });
}

function competitionPhase(competition: Competition): { label: string; tone: "live" | "warm" | "muted" } {
  if (competition.status !== "published") return { label: competition.status, tone: "muted" };
  const now = Date.now();
  const registrationOpen = competition.registration_opens_at ? new Date(competition.registration_opens_at).getTime() : null;
  const registrationClose = competition.registration_closes_at ? new Date(competition.registration_closes_at).getTime() : null;
  const starts = competition.starts_at ? new Date(competition.starts_at).getTime() : null;
  const ends = competition.ends_at ? new Date(competition.ends_at).getTime() : null;
  if (ends && now > ends) return { label: "已结束", tone: "muted" };
  if (starts && now >= starts) return { label: "比赛进行中", tone: "live" };
  if ((!registrationOpen || now >= registrationOpen) && (!registrationClose || now <= registrationClose)) return { label: "报名中", tone: "warm" };
  return { label: "已发布", tone: "live" };
}

export default function Home() {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [articles, setArticles] = useState<ContentItem[]>([]);
  const [articleError, setArticleError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setArticleError("");
    try {
      const competitions = await api<Competition[]>("/competitions?status=published");
      const featured = competitions[0] ?? null;
      const [detailResult, contentResult] = await Promise.allSettled([
        featured ? api<Competition>(`/competitions/${featured.slug}`) : Promise.resolve(null),
        api<ContentItem[]>("/content"),
      ]);
      if (detailResult.status === "fulfilled") setCompetition(detailResult.value);
      else setError(formatApiError(detailResult.reason));
      if (contentResult.status === "fulfilled") setArticles(contentResult.value.slice(0, 4));
      else setArticleError(formatApiError(contentResult.reason));
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; };
  }, [load]);

  const featuredProblems = useMemo(
    () => competition?.tracks?.flatMap((track) => (track.problems ?? []).map((problem) => ({ problem, track }))).slice(0, 5) ?? [],
    [competition],
  );

  return (
    <AppShell contained={false}>
      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow"><i />UESTC / AI COMMUNITY</span>
          <h1>电子科技大学<br />AI 社</h1>
          <p className="hero-statement">从一个问题出发，做出值得被看见的作品。</p>
          <p className="hero-description">在这里浏览社内赛事与技术内容，组队参赛、提交成果，也分享实践中的方法、经验与思考。</p>
          <div className="hero-actions">
            <Link className="primary-button" href="/competitions">查看正在进行的比赛 <ArrowRight size={16} /></Link>
            <Link className="text-button" href="/news">阅读最近发布</Link>
          </div>
        </div>
        {loading ? <aside className="hero-season hero-season-loading" aria-label="正在读取当前赛事"><span className="season-skeleton short" /><span className="season-skeleton icon" /><span className="season-skeleton title" /><span className="season-skeleton line" /><span className="season-skeleton line narrow" /></aside> : competition ? (() => {
          const phase = competitionPhase(competition);
          return <aside className="hero-season" aria-label="当前赛事">
            <div className="season-top"><StatusPill tone={phase.tone}>{phase.label}</StatusPill><span>{competition.slug}</span></div>
            <Trophy size={24} strokeWidth={1.4} />
            <h2>{competition.name}</h2>
            <p>{competition.summary}</p>
            <div className="season-dates"><span>报名截止</span><strong>{shortDate(competition.registration_closes_at)}</strong></div>
            <Link href={`/competitions/${competition.slug}`}>进入赛事 <ArrowRight size={15} /></Link>
          </aside>;
        })() : <aside className="hero-season hero-season-error" aria-label="赛事数据状态"><div className="season-top"><StatusPill tone={error ? "danger" : "muted"}>{error ? "连接失败" : "暂无赛事"}</StatusPill><span>DATABASE</span></div><Trophy size={24} strokeWidth={1.4} /><h2>{error ? "赛事数据不可用" : "暂无公开赛事"}</h2><p>{error || "主办方发布赛事后，这里会自动显示。"}</p>{error && <button className="season-retry" onClick={() => void load()}>重新连接 <ArrowRight size={15} /></button>}</aside>}
      </section>

      <div className="home-sections">
        {loading ? <PageLoading label="正在读取赛事" /> : error ? <PageError message={error} retry={load} /> : competition ? (
          <section className="home-section">
            <header className="section-header">
              <div><span className="eyebrow"><i />TRACKS</span><h2>从赛道进入题目</h2></div>
              <Link href={`/competitions/${competition.slug}`}>完整赛事说明 <ArrowRight size={15} /></Link>
            </header>
            <div className="track-grid">
              {(competition.tracks ?? []).map((track, index) => (
                <Link className={`track-card track-${trackAccent(track, index)}`} key={track.id} href={`/competitions/${competition.slug}/tracks/${track.slug}`}>
                  <div className="track-card-top"><span>{String(index + 1).padStart(2, "0")}</span><Code2 size={18} strokeWidth={1.5} /></div>
                  <div><small>{track.config?.short ?? "TRACK"}</small><h3>{track.name}</h3><p>{track.description}</p></div>
                  <footer><span>{track.problems?.length ?? 0} 个题目</span><ArrowRight size={16} /></footer>
                </Link>
              ))}
            </div>
          </section>
        ) : <EmptyState title="暂无公开赛事" description="赛事发布后会在这里显示。" />}

        <section className="home-section split-section">
          <div className="problem-feature">
            <header className="section-header compact-header">
              <div><span className="eyebrow"><i />PROBLEM LIBRARY</span><h2>本期题目</h2></div>
              <Link href="/problems"><BookOpen size={15} />浏览全部</Link>
            </header>
            {featuredProblems.length ? <div className="line-list">
              {featuredProblems.map(({ problem, track }) => (
                <Link className="problem-line" key={problem.id} href={`/competitions/${competition!.slug}/tracks/${track.slug}/problems/${problem.slug}`}>
                  <span className="mono-label">{problem.code}</span>
                  <div><strong>{problem.title}</strong><span>{track.name} · 难度 {problem.difficulty}/5</span></div>
                  <StatusPill tone={problem.status === "published" ? "live" : "warm"}>{problem.status === "published" ? "正式赛题" : "候选"}</StatusPill>
                  <ArrowRight size={15} />
                </Link>
              ))}
            </div> : <EmptyState title="题库正在整理" description="公开题目会按赛道显示。" />}
          </div>
          {competition && <aside className="deadline-block">
            <CalendarDays size={20} />
            <span>关键日期</span>
            <strong>{shortDate(competition?.registration_closes_at)}</strong>
            <p>报名与组队截止</p>
            <hr />
            <strong>{shortDate(competition?.ends_at)}</strong>
            <p>赛事结束</p>
          </aside>}
        </section>

        <section className="home-section news-home">
          <header className="section-header">
            <div><span className="eyebrow"><i />PUBLISHING</span><h2>最近发布</h2></div>
            <Link href="/news"><Newspaper size={15} />进入资讯档案</Link>
          </header>
          {articleError ? <PageError message={articleError} retry={load} /> : articles.length ? <div className="news-lines">{articles.map((article) => (
            <Link className="news-line" href={`/news/${article.slug}`} key={article.id}>
              <time>{article.published_at ? shortDate(article.published_at) : "草稿"}</time>
              <span>{article.kind}</span>
              <strong>{article.title}</strong>
              <ArrowRight size={16} />
            </Link>
          ))}</div> : <EmptyState title="暂无文章" description="公告、博客与技术笔记会出现在这里。" />}
        </section>
      </div>
    </AppShell>
  );
}
