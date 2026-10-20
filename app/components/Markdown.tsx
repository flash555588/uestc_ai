import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { resolveMarkdownUrl } from "@/app/lib/api";

function MarkdownImage({ src, alt, ...props }: React.ComponentPropsWithoutRef<"img">) {
  // Uploaded Markdown images do not have known dimensions, so next/image cannot size them safely.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={typeof src === "string" ? resolveMarkdownUrl(src) : src} alt={alt ?? ""} loading="lazy" {...props} />;
}

function slugifyHeading(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  return "";
}

function createHeading(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"): Components["h1"] {
  return function Heading({ children, id, ...props }) {
    const resolvedId = (id ?? slugifyHeading(extractText(children))) || undefined;
    return (
      <Tag id={resolvedId} {...props}>
        {children}
      </Tag>
    );
  };
}

export const markdownComponents: Components = {
  a: ({ href, children, ...props }) => <a href={resolveMarkdownUrl(href)} rel="noreferrer" {...props}>{children}</a>,
  img: MarkdownImage,
  h1: createHeading("h1"),
  h2: createHeading("h2"),
  h3: createHeading("h3"),
  h4: createHeading("h4"),
  h5: createHeading("h5"),
  h6: createHeading("h6"),
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
