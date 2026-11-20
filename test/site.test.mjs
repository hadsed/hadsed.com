import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../_site/${p}`, import.meta.url), "utf8");
before(() => { execFileSync("npx", ["@11ty/eleventy", "--quiet"], { stdio: "inherit" }); });

test("landing page carries the shell", () => {
  const html = read("index.html");
  for (const label of ["About", "Experience", "Projects", "Blog", "Notes"]) assert.match(html, new RegExp(`>${label}<`));
  assert.match(html, /href="\/css\/site\.css"/);
  assert.match(html, /<title>Had Seddiqi<\/title>/);
  assert.match(html, /<\/main>\s*<\/div>\s*<footer>© \d{4} Had Seddiqi<\/footer>/);
});

test("the repo's notes/ and plans/ folders are not published (/notes/ is the site's notes section)", () => {
  assert.deepEqual(readdirSync(new URL("../_site/notes", import.meta.url)).filter((f) => f !== "index.html" && !existsSync(new URL(`../content/notes/${f}.md`, import.meta.url))), []);
  assert.equal(existsSync(new URL("../_site/plans", import.meta.url)), false);
});

test("content is not emitted as its own pages", () => {
  assert.equal(existsSync(new URL("../_site/content", import.meta.url)), false);
});

test("landing page shows about, timeline, and projects", () => {
  const html = read("index.html");
  assert.equal((html.match(/class="timeline-entry/g) || []).length, 8);
  assert.equal((html.match(/class="timeline-entry is-upcoming"/g) || []).length, 1);
  assert.match(html, /is-upcoming"[\s\S]*?class="dates">2026 – \?</);
  assert.equal((html.match(/class="panel"/g) || []).length, 3);
  assert.match(html, /2025 – now/);
  assert.match(html, /2012 – 2015/);
  assert.match(html, /class="dates">2013</);
  assert.doesNotMatch(html, /2013 – 2013/);
  assert.match(html, /mailto:h@hadsed.com/);
  assert.doesNotMatch(html, /Adiabatic Quantum Optimization for Associative Memory Recall/);
  assert.match(html, /class="org">Vinci4d</);
  assert.match(html, /My next 5-year role/);
  assert.match(html, /class="role">[^<]*<a href="mailto:h@hadsed.com">[^<]+<\/a>[^<]*<\/div>/);
  assert.match(html, /ML Engineer, Electrical DNA sequencing/);
  assert.doesNotMatch(html, / · /);
  assert.doesNotMatch(html, /entry-head/);
  assert.match(html, /Semiconductor physics AI unicorn/);
  assert.doesNotMatch(html, /Georgia Southern/);
  assert.match(html, /<\/header>[\s\S]*?class="links"[\s\S]*?class="blurb"/);
  assert.equal((html.match(/class="button"/g) || []).length, 4);
  assert.match(html, /<svg[\s\S]*?mailto:h@hadsed.com|mailto:h@hadsed.com[\s\S]*?<svg/);
  assert.match(html, /Intelligent Robotics Group/);
  assert.match(html, /class="about-head">\s*<img class="avatar"[\s\S]*?<h1>Had Seddiqi<\/h1>/);
  assert.doesNotMatch(html, /class="link"/);
  assert.doesNotMatch(html, /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/);
});

test("projects page and project pages; portfolio redirects there", () => {
  assert.equal((read("projects/index.html").match(/class="panel"/g) || []).length, 3);
  assert.match(read("projects/subassembler/index.html"), /<h1>Subassembler<\/h1>/);
  assert.equal(existsSync(new URL("../_site/portfolio", import.meta.url)), false);
  assert.match(read("_redirects"), /^\/portfolio\/\* \/projects\/:splat 301$/m);
});

test("menu: About and Experience, a gap, then Projects, Blog and Notes", () => {
  const nav = read("projects/index.html").match(/<ul class="nav">[\s\S]*?<\/ul><\/li><\/ul>/)[0];
  const labels = [...nav.matchAll(/>([A-Z][a-z]+)<\/a>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["About", "Experience", "Projects", "Blog", "Notes"]);
  assert.match(nav, /Experience<\/a><\/li><li class="nav-gap" aria-hidden="true"><\/li><li><a aria-current="page" href="\/projects\/">/);
});

test("experience page renders bodies as lists", () => {
  const html = read("experience/index.html");
  assert.equal((html.match(/class="timeline-entry/g) || []).length, 8);
  assert.ok((html.match(/<ul>/g) || []).length >= 7);
  assert.match(html, /Planetary Lake Lander/);
});

test("blog and notes indexes exist; the placeholder post redirects", () => {
  assert.match(read("blog/index.html"), /<h2 class="label">Blog<\/h2>/);
  assert.match(read("notes/index.html"), /<h2 class="label">Notes<\/h2>/);
  assert.match(read("_redirects"), /^\/blog\/hello\/ \/blog\/ 301$/m);
});

test("current page is marked in the menu", () => {
  assert.match(read("blog/index.html"), /aria-current="page" href="\/blog\/"/);
  assert.doesNotMatch(read("blog/index.html"), /aria-current="page" href="\/"/);
  assert.match(read("blog/index.html"), /class="site-name"/);
});

test("pages carry link-preview tags and icons", () => {
  const html = read("index.html");
  assert.match(html, /<meta property="og:title" content="Had Seddiqi">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/[^"]+\/assets\/og\.jpg">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(read("blog/index.html"), /<meta property="og:title" content="[^"]+ · Had Seddiqi">/);
  for (const f of ["assets/og.jpg", "apple-touch-icon.png", "favicon.ico"]) {
    assert.ok(existsSync(new URL(`../_site/${f}`, import.meta.url)), f);
  }
});

test("crawlers get robots.txt, a sitemap, a real 404 and a Person schema", () => {
  assert.match(read("robots.txt"), /^User-agent: \*\nAllow: \/$/m);
  assert.match(read("robots.txt"), /^Sitemap: https:\/\/hadsed\.com\/sitemap\.xml$/m);
  const sitemap = read("sitemap.xml");
  assert.match(sitemap, /<loc>https:\/\/hadsed\.com\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/hadsed\.com\/projects\/subassembler\/<\/loc>/);
  assert.doesNotMatch(sitemap, /404|robots|sitemap\.xml/);
  assert.match(read("404.html"), /<meta name="robots" content="noindex">/);
  assert.match(read("_headers"), /X-Robots-Tag: noindex/);
  const ld = JSON.parse(read("index.html").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld["@type"], "Person");
  assert.ok(ld.sameAs.includes("https://github.com/hadsed"));
  assert.ok(!ld.sameAs.some((url) => url.startsWith("mailto:")));
  assert.match(read("projects/subassembler/index.html"), /<meta name="description" content="Step-by-step assembly walkthroughs generated from CAD\.">/);
});

test("the menu is the same on every page, apart from which item is current", () => {
  const nav = (p) => read(p).match(/<nav class="menu">[\s\S]*?<\/nav>/)[0].replace(/ aria-current="page"/g, "");
  const home = nav("index.html");
  assert.match(home, /class="site-name"/);
  for (const p of ["experience/index.html", "projects/index.html", "blog/index.html", "notes/index.html", "projects/subassembler/index.html", "404.html"]) {
    assert.equal(nav(p), home, p);
  }
});
