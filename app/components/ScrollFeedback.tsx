"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { bindScrollFeedback } from "@/app/lib/scrollFeedback";

export function ScrollFeedback() {
  const pathname = usePathname();
  const progressRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const target = document.getElementById("main-content");
    if (!progressRef.current || !buttonRef.current || !target) return;
    return bindScrollFeedback(progressRef.current, buttonRef.current, target);
  }, [pathname]);

  return <>
    <div ref={progressRef} className="reading-progress" aria-hidden="true" />
    <button ref={buttonRef} type="button" className="back-to-top" hidden aria-label="回到顶部" title="回到顶部">
      <ArrowUp size={18} aria-hidden="true" />
      <span>顶部</span>
    </button>
  </>;
}
