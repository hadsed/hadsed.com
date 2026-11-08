import { readdirSync, readFileSync } from "node:fs";
import matter from "gray-matter";

// Obsidian-style [[wikilinks]] resolve against content/ by file slug:
// projects -> /portfolio/<slug>/, articles -> /blog/<slug>/, experience -> /experience/#<slug>.
// ![[file.png]] embeds become images served from content/assets.
// Role files carry their start date as a prefix (2017-06-ontra.md) so they
// sort chronologically in Obsidian; the site addresses the role by the rest.
const roleSlug = (slug) => slug.replace(/^\d{4}(-\d{2})?-/, "");

function wikilinkTargets() {
  const targets = new Map();
  const scan = (dir, url, label, key = (s) => s) => {
    for (const file of readdirSync(`content/${dir}`)) {
      if (!file.endsWith(".md")) continue;
      const slug = file.slice(0, -3);
      const { data } = matter(readFileSync(`content/${dir}/${file}`, "utf8"));
      const target = { url: url(key(slug)), text: data[label] || key(slug) };
      targets.set(slug, target);   // [[2017-06-ontra]], what Obsidian autocompletes
      targets.set(key(slug), target); // [[ontra]]
    }
  };
  scan("projects", (s) => `/portfolio/${s}/`, "title");
  scan("articles", (s) => `/blog/${s}/`, "title");
  scan("experience", (s) => `/experience/#${s}`, "org", roleSlug);
  return targets;
}

export default function (eleventyConfig) {
  for (const path of ["flight/**", "notes/**", "plans/**", "docs/**", "scripts/**", "test/**", ".superpowers/**", ".claude/**", "README.md"]) {
    eleventyConfig.ignores.add(path);
  }

  eleventyConfig.addPassthroughCopy({ "src/css": "css", "src/assets": "assets", "content/assets": "assets", "src/root": "/" });

  // Flight (multiplayer jets) and the home that wraps the site over its live sky ship everywhere,
  // production included: every site page hands a top-level visit to /lab/home/ (see base.njk).
  // The room server in flight/server deploys separately as a Cloudflare Worker.
  for (const part of ["index.html", "main.js", "attract.js", "config.json", "packages", "assets", "vendor"]) {
    eleventyConfig.addPassthroughCopy({ [`flight/${part}`]: `lab/flight/${part}` });
  }
  eleventyConfig.addPassthroughCopy({ "notes/storyboards/fly-home.html": "lab/home/index.html" });

  // Branch previews (SITE_URL set) also carry the SR-71 backdrop lab at /lab/sr71/,
  // so it can be explored on any device. Production builds never include it.
  if (process.env.SITE_URL || process.env.LAB) {
    const lab = "notes/storyboards";
    eleventyConfig.addPassthroughCopy({
      [`${lab}/sr71-backdrop.html`]: "lab/sr71/index.html",
      [`${lab}/sr71-backdrop.mjs`]: "lab/sr71/sr71-backdrop.mjs",
      [`${lab}/site-gestures.mjs`]: "lab/sr71/site-gestures.mjs",
      [`${lab}/vendor/*.min.js`]: "lab/sr71/vendor",
      [`${lab}/terrain/regions.json`]: "lab/sr71/terrain/regions.json",
      [`${lab}/terrain/*.webp`]: "lab/sr71/terrain",
      // shared sky/terrain/tone module, the same file the flight lab uses
      "flight/packages/world/*.js": "lab/sr71/world",
      // edge-affordance mockups that sit on top of the lab
      [`${lab}/edge-affordances.html`]: "lab/edge/index.html",
    });
  }

  // Branch previews (SITE_URL set) carry the game mechanics jig at /lab/game/: the flight
  // game alone (no site, no look jigs) with a Tweakpane panel over its feel. The page is the
  // flight lab's own index.html with a <base> at /lab/flight/, so it can never drift from the
  // game, and previews point it at the staging room server. Production builds never include it.
  if (process.env.SITE_URL || process.env.LAB) {
    eleventyConfig.addPassthroughCopy({ "notes/lab/game": "lab/game" });
    eleventyConfig.on("eleventy.after", async ({ dir }) => {
      await writeGamePage(`${dir.output}/lab/game`, "Game mechanics jig", "/lab/game/jig.css", "/lab/game/jig.js");
    });
  }

  // Branch previews (SITE_URL set) carry the game's main menu prototype at /lab/menu/: Play ->
  // map select -> the game at /lab/menu/play/ (the same generated page as the jig, with the
  // menu's settings applied instead of a panel). Previews also get the four other terrain
  // regions as worlds in the flight manifest, so every map on the menu flies. The room server
  // already knows all five. Production builds never include any of it.
  if (process.env.SITE_URL || process.env.LAB) {
    eleventyConfig.addPassthroughCopy({
      "notes/lab/menu": "lab/menu",
      "notes/storyboards/terrain/*.webp": "lab/flight/assets/terrain",
    });
    eleventyConfig.on("eleventy.after", async ({ dir }) => {
      const { readFile, writeFile } = await import("node:fs/promises");
      await writeGamePage(`${dir.output}/lab/menu/play`, "Fly", "/lab/menu/play.css", "/lab/menu/play.js");
      const manifest = JSON.parse(await readFile("flight/assets/manifest.json", "utf8"));
      const regions = JSON.parse(await readFile("notes/storyboards/terrain/regions.json", "utf8"));
      const exaggeration = manifest.worlds[0].exaggeration;
      for (const r of regions) {
        if (manifest.worlds.some((w) => w.id === r.id)) continue;
        manifest.worlds.push({ id: r.id, label: r.label, heightmap: `assets/terrain/${r.id}.webp`, encoding: "terrarium",
          size: r.size, metersPerPixel: r.metersPerPixel, minM: r.minM, maxM: r.maxM, exaggeration, snowM: r.snowM, arid: r.arid });
      }
      await writeFile(`${dir.output}/lab/flight/assets/manifest.json`, JSON.stringify(manifest, null, 2));
    });
  }

  // Branch previews (SITE_URL set) carry the SR-71 model shootout at /lab/sr71-models/.
  // Production builds never include it.
  if (process.env.SITE_URL || process.env.LAB) {
    eleventyConfig.addPassthroughCopy({ "notes/lab/sr71-models": "lab/sr71-models" });
  }

  const targets = wikilinkTargets();
  eleventyConfig.addTransform("wikilinks", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    return content.replace(/(!?)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, embed, target, alias) => {
      if (embed) return `<img src="/assets/${target.trim()}" alt="">`;
      const hit = targets.get(target.trim());
      if (!hit) throw new Error(`Unresolved wikilink ${match} in ${this.page.inputPath}`);
      return `<a href="${hit.url}">${alias ? alias.trim() : hit.text}</a>`;
    });
  });

  // Absolute URLs for link previews. Branch previews set SITE_URL to their own
  // pages.dev alias so the share image resolves before it reaches production.
  eleventyConfig.addGlobalData("siteUrl", () => (process.env.SITE_URL || "https://hadsed.com").replace(/\/$/, ""));

  eleventyConfig.addGlobalData("buildYear", () => new Date().getFullYear());

  eleventyConfig.addFilter("year", (value) =>
    value instanceof Date ? String(value.getUTCFullYear()) : String(value).slice(0, 4)
  );
  eleventyConfig.addFilter("roleSlug", roleSlug);
  // Front matter text with inline Markdown links, e.g. a role subtitle of
  // "Interested in working together? [Let's chat](mailto:h@hadsed.com)".
  // Everything else is escaped; only web, mailto, and site-relative URLs link.
  const escapeHtml = (text) =>
    text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  eleventyConfig.addFilter("inlineLinks", (text = "") =>
    escapeHtml(String(text)).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label, url) =>
      /^(https?:|mailto:|\/|#)/.test(url) ? `<a href="${url}">${label}</a>` : whole
    )
  );
  // Profile links (GitHub, LinkedIn, Scholar) for the Person schema's sameAs.
  eleventyConfig.addFilter("profileUrls", (links = []) =>
    links.map((link) => link.url).filter((url) => url.startsWith("http"))
  );
  eleventyConfig.addFilter("readableDate", (date) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date)
  );

  const byOrder = (tag) => (api) =>
    api.getFilteredByTag(tag).sort((a, b) => a.data.order - b.data.order);
  eleventyConfig.addCollection("experience", byOrder("experience"));
  eleventyConfig.addCollection("featured", (api) => byOrder("experience")(api).filter((item) => item.data.featured));
  eleventyConfig.addCollection("projects", byOrder("projects"));

  return {
    dir: { input: ".", includes: "src/_includes", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}

// The flight lab's own index.html, re-pointed with a <base> at /lab/flight/ so the same game
// modules load, with a different stylesheet and entry script (which imports main.js itself).
// Used by the previews-only /lab/game/ jig and /lab/menu/play/.
async function writeGamePage(outDir, title, css, script) {
  const { readFile, writeFile, mkdir } = await import("node:fs/promises");
  const swap = (html, from, to) => {
    if (!html.includes(from)) throw new Error(`${outDir}: flight/index.html no longer has ${from}`);
    return html.replace(from, to);
  };
  let html = await readFile("flight/index.html", "utf8");
  html = swap(html, "<head>", '<head>\n<base href="/lab/flight/">');
  html = swap(html, "<title>Flight lab</title>", `<title>${title}</title>\n<link rel="stylesheet" href="${css}">`);
  // Absolute, not via <base>: Cloudflare turns the preload into an Early Hints header
  // resolved against the page's own URL.
  html = swap(html, '<link rel="modulepreload" href="vendor/three.module.js">', '<link rel="modulepreload" href="/lab/flight/vendor/three.module.js">');
  html = swap(html, '"three": "./vendor/three.module.js"', '"three": "/lab/flight/vendor/three.module.js"');
  html = swap(html, '<script type="module" src="main.js"></script>', `<script type="module" src="${script}"></script>`);
  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/index.html`, html);
}
