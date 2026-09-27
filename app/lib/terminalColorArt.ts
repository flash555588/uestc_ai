/** The exact color sequence supplied by the user for console.log('%c…'). */
export const CONSOLE_ART_COLORS = [
  "#ff0000", "#ff0000", "#ff3b00", "#ff7500", "#ff7800", "#FD7B00",
  "#FFAD00", "#FEDA00", "#D0FD00", "#93FF00", "#80FF00", "#1AFF00",
  "#00FF2E", "#00FF3B", "#00FFB1", "#00F2F9", "#00E0F9",
] as const;
export type ColoredArtSegment = { text: string; color: string };

/** Keep every source character/space/newline; only attach presentation metadata. */
export function colorizeTerminalArt(source: string): ColoredArtSegment[][] {
  const lines = source.split("\n");
  const paintedRows = lines.length - (source.endsWith("\n") ? 1 : 0);
  const chunkWidth = Math.max(1, Math.ceil(Math.max(...lines.map((line) => line.length)) / 3));
  const lastPosition = Math.max(1, paintedRows * 3 - 1);
  return lines.map((line, row) => {
    const segments: ColoredArtSegment[] = [];
    for (let start = 0, column = 0; start < line.length; start += chunkWidth, column++) {
      const colorIndex = Math.min(CONSOLE_ART_COLORS.length - 1, Math.round(((row * 3 + column) / lastPosition) * (CONSOLE_ART_COLORS.length - 1)));
      segments.push({ text: line.slice(start, start + chunkWidth), color: CONSOLE_ART_COLORS[colorIndex] });
    }
    return segments;
  });
}

export function buildColoredConsoleArt(source: string): { format: string; styles: string[] } {
  const rows = colorizeTerminalArt(source);
  return {
    format: rows.map((segments) => segments.map(({ text }) => `%c${text}`).join("")).join("\n"),
    styles: rows.flatMap((segments) => segments.map(({ color }) => `color:${color};font-family:monospace`)),
  };
}
