"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

type RevealSectionProps = ComponentPropsWithoutRef<"section"> & {
  reveal?: "default" | "slide";
};

/** Progressive enhancement: content stays readable without JavaScript or motion. */
export function RevealSection({ reveal = "default", ...props }: RevealSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !("IntersectionObserver" in window) || !section.animate) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;

    const animations: Animation[] = [];
    const items = Array.from(section.querySelectorAll<HTMLElement>(
      ".section-header, [data-reveal-item]",
    ));
    const targets = items.length ? items : [section];
    const observer = new IntersectionObserver((entries) => {
      let order = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (preference.matches || section.contains(document.activeElement)) return;
        const slide = reveal === "slide";
        animations.push(entry.target.animate(
          [
            { opacity: slide ? 0.2 : 0.45, transform: `translateY(${slide ? 42 : 12}px)` },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: slide ? 620 : 460,
            delay: slide ? Math.min(targets.findIndex((target) => target === entry.target) * 70, 210) : Math.min(order++ * 55, 165),
            easing: "cubic-bezier(.22, 1, .36, 1)",
            fill: "backwards",
          },
        ));
      });
    }, { threshold: 0, rootMargin: reveal === "slide" ? "0px 0px -18% 0px" : "0px 0px -24px 0px" });
    const presenceObserver = reveal === "slide" ? new IntersectionObserver(([entry]) => {
      section.toggleAttribute("data-motion-active", entry.isIntersecting);
    }, { rootMargin: "80px 0px" }) : null;
    presenceObserver?.observe(section);

    const stop = () => {
      observer.disconnect();
      presenceObserver?.disconnect();
      section.removeAttribute("data-motion-active");
      animations.forEach((animation) => animation.cancel());
    };
    const onPreferenceChange = () => { if (preference.matches) stop(); };
    // Items already visible on mount never flash or replay during data updates.
    targets.forEach((target) => {
      const initialBoundary = reveal === "slide" ? window.innerHeight * 0.8 : window.innerHeight;
      if (target.getBoundingClientRect().top >= initialBoundary) observer.observe(target);
    });
    section.addEventListener("focusin", stop);
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      stop();
      section.removeEventListener("focusin", stop);
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [props.children, reveal]);

  return <section ref={sectionRef} {...props} />;
}
