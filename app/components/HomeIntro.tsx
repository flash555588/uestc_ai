"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { createHomeIntro, INTRO_EXIT_MS } from "@/app/lib/homeIntro";
import "./home-intro.css";

// In-memory only: refresh replays; returning from another route does not.
let hasSeenIntro = false;

function WordBand({ outline = false }: { outline?: boolean }) {
  return <div className={`intro-band ${outline ? "intro-band-outline" : "intro-band-solid"}`}>
    <div className="intro-ticker">
      {[0, 1].map((copy) => <div className="intro-word-group" key={copy}>
        <span>UESTC AI</span><span>UESTC AI</span>
      </div>)}
    </div>
  </div>;
}

export function HomeIntro() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const controller = useRef<ReturnType<typeof createHomeIntro> | null>(null);
  useEffect(() => {
    if (!dialogRef.current) return;
    const intro = createHomeIntro(dialogRef.current, () => { hasSeenIntro = true; });
    controller.current = intro;
    if (!hasSeenIntro) intro.play();
    return () => { intro.destroy(); controller.current = null; };
  }, []);

  return <>
    <button className="intro-replay" type="button" onClick={() => controller.current?.play(true)}>
      <RotateCcw size={13} aria-hidden="true" />重播开场
    </button>
    <dialog
      ref={dialogRef}
      className="home-intro"
      aria-labelledby="home-intro-title"
      aria-describedby="home-intro-description"
      style={{ "--intro-exit-duration": `${INTRO_EXIT_MS}ms` } as CSSProperties}
    >
      <h2 id="home-intro-title" className="intro-heading">Welcome.</h2>
      <p id="home-intro-description" className="sr-only">电子科技大学 AI 社开场动画，可随时跳过。减少动态效果模式下，重播为静态预览。</p>
      <div className="intro-diagonal" aria-hidden="true"><WordBand outline /><WordBand /></div>
      <div className="intro-bottom">
        <span aria-hidden="true">IDEAS INTO PRACTICE.</span>
        <button className="intro-skip" type="button" onClick={() => controller.current?.skip()}>
          进入首页 / 跳过 <ArrowUpRight size={17} aria-hidden="true" />
        </button>
      </div>
    </dialog>
  </>;
}
