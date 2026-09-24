"use client";

import { useEffect, useRef, useState } from "react";
import { TERMINAL_WELCOME_ART } from "@/app/lib/terminalWelcomeArt";
import { colorizeTerminalArt } from "@/app/lib/terminalColorArt";
const rows = colorizeTerminalArt(TERMINAL_WELCOME_ART);
const columns = Math.max(...TERMINAL_WELCOME_ART.split("\n").map((line) => line.length));

export function TerminalWelcomeArt() {
  const root = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(14);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const resize = () => {
      const width = (measure.current?.getBoundingClientRect().width ?? 84) / 10;
      if (width > 0 && element.clientWidth > 0) setFontSize(Math.max(8, Math.min(14, element.clientWidth / (columns * width / 14))));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div className="va-art-stage" ref={root}>
    <span className="va-art-measure" ref={measure} aria-hidden="true">0000000000</span>
    <pre className="terminal-welcome-art" style={{ fontSize }} role="img" aria-label="UESTC AI 彩色方块阴影字符画">{rows.map((segments, row) => <span key={row}>{segments.map((segment, column) => <span key={column} style={{ color: segment.color }}>{segment.text}</span>)}{row < rows.length - 1 ? "\n" : ""}</span>)}</pre>
  </div>;
}
