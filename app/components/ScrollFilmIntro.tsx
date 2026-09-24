"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { KineticTypeBackdrop } from "./KineticTypeBackdrop";
import { getFilmSceneLayout, getFilmSequence, getFilmWindowLayout } from "@/app/lib/scrollFilmLayout";
import "./scroll-film-intro.css";

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function ScrollFilmIntro() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [viewport, setViewport] = useState({ width: 1440, height: 800 });

  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const section = sectionRef.current;
      if (!section) return;
      const headerHeight = window.innerWidth <= 820 ? 56 : 88;
      const nextViewport = { width: window.innerWidth, height: Math.max(window.innerHeight - headerHeight, 1) };
      const { scrollDistance } = getFilmSceneLayout(nextViewport);
      const bounds = section.getBoundingClientRect();
      const nextProgress = clamp((headerHeight - bounds.top) / scrollDistance);
      setViewport((current) => current.width === nextViewport.width && current.height === nextViewport.height ? current : nextViewport);
      setProgress(nextProgress);
    };
    const queueUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const restoreEntrance = () => {
      const section = sectionRef.current;
      if (!section) return;
      const headerHeight = window.innerWidth <= 820 ? 56 : 88;
      const bounds = section.getBoundingClientRect();
      // A restored mid-film scroll position shows only a clipped, faded-out cover.
      // Restart that short intro, but keep positions already in the content below it.
      if (window.scrollY > 1 && bounds.top < headerHeight && bounds.bottom > headerHeight) {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      queueUpdate();
    };
    update();
    restoreEntrance();
    const restoreFrame = window.requestAnimationFrame(restoreEntrance);
    window.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate);
    window.addEventListener("pageshow", restoreEntrance);
    window.addEventListener("popstate", restoreEntrance);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(restoreFrame);
      window.removeEventListener("scroll", queueUpdate);
      window.removeEventListener("resize", queueUpdate);
      window.removeEventListener("pageshow", restoreEntrance);
      window.removeEventListener("popstate", restoreEntrance);
    };
  }, []);

  const { expansion, letters, mascot } = getFilmSequence(progress);
  const scene = getFilmSceneLayout(viewport, expansion);
  const { width, height, top, headingTop } = getFilmWindowLayout(viewport, expansion);
  const frameStyle = {
    top,
    width,
    height,
    "--film-reveal": mascot,
    "--film-prelude": letters,
  } as CSSProperties;

  return (
    <section ref={sectionRef} className="scroll-film" style={{ height: scene.height }} aria-labelledby="home-film-title">
      <div className="scroll-film__sticky" style={{ height: scene.stickyHeight }}>
        <div className="scroll-film__intro-label" aria-hidden="true">
          <span>UESTC AI / 001</span>
        </div>
        <h1
          id="home-film-title"
          className="scroll-film__heading"
          style={{ top: headingTop }}
        >让灵感，被看见。</h1>
        <div className="scroll-film__window" style={frameStyle}>
          <div className="scroll-film__prelude" aria-hidden="true">
            <strong>Welcome.</strong>
            <div className="scroll-film__type-stage">
              <div className="scroll-film__type-band scroll-film__type-band--outline">
                <div className="scroll-film__type-ticker">
                  <span>UESTC AI&nbsp; UESTC AI&nbsp;</span><span>UESTC AI&nbsp; UESTC AI&nbsp;</span>
                </div>
              </div>
              <div className="scroll-film__type-band scroll-film__type-band--solid">
                <div className="scroll-film__type-ticker">
                  <span>UESTC AI&nbsp; UESTC AI&nbsp;</span><span>UESTC AI&nbsp; UESTC AI&nbsp;</span>
                </div>
              </div>
            </div>
            <span className="scroll-film__prelude-note">IDEAS INTO PRACTICE.</span>
          </div>
          <KineticTypeBackdrop progress={1} />
          <div className="scroll-film__grain" aria-hidden="true" />
          <div className="scroll-film__counter" aria-hidden="true">
            <span>UESTC AI</span>
          </div>
        </div>
      </div>
    </section>
  );
}
