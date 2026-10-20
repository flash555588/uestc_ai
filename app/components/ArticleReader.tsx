"use client";

import { useEffect, useMemo, useState } from "react";
import { Markdown } from "@/app/components/Markdown";

type OutlineItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

function slugifyHeading(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function extractOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  const seen = new Set<string>();
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length === 2 ? 2 : 3;
    const text = match[2].trim();
    let id = slugifyHeading(text);
    if (!id) continue;
    if (seen.has(id)) id = `${id}-${seen.size}`;
    seen.add(id);
    items.push({ id, text, level });
  }
  return items;
}

function estimateReadingTime(markdown: string) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-|[\]()]/g, " ")
    .trim();
  const cjk = (text.match(/[\p{Script=Han}]/gu) || []).length;
  const latin = (text.match(/[A-Za-z0-9]+/g) || []).length;
  const minutes = Math.max(1, Math.round(cjk / 420 + latin / 220));
  return minutes;
}

export function ArticleReader({
  markdown,
  className = "markdown-body article-body",
  meta,
}: {
  markdown: string;
  className?: string;
  meta?: React.ReactNode;
}) {
  const outline = useMemo(() => extractOutline(markdown), [markdown]);
  const minutes = useMemo(() => estimateReadingTime(markdown), [markdown]);
  const [activeId, setActiveId] = useState<string | null>(outline[0]?.id ?? null);

  useEffect(() => {
    if (outline.length === 0) return;
    const headings = outline
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0, 1] },
    );
    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [outline]);

  return (
    <div className="article-reader">
      <div className="article-reader-main">
        <div className="article-reader-meta">
          <span>约 {minutes} 分钟读完</span>
          {outline.length > 0 && <span>{outline.length} 个小节</span>}
          {meta}
        </div>
        <Markdown className={className}>{markdown}</Markdown>
      </div>
      {outline.length > 1 && (
        <nav className="article-toc" aria-label="文章目录">
          <strong>目录</strong>
          <ol>
            {outline.map((item) => (
              <li key={item.id} className={item.level === 3 ? "level-3" : undefined}>
                <a href={`#${item.id}`} className={activeId === item.id ? "active" : undefined}>
                  {item.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  );
}
