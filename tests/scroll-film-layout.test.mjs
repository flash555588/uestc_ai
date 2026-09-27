import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../app/lib/scrollFilmLayout.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });
const { getFilmWindowLayout, getFilmSceneLayout, getFilmSequence } = exports;
const viewports = [[320, 512], [390, 788], [667, 319], [768, 968], [1024, 512], [1440, 812], [2048, 1023]];

for (const [width, height] of viewports) {
  test(`card keeps its aspect, top edge and margins at ${width}x${height}`, () => {
    const viewport = { width, height };
    const start = getFilmWindowLayout(viewport, 0);
    const initialTop = start.top - start.height / 2;
    const headingHeight = Math.min(60, Math.max(32, width * .04)) * 1.12;
    assert.ok(initialTop - start.headingTop - headingHeight >= 17.99);
    let previous = start.width;
    for (const progress of [0, .25, .5, .75, 1]) {
      const card = getFilmWindowLayout(viewport, progress);
      const endWidth = start.width * 1.08 * 7 / 8;
      if (endWidth >= start.width) assert.ok(card.width >= previous - .01);
      else assert.ok(card.width <= previous + .01);
      assert.ok(card.width >= Math.min(start.width, endWidth) - .01);
      assert.ok(card.width <= Math.max(start.width, endWidth) + .01);
      assert.ok(card.height <= start.height + .01);
      assert.ok(Math.abs(card.top - card.height / 2 - initialTop) < 1e-9);
      assert.ok((width - card.width) / 2 >= 11.99);
      assert.ok(height - card.top - card.height / 2 >= 23.99);
      previous = card.width;
    }
    assert.deepEqual(getFilmWindowLayout(viewport, -1), start);
    assert.deepEqual(getFilmWindowLayout(viewport, 2), getFilmWindowLayout(viewport, 1));
  });
}

test("desktop cards are widescreen while phone cards are square", () => {
  const phone = getFilmWindowLayout({ width: 390, height: 788 }, 0);
  assert.ok(Math.abs(phone.width / phone.height - 1) < 1e-9);
  const desktop = getFilmWindowLayout({ width: 2048, height: 1023 }, 0);
  assert.equal(desktop.width, 1440);
  assert.ok(Math.abs(desktop.width / desktop.height - 2.1) < 1e-9);
});

test("following content starts twelve pixels after the completed card", () => {
  for (const [width, height] of viewports) {
    const viewport = { width, height };
    const scene = getFilmSceneLayout(viewport, 1);
    const end = getFilmWindowLayout(viewport, 1);
    const gutter = scene.height - scene.scrollDistance - (end.top + end.height / 2);
    assert.ok(gutter >= 12 && gutter < 13);
    assert.ok(scene.scrollDistance === 80 || scene.scrollDistance === 120);
  }
});

test("tall phones do not acquire additional vertical whitespace", () => {
  const scene = getFilmSceneLayout({ width: 390, height: 788 });
  assert.ok(scene.height < 600);
  assert.deepEqual(scene, getFilmSceneLayout({ width: 390, height: 1000 }));
});
test("mascot appears first, expansion completes before letters begin", () => {
  const initial = getFilmSequence(0);
  assert.equal(initial.mascot, 1);
  assert.equal(initial.letters, 0);
  assert.equal(initial.expansion, 0);
  for (const p of [.1, .25, .5]) {
    const frame = getFilmSequence(p);
    assert.equal(frame.letters, 0);
    assert.equal(frame.mascot, 1);
  }
  assert.equal(getFilmSequence(.5).expansion, 1);
  const middle = getFilmSequence(.7);
  assert.ok(Math.abs(middle.letters - .5) < 1e-9);
  assert.equal(middle.expansion, 1);
  for (const p of [0, .25, .5, .6, .7, .8, .9, 1]) {
    const frame = getFilmSequence(p);
    assert.equal(frame.mascot + frame.letters, 1);
  }
  assert.equal(getFilmSequence(1).letters, 1);
  assert.equal(getFilmSequence(1).mascot, 0);
  assert.deepEqual(getFilmSequence(-1), getFilmSequence(0));
  assert.deepEqual(getFilmSequence(2), getFilmSequence(1));
  // Pure scroll state: reversing to the top restores the mascot.
  assert.deepEqual(getFilmSequence(0), initial);
});
test("final width is seven eighths and height is five sixteenths of the former expanded window", () => {
  for (const [width, height] of viewports) {
    const viewport = { width, height };
    const start = getFilmWindowLayout(viewport, 0);
    const end = getFilmWindowLayout(viewport, 1);
    assert.ok(Math.abs(end.width / (start.width * 1.08) - 7 / 8) < 1e-9);
    assert.ok(Math.abs(end.height / (start.height * 1.08) - 5 / 16) < 1e-9);
    for (const phase of [0, .25, .5, .75, 1]) {
      const card = getFilmWindowLayout(viewport, phase);
      const scene = getFilmSceneLayout(viewport, phase);
      const gap = scene.stickyHeight - card.top - card.height / 2;
      assert.ok(gap >= 12 && gap < 13);
    }
  }
});
