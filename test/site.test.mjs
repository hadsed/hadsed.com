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
  assert.doesNotMatch(html, /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/);
});

test("portfolio page and project pages", () => {
  assert.equal((read("portfolio/index.html").match(/class="panel"/g) || []).length, 3);
  assert.match(read("portfolio/subassembler/index.html"), /<h1>Subassembler<\/h1>/);
});

test("experience page renders bodies as lists", () => {
  const html = read("experience/index.html");
  assert.equal((html.match(/class="timeline-entry"/g) || []).length, 7);
  assert.ok((html.match(/<ul>/g) || []).length >= 7);
  assert.match(html, /Planetary Lake Lander/);
});

test("blog index and post", () => {
  assert.match(read("blog/index.html"), /href="\/blog\/hello\/"/);
  assert.match(read("blog/hello/index.html"), /27 October 2026/);
});

test("current page is marked in the menu", () => {
  assert.match(read("blog/index.html"), /aria-current="page" href="\/blog\/"/);
  assert.doesNotMatch(read("blog/index.html"), /aria-current="page" href="\/"/);
});
