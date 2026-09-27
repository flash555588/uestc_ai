import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../app/lib/homeIntro.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function setup({ reduced = false, supported = true } = {}) {
  let completed = 0;
  let counter = 0;
  const timers = new Map();
  const dialogEvents = new Map();
  const preferenceEvents = new Map();
  const documentEvents = new Map();
  const document = { hidden: false, body: { style: { overflow: "auto" } },
    addEventListener: (k, fn) => documentEvents.set(k, fn), removeEventListener: (k) => documentEvents.delete(k),
  };
  const preference = { matches: reduced,
    addEventListener: (k, fn) => preferenceEvents.set(k, fn), removeEventListener: (k) => preferenceEvents.delete(k),
  };
  const dialog = { open: false, dataset: {},
    ...(supported ? { showModal() { this.open = true; } } : {}),
    close() { this.open = false; dialogEvents.get("close")?.(); },
    removeAttribute() { delete this.dataset.phase; },
    addEventListener: (k, fn) => dialogEvents.set(k, fn), removeEventListener: (k) => dialogEvents.delete(k),
  };
  const moduleRecord = { exports: {} };
  vm.runInNewContext(compiled, { exports: moduleRecord.exports, document,
    window: {
      matchMedia: () => preference,
      setTimeout: (fn, delay) => { timers.set(++counter, { fn, delay }); return counter; },
      clearTimeout: (id) => timers.delete(id),
    },
  });
  const api = moduleRecord.exports.createHomeIntro(dialog, () => completed++);
  return { api, dialog, document, preference, timers, dialogEvents, preferenceEvents, documentEvents,
    get completed() { return completed; },
    tick(delay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay === delay) { timers.delete(id); timer.fn(); }
      }
    },
  };
}

test("intro exits on a fixed schedule without waiting for data or animation events", () => {
  const s = setup(); s.api.play();
  assert.equal(s.dialog.open, true); assert.equal(s.document.body.style.overflow, "hidden");
  s.tick(2300); assert.equal(s.dialog.dataset.phase, "exit");
  s.tick(700); assert.equal(s.dialog.open, false); assert.equal(s.completed, 1);
  assert.equal(s.document.body.style.overflow, "auto"); assert.equal(s.timers.size, 0); s.api.destroy();
});

test("skip and Escape dismiss immediately and safely support replay", () => {
  const s = setup(); s.api.play(); s.api.skip();
  assert.equal(s.dialog.open, false); assert.equal(s.timers.size, 0);
  s.api.play(true); assert.equal(s.dialog.open, true);
  let prevented = false;
  s.dialogEvents.get("cancel")({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(s.dialog.open, false); assert.equal(s.completed, 2); s.api.destroy();
});

test("reduced motion skips autoplay but allows a static manually-dismissed replay", () => {
  const s = setup({ reduced: true }); s.api.play(); assert.equal(s.dialog.open, false);
  s.api.play(true); assert.equal(s.dialog.open, true); assert.equal(s.timers.size, 0);
  s.api.skip(); assert.equal(s.document.body.style.overflow, "auto"); s.api.destroy();
});

test("changing preferences or hiding the page cannot leave a blocking overlay", () => {
  for (const reason of ["preference", "visibility"]) {
    const s = setup(); s.api.play();
    if (reason === "preference") { s.preference.matches = true; s.preferenceEvents.get("change")(); }
    else { s.document.hidden = true; s.documentEvents.get("visibilitychange")(); }
    assert.equal(s.dialog.open, false); assert.equal(s.timers.size, 0); s.api.destroy();
  }
});

test("unmount cancels timers, releases scroll and does not mark intro complete", () => {
  const s = setup(); s.api.play(); s.api.play(); assert.equal(s.timers.size, 1);
  s.api.destroy(); assert.equal(s.completed, 0); assert.equal(s.document.body.style.overflow, "auto");
  assert.equal(s.dialog.open, false); assert.equal(s.timers.size, 0);
  assert.equal(s.dialogEvents.size + s.preferenceEvents.size + s.documentEvents.size, 0);
  s.api.play(); assert.equal(s.dialog.open, false);
});

test("unsupported dialog API leaves homepage usable", () => {
  const s = setup({ supported: false }); s.api.play();
  assert.equal(s.dialog.open, false); assert.equal(s.timers.size, 0);
  assert.equal(s.document.body.style.overflow, "auto"); s.api.destroy();
});
