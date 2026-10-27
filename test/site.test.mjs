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

test("content is not emitted as its own pages", () => {
  assert.equal(existsSync(new URL("../_site/content", import.meta.url)), false);
});

test("landing page shows about, timeline, and projects", () => {
  const html = read("index.html");
  assert.equal((html.match(/class="timeline-entry"/g) || []).length, 7);
  assert.equal((html.match(/class="panel"/g) || []).length, 3);
  assert.match(html, /2025 – now/);
  assert.match(html, /2012 – 2015/);
  assert.match(html, /class="dates">2013</);
  assert.doesNotMatch(html, /2013 – 2013/);
  assert.match(html, /mailto:hadsed@gmail.com/);
  assert.match(html, /Adiabatic Quantum Optimization for Associative Memory Recall/);
  assert.doesNotMatch(html, /class="link"/);
  assert.doesNotMatch(html, /404-694/);
});
