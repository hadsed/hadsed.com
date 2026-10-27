import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../_site/${p}`, import.meta.url), "utf8");
before(() => { execFileSync("npx", ["@11ty/eleventy", "--quiet"], { stdio: "inherit" }); });

test("landing page carries the shell", () => {
  const html = read("index.html");
  for (const label of ["About", "Portfolio", "Experience", "Blog"]) assert.match(html, new RegExp(`>${label}<`));
  assert.match(html, /href="\/css\/site\.css"/);
  assert.match(html, /<title>Had Seddiqi<\/title>/);
});

test("notes and plans are not published", () => {
  assert.equal(existsSync(new URL("../_site/notes", import.meta.url)), false);
  assert.equal(existsSync(new URL("../_site/plans", import.meta.url)), false);
});
