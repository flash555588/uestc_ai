import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../app/components/RevealSection.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function mount({ reduced = false, tops = [900, 900, 900], supported = true, reveal = "default" } = {}) {
  const effects = [];
  const animations = [];
  const watched = new Set();
  const presenceWatched = new Set();
  const listeners = new Map();
  const preference = {
    matches: reduced,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
  };
  const items = tops.map((top) => ({
    getBoundingClientRect: () => ({ top }),
    animate: (frames, options) => {
      const animation = { frames, options, canceled: false, cancel() { this.canceled = true; } };
      animations.push(animation);
      return animation;
    },
  }));
  const section = {
    animate() {},
    querySelectorAll: () => items,
    contains: () => false,
    toggleAttribute: (name, present) => { if (present) section[name] = true; else delete section[name]; },
    removeAttribute: (name) => { delete section[name]; },
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
  };
  let onIntersection;
  let onPresence;
  let observerOptions;
  class Observer {
    constructor(callback, options) {
      this.presence = options?.rootMargin === "80px 0px";
      if (this.presence) onPresence = callback;
      else { onIntersection = callback; observerOptions = options; }
    }
    observe(item) { (this.presence ? presenceWatched : watched).add(item); }
    unobserve(item) { (this.presence ? presenceWatched : watched).delete(item); }
    disconnect() { (this.presence ? presenceWatched : watched).clear(); }
  }
  const moduleRecord = { exports: {} };
  const context = {
    module: moduleRecord, exports: moduleRecord.exports,
    window: { innerHeight: 800, matchMedia: () => preference, ...(supported ? { IntersectionObserver: Observer } : {}) },
    document: { activeElement: null },
    IntersectionObserver: Observer,
    require: (id) => {
      if (id === "react") return { useRef: () => ({ current: section }), useEffect: (effect) => effects.push(effect) };
      if (id === "react/jsx-runtime") return { jsx: () => null };
      throw new Error(`Unexpected import: ${id}`);
    },
  };
  vm.runInNewContext(compiled, context);
  moduleRecord.exports.RevealSection({ children: null, reveal });
  const cleanup = effects[0]();
  return { watched, presenceWatched, animations, listeners, preference, cleanup, observerOptions, section,
    enter() { onIntersection([...watched].map((target) => ({ target, isIntersecting: true }))); },
    setPresence(visible) { onPresence?.([{ target: section, isIntersecting: visible }]); },
  };
}

test("offscreen items reveal once with bounded stagger", () => {
  const state = mount({ tops: [900, 900, 900, 900, 900] });
  state.enter();
  assert.equal(state.watched.size, 0);
  assert.deepEqual(state.animations.map((a) => a.options.delay), [0, 55, 110, 165, 165]);
  state.enter();
  assert.equal(state.animations.length, 5);
  state.cleanup();
  assert.ok(state.animations.every((a) => a.canceled));
  assert.equal(state.listeners.size, 0);
});

test("already visible content does not replay", () => {
  const state = mount({ tops: [100, 300, 900] });
  assert.equal(state.watched.size, 1);
  state.enter();
  assert.equal(state.animations.length, 1);
  state.cleanup();
});

test("second-screen items slide in after crossing the inner viewport", () => {
  const state = mount({ reveal: "slide", tops: [100, 600, 700, 760, 900] });
  assert.equal(state.watched.size, 3);
  assert.equal(state.observerOptions.rootMargin, "0px 0px -18% 0px");
  assert.equal(state.presenceWatched.size, 1);
  state.setPresence(true);
  assert.equal(state.section["data-motion-active"], true);
  state.enter();
  assert.deepEqual(state.animations.map((a) => a.options.delay), [140, 210, 210]);
  assert.ok(state.animations.every((a) => a.options.duration === 620));
  assert.ok(state.animations.every((a) => a.frames[0].transform === "translateY(42px)"));
  state.setPresence(false);
  assert.equal(state.section["data-motion-active"], undefined);
  state.cleanup();
});

test("reduced motion and unsupported browsers keep content static", () => {
  for (const options of [{ reduced: true }, { supported: false }]) {
    const state = mount(options);
    assert.equal(state.watched.size, 0);
    assert.equal(state.animations.length, 0);
    assert.equal(state.listeners.size, 0);
  }
});

test("keyboard focus and changing motion preference cancel reveals", () => {
  for (const event of ["focusin", "change"]) {
    const state = mount();
    state.enter();
    if (event === "change") state.preference.matches = true;
    state.listeners.get(event)();
    assert.ok(state.animations.every((a) => a.canceled));
    assert.equal(state.watched.size, 0);
    state.cleanup();
  }
});
