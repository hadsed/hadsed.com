// Builds into _site-test with two fixtures added: an unfeatured role whose
// dates are unquoted YAML dates, and a stray copy of the posts folder under
// .claude/ (where the desktop app keeps worktrees).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";

const root = new URL("../", import.meta.url);
const fixtureRole = new URL("content/experience/zz-fixture-unfeatured.md", root);
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
  mkdirSync(new URL("content/", strayDir), { recursive: true });
  cpSync(new URL("content/posts/", root), new URL("content/posts/", strayDir), { recursive: true });
  execFileSync("npx", ["@11ty/eleventy", "--quiet", "--output=_site-test"], { stdio: "inherit" });
});

after(() => {
  rmSync(fixtureRole, { force: true });
  rmSync(strayDir, { recursive: true, force: true });
  rmSync(out, { recursive: true, force: true });
});

test("unfeatured roles stay off the landing timeline but appear on the Experience page", () => {
  assert.equal((read("index.html").match(/class="timeline-entry"/g) || []).length, 7);
  assert.equal((read("experience/index.html").match(/class="timeline-entry"/g) || []).length, 8);
  assert.doesNotMatch(read("index.html"), /Fixture Lab/);
});

test("unquoted YAML dates still render as years", () => {
  assert.match(read("experience/index.html"), /class="dates">2001 – 2002</);
});
