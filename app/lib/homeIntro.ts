export const INTRO_HOLD_MS = 2300;
export const INTRO_EXIT_MS = 700;

/** A finite brand intro, independent of API loading or animation-event delivery. */
export function createHomeIntro(dialog: HTMLDialogElement, onComplete: () => void) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let holdTimer = 0;
  let exitTimer = 0;
  let running = false;
  let disposed = false;
  let previousOverflow = "";

  const clearTimers = () => {
    window.clearTimeout(holdTimer);
    window.clearTimeout(exitTimer);
  };
  const release = () => {
    clearTimers();
    if (!running) return;
    running = false;
    if (dialog.open) dialog.close();
    document.body.style.overflow = previousOverflow;
    dialog.removeAttribute("data-phase");
  };
  const finish = () => {
    if (!running) return;
    release();
    onComplete();
  };
  const exit = () => {
    if (!running) return;
    if (preference.matches) { finish(); return; }
    dialog.dataset.phase = "exit";
    exitTimer = window.setTimeout(finish, INTRO_EXIT_MS);
  };
  const play = (manual = false) => {
    if (disposed || running || typeof dialog.showModal !== "function") return;
    if (preference.matches && !manual) return;
    previousOverflow = document.body.style.overflow;
    dialog.dataset.phase = "playing";
    dialog.showModal();
    running = true;
    document.body.style.overflow = "hidden";
    // An explicit replay with reduced motion shows a still frame until dismissed.
    if (!preference.matches) holdTimer = window.setTimeout(exit, INTRO_HOLD_MS);
  };
  const cancel = (event: Event) => { event.preventDefault(); finish(); };
  const preferenceChanged = () => { if (preference.matches) finish(); };
  const visibilityChanged = () => { if (document.hidden) finish(); };
  dialog.addEventListener("cancel", cancel);
  dialog.addEventListener("close", finish);
  preference.addEventListener("change", preferenceChanged);
  document.addEventListener("visibilitychange", visibilityChanged);

  return {
    play,
    skip: finish,
    destroy() {
      disposed = true;
      release();
      dialog.removeEventListener("cancel", cancel);
      dialog.removeEventListener("close", finish);
      preference.removeEventListener("change", preferenceChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    },
  };
}
