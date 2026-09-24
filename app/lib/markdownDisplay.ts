export function stripRepeatedLead(markdown: string, title: string, summary?: string): string {
  const leadingHeading = markdown.match(/^\s*#\s+([^\r\n]+)(?:\r?\n|$)/);
  const heading = leadingHeading?.[1].replace(/\s+#+\s*$/, "").trim();
  const withoutHeading = leadingHeading && heading === title.trim()
    ? markdown.slice(leadingHeading[0].length).trimStart()
    : markdown;
  if (!summary) return withoutHeading;

  const firstLine = withoutHeading.match(/^([^\r\n]+)(?:\r?\n|$)/);
  return firstLine?.[1].trim() === summary.trim()
    ? withoutHeading.slice(firstLine[0].length).trimStart()
    : withoutHeading;
}
