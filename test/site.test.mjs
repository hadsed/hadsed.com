import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../_site/${p}`, import.meta.url), "utf8");
before(() => { execFileSync("npx", ["@11ty/eleventy", "--quiet"], { stdio: "inherit" }); });

test("landing page carries the shell", () => {
  const html = read("index.html");
  for (const label of ["About", "Experience", "Projects", "Blog", "Notes"]) assert.match(html, new RegExp(`>${label}<`));
  assert.match(html, /<style>[^<]*\.menu[^<]*<\/style>/);   // stylesheet inline: no request before text
  assert.doesNotMatch(html, /<link rel="stylesheet"/);
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
  const ld = JSON.parse(read("index.html").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"]
    .find((node) => node["@type"] === "Person");
  assert.equal(ld["@id"], "https://hadsed.com/#person");
  assert.ok(ld.sameAs.includes("https://github.com/hadsed"));
  assert.ok(!ld.sameAs.some((url) => url.startsWith("mailto:")));
  assert.match(read("projects/subassembler/index.html"), /<meta name="description" content="Step-by-step assembly walkthroughs generated from CAD\.">/);
});

test("every indexable page carries JSON-LD tied to the same person; the sitemap has lastmod", () => {
  const ld = (p) => JSON.parse(read(p).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld("projects/subassembler/index.html")["@type"], "CreativeWork");
  assert.equal(ld("projects/subassembler/index.html").author["@id"], "https://hadsed.com/#person");
  assert.equal(ld("experience/index.html")["@type"], "ProfilePage");
  assert.equal(ld("blog/index.html")["@type"], "CollectionPage");
  assert.doesNotMatch(read("404.html"), /ld\+json/);
  assert.match(read("sitemap.xml"), /<loc>https:\/\/hadsed\.com\/projects\/subassembler\/<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});

test("agents and feed readers get llms.txt and an Atom feed", () => {
  const llms = read("llms.txt");
  assert.match(llms, /^# Had Seddiqi\n\n> /);
  assert.match(llms, /- \[Subassembler\]\(https:\/\/hadsed\.com\/projects\/subassembler\/\): /);
  assert.doesNotMatch(llms, /&#|&amp;|<[a-z]/);
  const feed = read("feed.xml");
  assert.match(feed, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(feed, /<link href="https:\/\/hadsed\.com\/feed\.xml" rel="self"\/>/);
  assert.match(read("index.html"), /<link rel="alternate" type="application\/atom\+xml" title="Blog" href="\/feed\.xml">/);
});

test("no page waits on a third-party font host; fonts cache for a year", () => {
  for (const p of ["index.html", "projects/index.html", "experience/index.html"]) assert.doesNotMatch(read(p), /fonts\.(googleapis|gstatic)\.com/);
  assert.match(read("index.html"), /<link rel="preload" href="\/fonts\/petrona-300-latin\.woff2" as="font" type="font\/woff2" crossorigin>/);
  assert.doesNotMatch(read("projects/index.html"), /rel="preload"[^>]*font/);
  assert.ok(existsSync(new URL("../_site/fonts/petrona-300-latin.woff2", import.meta.url)));
  const headers = read("_headers");
  assert.match(headers, /\/fonts\/\*\n  Cache-Control: public, max-age=31536000, immutable/);
});

test("the Pages Function serves the sky wrapper at a page's own URL, never to crawlers or for files", async () => {
  const { onRequest } = await import("../functions/_middleware.js");
  const shell = "<html><head><meta name=\"robots\" content=\"noindex\"></head><body>wrapper</body></html>";
  globalThis.HTMLRewriter ??= class { on() { return this; } transform(r) { return r; } };
  const run = async (path, { dest = "document", ua = "Mozilla/5.0 Chrome/131", status = 200, type = "text/html" } = {}) => {
    const request = new Request(`https://hadsed.com${path}`, { headers: { "Sec-Fetch-Dest": dest, "User-Agent": ua } });
    const next = async () => new Response("page", { status, headers: { "Content-Type": type } });
    const env = { ASSETS: { fetch: async () => new Response(shell, { headers: { "Content-Type": "text/html" } }) } };
    return (await onRequest({ request, next, env })).text();
  };
  assert.equal(await run("/projects/"), shell);
  assert.equal(await run("/projects/", { dest: "iframe" }), "page");
  assert.equal(await run("/projects/", { dest: "" }), "page");
  for (const ua of ["Mozilla/5.0 (compatible; Googlebot/2.1)", "Mozilla/5.0 (compatible; Google-InspectionTool/1.0)", "ClaudeBot/1.0", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0)"]) {
    assert.equal(await run("/projects/", { ua }), "page", ua);
  }
  assert.equal(await run("/nope/", { status: 404 }), "page");
  assert.equal(await run("/feed.xml", { type: "application/atom+xml" }), "page");
  assert.equal(await run("/lab/home/"), "page");
  const routes = JSON.parse(read("_routes.json"));
  for (const p of ["/assets/*", "/fonts/*", "/lab/*"]) assert.ok(routes.exclude.includes(p), p);
});

test("the menu is the same on every page, apart from which item is current", () => {
  const nav = (p) => read(p).match(/<nav class="menu">[\s\S]*?<\/nav>/)[0].replace(/ aria-current="page"/g, "");
  const home = nav("index.html");
  assert.match(home, /class="site-name"/);
  for (const p of ["experience/index.html", "projects/index.html", "blog/index.html", "notes/index.html", "projects/subassembler/index.html", "404.html"]) {
    assert.equal(nav(p), home, p);
  }
});

test("a long post gets a side table of contents and its callouts render", () => {
  const html = read("blog/2026-10-28-home-from-an-address/index.html");
  assert.match(html, /<aside class="toc-side"[\s\S]*?<a href="#experimental-setup">Experimental setup<\/a>/);
  assert.match(html, /<div class="callout callout-note">\s*<p class="callout-title">Why Astra\?<\/p>/);
  assert.doesNotMatch(html, /\[!note\]/);
});
