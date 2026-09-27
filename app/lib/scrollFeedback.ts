/** Bind inexpensive scroll feedback; all listeners are removed on route changes. */
export function bindScrollFeedback(progress: HTMLElement, button: HTMLButtonElement, target: HTMLElement) {
  let frame = 0;
  let disposed = false;
  const update = () => {
    frame = 0;
    if (disposed) return;
    const range = document.documentElement.scrollHeight - window.innerHeight;
    const amount = range > 0 ? Math.max(0, Math.min(1, window.scrollY / range)) : 0;
    progress.style.transform = `scaleX(${amount})`;
    button.hidden = range <= 0 || window.scrollY < Math.max(480, window.innerHeight * 0.75);
  };
  const schedule = () => {
    if (!frame && !disposed) frame = window.requestAnimationFrame(update);
  };
  const toTop = () => {
    target.focus({ preventScroll: true });
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  button.addEventListener("click", toTop);
  // Late API content and images can change the document height without scrolling.
  const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
  observer?.observe(document.body);
  schedule();
  return () => {
    disposed = true;
    window.cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    button.removeEventListener("click", toTop);
    observer?.disconnect();
  };
}
