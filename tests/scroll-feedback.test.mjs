import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../app/lib/scrollFeedback.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function mount({ reduced = false, height = 2400 } = {}) {
  const events = new Map();
  const clicks = new Map();
  const frames = new Map();
  const progress = { style: {} };
  const button = { hidden: true, addEventListener: (k, fn) => clicks.set(k, fn), removeEventListener: (k) => clicks.delete(k) };
  let focused = false;
  let resize;
  let disconnected = false;
  let nextFrame = 0;
  const document = { documentElement: { scrollHeight: height }, body: {} };
  const window = {
    innerHeight: 800, scrollY: 0,
    addEventListener: (k, fn) => events.set(k, fn), removeEventListener: (k) => events.delete(k),
    requestAnimationFrame: (fn) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
    matchMedia: () => ({ matches: reduced }),
    scrollTo: (options) => { window.lastScroll = options; },
  };
  const moduleRecord = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: moduleRecord.exports, document, window,
    ResizeObserver: class {
      constructor(fn) { resize = fn; }
      observe() {}
      disconnect() { disconnected = true; }
    },
  });
  const cleanup = moduleRecord.exports.bindScrollFeedback(progress, button, { focus: (options) => { focused = options.preventScroll; } });
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach((fn) => fn()); };
  return { window, document, progress, button, frames, events, clicks, cleanup, flush,
    resize: () => resize(), get focused() { return focused; }, get disconnected() { return disconnected; },
  };
}

test("scroll progress is clamped and top control only appears after scrolling", () => {
  const s = mount(); s.flush();
  assert.equal(s.progress.style.transform, "scaleX(0)"); assert.equal(s.button.hidden, true);
  s.window.scrollY = 800; s.events.get("scroll")(); s.flush();
  assert.equal(s.progress.style.transform, "scaleX(0.5)"); assert.equal(s.button.hidden, false);
  s.window.scrollY = 5000; s.events.get("scroll")(); s.flush();
  assert.equal(s.progress.style.transform, "scaleX(1)");
  s.window.scrollY = -20; s.events.get("scroll")(); s.flush();
  assert.equal(s.progress.style.transform, "scaleX(0)"); s.cleanup();
});

test("short pages stay empty and late content recalculates progress", () => {
  const s = mount({ height: 500 }); s.flush();
  assert.equal(s.progress.style.transform, "scaleX(0)"); assert.equal(s.button.hidden, true);
  s.document.documentElement.scrollHeight = 2400; s.window.scrollY = 800; s.resize(); s.flush();
  assert.equal(s.progress.style.transform, "scaleX(0.5)"); s.cleanup();
});

test("return-to-top restores focus and respects reduced motion", () => {
  for (const reduced of [true, false]) {
    const s = mount({ reduced }); s.clicks.get("click")();
    assert.equal(s.focused, true); assert.equal(s.window.lastScroll.top, 0);
    assert.equal(s.window.lastScroll.behavior, reduced ? "instant" : "smooth"); s.cleanup();
  }
});

test("events coalesce to one frame and unmount removes all bindings", () => {
  const s = mount(); s.events.get("scroll")(); s.events.get("resize")(); s.resize();
  assert.equal(s.frames.size, 1); s.cleanup();
  assert.equal(s.frames.size, 0); assert.equal(s.events.size, 0); assert.equal(s.clicks.size, 0);
  assert.equal(s.disconnected, true); s.resize(); assert.equal(s.frames.size, 0);
});
