// Builds into _site-test with two fixtures added: an unfeatured role whose
// dates are unquoted YAML dates, a stray copy of the articles folder under
// .claude/ (where the desktop app keeps worktrees), and an article that uses
// Obsidian wikilinks and image embeds.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";

const root = new URL("../", import.meta.url);
const fixtureRole = new URL("content/experience/zz-fixture-unfeatured.md", root);
const fixtureArticle = new URL("content/articles/zz-fixture-links.md", root);
const brokenArticle = new URL("content/articles/zz-fixture-broken.md", root);
const strayDir = new URL(".claude/fixture-worktree/", root);
const out = new URL("_site-test/", root);
const read = (p) => readFileSync(new URL(p, out), "utf8");

before(() => {
  writeFileSync(fixtureRole, `---
org: Fixture Lab
role: Tester
subtitle: Not on the landing page
start: 2001-02-03
end: 2002-03-04
featured: false
order: 99
---
- A fixture role.
`);
  writeFileSync(fixtureArticle, `---
title: Links fixture
date: 2026-01-02
summary: Uses wikilinks.
---
See [[subassembler]] and [[ontra|the Ontra years]] and [[hello]].

![[diagram.png]]
`);
  mkdirSync(new URL("content/", strayDir), { recursive: true });
  cpSync(new URL("content/articles/", root), new URL("content/articles/", strayDir), { recursive: true });
  execFileSync("npx", ["@11ty/eleventy", "--quiet", "--output=_site-test"], { stdio: "inherit" });
});

after(() => {
  rmSync(fixtureRole, { force: true });
  rmSync(fixtureArticle, { force: true });
  rmSync(brokenArticle, { force: true });
  rmSync(strayDir, { recursive: true, force: true });
  rmSync(out, { recursive: true, force: true });
});

test("unfeatured roles stay off the landing timeline but appear on the Experience page", () => {
  assert.equal((read("index.html").match(/class="timeline-entry/g) || []).length, 8);
  assert.equal((read("experience/index.html").match(/class="timeline-entry/g) || []).length, 9);
  assert.doesNotMatch(read("index.html"), /Fixture Lab/);
});

test("unquoted YAML dates still render as years", () => {
  assert.match(read("experience/index.html"), /class="dates">2001 – 2002</);
});

test("wikilinks resolve to project, experience, and article pages; embeds become images", () => {
  const html = read("blog/zz-fixture-links/index.html");
  assert.match(html, /<a href="\/portfolio\/subassembler\/">Subassembler<\/a>/);
  assert.match(html, /<a href="\/experience\/#ontra">the Ontra years<\/a>/);
  assert.match(html, /<a href="\/blog\/hello\/">Hello<\/a>/);
  assert.match(html, /<img src="\/assets\/diagram.png" alt="">/);
  assert.doesNotMatch(html, /\[\[/);
  assert.match(read("experience/index.html"), /id="ontra"/);
});

test("an unresolved wikilink fails the build", () => {
  writeFileSync(brokenArticle, `---
title: Broken
date: 2026-01-03
summary: Bad link.
---
[[no-such-page]]
`);
  assert.throws(() => execFileSync("npx", ["@11ty/eleventy", "--quiet", "--output=_site-test"], { stdio: "pipe" }), /no-such-page/);
  rmSync(brokenArticle, { force: true });
});
