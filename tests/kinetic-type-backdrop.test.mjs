import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mascot uses the direct full-resolution asset instead of the image optimizer", async () => {
  const component = await readFile(new URL("../app/components/KineticTypeBackdrop.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/components/kinetic-type-backdrop.css", import.meta.url), "utf8");
  const filmCss = await readFile(new URL("../app/components/scroll-film-intro.css", import.meta.url), "utf8");
  const asset = await readFile(new URL("../public/ai-mascot.webp", import.meta.url));
  const mascot = component.match(/<Image\b[^>]*\/>/)?.[0];

  assert.ok(mascot);
  assert.match(mascot, /src="\/ai-mascot.webp"/);
  assert.match(mascot, /\bunoptimized\b/);
  assert.match(mascot, /objectFit: "contain"/);
  assert.doesNotMatch(component, /mascotOpacity|PETAL|kinetic-type-backdrop__wings/);
  assert.match(css, /kinetic-type-backdrop__canvas\s*\{[^}]*opacity:\s*\.42;/);
  assert.match(filmCss, /scroll-film__window \.kinetic-type-backdrop\s*\{[^}]*opacity: var\(--film-reveal\);/);
  assert.equal(asset.toString("ascii", 0, 4), "RIFF");
  assert.equal(asset.toString("ascii", 8, 12), "WEBP");
});

test("background particles follow mascot alpha and pause when off-screen", async () => {
  const source = await readFile(new URL("../app/components/ParticleTextCanvas.tsx", import.meta.url), "utf8");
  assert.match(source, /maskImage.src = "\/ai-mascot.webp"/);
  assert.match(source, /context.drawImage\(image/);
  assert.match(source, /alpha < 110/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /cancelAnimationFrame/);
  assert.match(source, /redrawRef.current\?\.\(\)/);
  assert.doesNotMatch(source, /traceWing/);
});
test("film and canvas share the light green beige palette", async () => {
  const paths = ["../app/components/scroll-film-intro.css", "../app/components/kinetic-type-backdrop.css", "../app/components/ParticleTextCanvas.tsx"];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const color of ["#dce6ce", "#f3ecdd", "#dce8dc"]) assert.ok(source.includes(color), `${path} is missing ${color}`);
    assert.doesNotMatch(source, /#455959|#58666c|#688678/);
  }
});
