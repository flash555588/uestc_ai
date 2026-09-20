import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { resolveMarkdownUrl } from "@/app/lib/api";

function MarkdownImage({ src, alt, ...props }: React.ComponentPropsWithoutRef<"img">) {
  // Uploaded Markdown images do not have known dimensions, so next/image cannot size them safely.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolveMarkdownUrl(src)} alt={alt ?? ""} loading="lazy" {...props} />;
}

export const markdownComponents: Components = {
  a: ({ href, children, ...props }) => <a href={resolveMarkdownUrl(href)} rel="noreferrer" {...props}>{children}</a>,
  img: MarkdownImage,
};

export function Markdown({ children, className = "markdown-body" }: { children: string; className?: string }) {
  return (
    <article className={className}>
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </article>
  );
}
