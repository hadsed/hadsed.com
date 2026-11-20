// Projects, blog posts and notes: frozen URLs, wikilinks to headings, backlinks, "Appears in",
// HTML embeds, raw pages and redirects. Builds into _site-layers with fixture content added.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const out = new URL("_site-layers/", root);
const read = (p) => readFileSync(new URL(p, out), "utf8");
const fixtures = {
  "content/projects/zz-fixture-house.md": `---
title: Fixture House
status: active
summary: A house from an address.
started: 2026-10
slug: fixture-house
redirect_from: [old-house]
posts:
  - "[[zz-fixture-first-post]]"
notes:
  - "[[zz-fixture-plan-fit]]"
---
The living summary. See [[zz-fixture-plan-fit|the plan fit]].
`,
  "content/blog/zz-fixture-first-post.md": `---
title: A first post
date: 2026-11-19
slug: first-post
summary: What goes in and what comes out.
hero_image: "[[zz-fixture-hero.png]]"
hero_image_alt: A house
---
Intro paragraph.

![[zz-fixture-viewer.html|A viewer]]

## Fitting the plan

This section is now its own note: [[zz-fixture-plan-fit]].

## Fitting the plan

A second heading with the same text.
`,
  "content/notes/zz-fixture-plan-fit.md": `---
title: Fitting a plan
summary: Scale and rotate a plan onto a footprint.
---
Started in [[first-post#Fitting the plan|the first post]]. Same page: [[#Details]].

## Details

More.
`,
  "content/notes/zz-fixture-raw.html": `---
title: A raw page
layout: raw
---
<!doctype html><title>Raw</title><canvas id="c"></canvas> Links to [[zz-fixture-plan-fit]].
`,
  "content/blog/zz-fixture-lead.md": `---
title: Lead image post
date: 2026-11-18
---

![[zz-fixture-hero.png|The house at dusk]]

Body text.
`,
  "content/blog/zz-fixture-same.md": `---
title: Same hero twice
date: 2026-11-17
hero_image: "[[zz-fixture-hero.png]]"
---
![[zz-fixture-hero.png|600]]

Body.
`,
  "content/assets/zz-fixture-hero.png": "png",
  "content/assets/zz-fixture-viewer.html": `<!doctype html><title>Viewer</title><script>const a = {{ b }};</script>`,
};
const broken = new URL("content/notes/zz-fixture-broken.md", root);
const build = () => execFileSync("npx", ["@11ty/eleventy", "--quiet", "--output=_site-layers"], { stdio: "pipe" });

before(() => {
  for (const [path, body] of Object.entries(fixtures)) writeFileSync(new URL(path, root), body);
  build();
});

after(() => {
  for (const path of Object.keys(fixtures)) rmSync(new URL(path, root), { force: true });
  rmSync(broken, { force: true });
  rmSync(out, { recursive: true, force: true });
});

test("URLs come from front matter: dated blog slug, project and note slugs", () => {
  assert.ok(existsSync(new URL("blog/2026-11-19-first-post/index.html", out)));
  assert.ok(existsSync(new URL("projects/fixture-house/index.html", out)));
  assert.ok(existsSync(new URL("notes/zz-fixture-plan-fit/index.html", out)));
  assert.ok(!existsSync(new URL("content", out)));
});

test("project page lists its posts and key notes; the index shows status and counts", () => {
  const html = read("projects/fixture-house/index.html");
  assert.match(html, /<h1>Fixture House <span class="status status-active">active<\/span><\/h1>/);
  assert.match(html, /Started October 2026/);
  assert.match(html, /Started October 2026, last updated 19 November 2026/);
  assert.match(html, /Blog posts[\s\S]*href="\/blog\/2026-11-19-first-post\/">A first post<[\s\S]*19 November 2026/);
  assert.match(html, /Key notes[\s\S]*href="\/notes\/zz-fixture-plan-fit\/">Fitting a plan</);
  assert.doesNotMatch(html, /class="(orb|kind)"|<p class="meta">[^<]*·/);
  const index = read("projects/index.html");
  assert.match(index, /Fixture House[\s\S]*?Last updated 19 Nov 2026, 1 post, 1 note/);
  assert.match(index, /aria-current="page" href="\/projects\/"/);
});

test("a post shows the projects it appears in, heading anchors, and an HTML embed", () => {
  const html = read("blog/2026-11-19-first-post/index.html");
  assert.match(html, /Appears in <a href="\/projects\/fixture-house\/">Fixture House<\/a>/);
  assert.match(html, /<h2 id="fitting-the-plan"><a class="anchor" href="#fitting-the-plan"/);
  assert.match(html, /<h2 id="fitting-the-plan-2">/);
  assert.match(html, /<figure class="embed"><iframe class="embed-frame" src="\/assets\/zz-fixture-viewer.html"[^>]*><\/iframe><figcaption>A viewer<\/figcaption><\/figure>/);
  assert.doesNotMatch(html, /<p><figure/);
  // the embed is copied as a file, untouched by the template engine
  assert.equal(read("assets/zz-fixture-viewer.html"), fixtures["content/assets/zz-fixture-viewer.html"]);
  assert.match(read("blog/index.html"), /href="\/blog\/2026-11-19-first-post\/">A first post</);
});

test("a hero image from front matter leads the page and becomes its link preview", () => {
  const html = read("blog/2026-11-19-first-post/index.html");
  assert.match(html, /<img class="hero" src="\/assets\/zz-fixture-hero.png" alt="A house">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/[^"]+\/assets\/zz-fixture-hero.png">/);
  assert.doesNotMatch(read("projects/fixture-house/index.html"), /class="hero"/);
});

test("an image embed on a note's first line becomes the hero and is not repeated", () => {
  const html = read("blog/2026-11-18-zz-fixture-lead/index.html");
  assert.match(html, /<img class="hero" src="\/assets\/zz-fixture-hero.png" alt="The house at dusk">/);
  assert.equal((html.match(/zz-fixture-hero\.png" alt/g) || []).length, 1);
  assert.doesNotMatch(html, /<figure class="figure">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/[^"]+\/assets\/zz-fixture-hero.png">/);
  assert.match(html, /<p>Body text\.<\/p>/);
});

test("a first-line image that is also hero_image shows once", () => {
  const html = read("blog/2026-11-17-zz-fixture-same/index.html");
  assert.equal((html.match(/<img[^>]*zz-fixture-hero\.png/g) || []).length, 1);
});

test("wikilinks reach headings on other pages and on the same page", () => {
  const html = read("notes/zz-fixture-plan-fit/index.html");
  assert.match(html, /<a href="\/blog\/2026-11-19-first-post\/#fitting-the-plan">the first post<\/a>/);
  assert.match(html, /<a href="#details">Details<\/a>/);
});

test("a note lists every page that links to it, with the sentence around the link", () => {
  const html = read("notes/zz-fixture-plan-fit/index.html");
  assert.match(html, /Linked from/);
  assert.match(html, /href="\/blog\/2026-11-19-first-post\/">A first post<\/a><span class="where">blog · 19 Nov 2026/);
  assert.match(html, /This section is now its own note: <mark>Fitting a plan<\/mark>\./);
  assert.match(html, /href="\/projects\/fixture-house\/">Fixture House<\/a><span class="where">project/);
  assert.match(html, /The living summary\. See <mark>the plan fit<\/mark>\./);
  assert.match(html, /href="\/notes\/zz-fixture-raw\/">A raw page</);
  assert.match(read("notes/index.html"), /href="\/notes\/zz-fixture-plan-fit\/">Fitting a plan</);
});

test("layout: raw pages skip the site template but keep their URL and links", () => {
  const html = read("notes/zz-fixture-raw/index.html");
  assert.match(html, /^<!doctype html><title>Raw<\/title>/);
  assert.doesNotMatch(html, /class="menu"/);
  assert.match(html, /<a href="\/notes\/zz-fixture-plan-fit\/">Fitting a plan<\/a>/);
});

test("renamed projects redirect; portfolio redirects to projects", () => {
  const redirects = read("_redirects");
  assert.match(redirects, /^\/portfolio\/\* \/projects\/:splat 301$/m);
  assert.match(redirects, /^\/projects\/old-house\/ \/projects\/fixture-house\/ 301$/m);
  assert.match(redirects, /^\/projects\/zz-fixture-house\/ \/projects\/fixture-house\/ 301$/m);
});

test("a link to a heading that doesn't exist fails the build", () => {
  writeFileSync(broken, `---\ntitle: Broken\n---\n[[first-post#No such heading]]\n`);
  assert.throws(build, /no heading "No such heading"/);
  rmSync(broken, { force: true });
});
