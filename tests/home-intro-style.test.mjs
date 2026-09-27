import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home intro uses the palette sampled from the supplied reference", async () => {
  const css = await readFile(new URL("../app/components/home-intro.css", import.meta.url), "utf8");
  for (const color of ["#58666c", "#405553", "#a8c83e", "#86f2df", "#fff3e8"]) {
    assert.match(css, new RegExp(color));
  }
  assert.doesNotMatch(css, /#00e5e9|#6330ff|#bd3826/);
});
