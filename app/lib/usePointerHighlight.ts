"use client";

import { useEffect, useRef } from "react";

/** Follow the pointer within directory links without moving their hit targets. */
export function usePointerHighlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const motion = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let active: HTMLElement | null = null;
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (active) {
        for (const property of ["--pointer-x", "--pointer-y", "--pointer-dx", "--pointer-dy", "--pointer-active"]) {
          active.style.removeProperty(property);
        }
      }
      active = null;
    };
    const move = (event: PointerEvent) => {
      if (!motion.matches || event.pointerType !== "mouse") return;
      const card = event.target instanceof Element ? event.target.closest<HTMLElement>(".manifesto-card") : null;
      if (!card || !container.contains(card)) { reset(); return; }
      if (active !== card) { reset(); active = card; }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
        card.style.setProperty("--pointer-x", `${x}px`);
        card.style.setProperty("--pointer-y", `${y}px`);
        card.style.setProperty("--pointer-dx", `${(x / rect.width - .5) * 6}px`);
        card.style.setProperty("--pointer-dy", `${(y / rect.height - .5) * 3}px`);
        card.style.setProperty("--pointer-active", "1");
      });
    };
    container.addEventListener("pointermove", move, { passive: true });
    container.addEventListener("pointerleave", reset);
    container.addEventListener("pointercancel", reset);
    motion.addEventListener("change", reset);
    window.addEventListener("blur", reset);
    return () => {
      reset();
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerleave", reset);
      container.removeEventListener("pointercancel", reset);
      motion.removeEventListener("change", reset);
      window.removeEventListener("blur", reset);
    };
  }, []);

  return ref;
}
