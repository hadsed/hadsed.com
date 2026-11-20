import { basename, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { buildModel, urlFor, roleSlug, slugify, uniqueId, isoDate } from "./lib/content.mjs";

export default function (eleventyConfig) {
  // content/articles is the blog's old folder (now content/blog); a copy left in the vault stays unbuilt.
  // content/assets holds images and self-contained .html embeds: copied as files, never templates.
  for (const path of ["flight/**", "notes/**", "plans/**", "docs/**", "scripts/**", "test/**", "lib/**", ".superpowers/**", ".claude/**", "README.md", "content/articles/**", "content/assets/**"]) {
    eleventyConfig.ignores.add(path);
  }

  eleventyConfig.addPassthroughCopy({ "src/css": "css", "src/fonts": "fonts", "src/assets": "assets", "content/assets": "assets", "src/root": "/" });

  // Flight (multiplayer jets) and the home that wraps the site over its live sky ship everywhere,
  // production included: every site page hands a top-level visit to /lab/home/ (see base.njk).
  // The room server in flight/server deploys separately as a Cloudflare Worker.
  for (const part of ["index.html", "main.js", "attract.js", "config.json", "packages", "assets", "vendor"]) {
    eleventyConfig.addPassthroughCopy({ [`flight/${part}`]: `lab/flight/${part}` });
  }
  eleventyConfig.addPassthroughCopy({ "notes/storyboards/fly-home.html": "lab/home/index.html" });
  // Branch previews carry a bare Mach 20 iframe test at /lab/frame-test/ (no site around it).
  if (process.env.SITE_URL || process.env.LAB) {
    eleventyConfig.addPassthroughCopy({ "notes/lab/frame-test": "lab/frame-test" });
  }

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
      const { readFile, writeFile, mkdir } = await import("node:fs/promises");
      const swap = (html, from, to) => {
        if (!html.includes(from)) throw new Error(`/lab/game/: flight/index.html no longer has ${from}`);
        return html.replace(from, to);
      };
      let html = await readFile("flight/index.html", "utf8");
      html = swap(html, "<head>", '<head>\n<base href="/lab/flight/">');
      html = swap(html, "<title>Flight lab</title>", '<title>Game mechanics jig</title>\n<link rel="stylesheet" href="/lab/game/jig.css">');
      // Absolute, not via <base>: Cloudflare turns the preload into an Early Hints header
      // resolved against the page's own URL.
      html = swap(html, '<link rel="modulepreload" href="vendor/three.module.js">', '<link rel="modulepreload" href="/lab/flight/vendor/three.module.js">');
      html = swap(html, '"three": "./vendor/three.module.js"', '"three": "/lab/flight/vendor/three.module.js"');
      html = swap(html, '<script type="module" src="main.js"></script>', '<script type="module" src="/lab/game/jig.js"></script>');
      await mkdir(`${dir.output}/lab/game`, { recursive: true });
      await writeFile(`${dir.output}/lab/game/index.html`, html);
    });
  }

  // Branch previews (SITE_URL set) carry the SR-71 model shootout at /lab/sr71-models/.
  // Production builds never include it.
  if (process.env.SITE_URL || process.env.LAB) {
    eleventyConfig.addPassthroughCopy({ "notes/lab/sr71-models": "lab/sr71-models" });
  }

  // Projects, blog posts and notes: URLs, backlinks, "Appears in", project activity (lib/content.mjs).
  // Rebuilt on every build so a change anywhere shows up everywhere it is referenced.
  let model = buildModel();
  eleventyConfig.on("eleventy.before", () => { model = buildModel(); });
  eleventyConfig.addGlobalData("site", () => model);
  // Folder data (content/<kind>/<kind>.json) sets permalink: "{{ page.inputPath | contentUrl(slug, date) }}".
  eleventyConfig.addFilter("contentUrl", (inputPath, slug, date) => {
    const kind = basename(dirname(inputPath));
    return urlFor(kind, basename(inputPath).replace(/\.(md|html)$/, ""), { slug, date });
  });

  // Headings get stable ids from their text (the same ids [[page#Heading]] links resolve to)
  // and a # link to themselves, so any section can be linked before it becomes its own note.
  eleventyConfig.amendLibrary("md", (md) => {
    md.core.ruler.push("heading_ids", (state) => {
      const seen = new Map();
      const tokens = state.tokens;
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type !== "heading_open") continue;
        const inline = tokens[i + 1];
        const id = uniqueId(slugify(inline.content), seen);
        tokens[i].attrSet("id", id);
        if (tokens[i].tag !== "h1") {
          const open = new state.Token("html_inline", "", 0);
          open.content = `<a class="anchor" href="#${id}" aria-hidden="true">#</a>`;
          inline.children.unshift(open);
        }
      }
    });
  });

  // Obsidian links: [[page]], [[page|text]], [[page#Heading]], [[#Heading]] (this page).
  // Embeds: ![[image.png]] becomes an image; ![[viz.html]], a self-contained page from content/assets,
  // runs in its own frame inside the page (its CSS and JS can't touch the site's).
  const embedFrame = (file) =>
    `<iframe class="embed-frame" src="/assets/${file}" title="${file.replace(/\.html$/, "")}" loading="lazy" allow="fullscreen; xr-spatial-tracking"></iframe>`;
  const resolveLinks = (content, where, url) => {
    const self = model.byUrl.get(url);
    return content
      .replace(/<p>\s*!\[\[([^\]|]+\.html)(?:\|([^\]]+))?\]\]\s*<\/p>/g, (m, file, caption) =>
        `<figure class="embed">${embedFrame(file.trim())}${caption ? `<figcaption>${caption.trim()}</figcaption>` : ""}</figure>`)
      .replace(/(!?)\[\[([^\]|#]*)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (match, embed, name, heading, alias) => {
        name = name.trim();
        if (embed) return name.endsWith(".html") ? embedFrame(name) : `<img src="/assets/${name}" alt="${alias ? alias.trim() : ""}">`;
        const hit = name ? model.targets.get(name) : self;
        if (!hit) throw new Error(`Unresolved wikilink ${match} in ${where}`);
        let href = hit.url;
        if (heading) {
          const id = slugify(heading);
          if (hit.headings && hit.kind !== "experience" && !hit.headings.has(id)) {
            throw new Error(`Wikilink ${match} in ${where}: ${hit.url} has no heading "${heading.trim()}"`);
          }
          href = `${name ? hit.url : ""}#${id}`;
        }
        const text = alias ? alias.trim() : heading && !name ? heading.trim() : hit.title;
        return `<a href="${href}">${text}</a>`;
      });
  };
  eleventyConfig.addTransform("wikilinks", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    return resolveLinks(content, this.page.inputPath, this.page.url);
  });
  // The feed carries a post's body before page transforms run: resolve its links here, and make
  // site-relative links absolute so they work in a feed reader.
  eleventyConfig.addFilter("feedHtml", (html, inputPath, url) =>
    resolveLinks(html, inputPath, url).replace(/(href|src)="\/(?!\/)/g, '$1="https://hadsed.com/')
  );

  // Absolute URLs for link previews. Branch previews set SITE_URL to their own
  // pages.dev alias so the share image resolves before it reaches production.
  eleventyConfig.addGlobalData("siteUrl", () => (process.env.SITE_URL || "https://hadsed.com").replace(/\/$/, ""));

  eleventyConfig.addGlobalData("buildYear", () => new Date().getFullYear());
  eleventyConfig.addGlobalData("buildDate", () => new Date().toISOString().slice(0, 10));

  // The stylesheet goes inline in every page's <head>: text can paint as soon as the HTML lands,
  // with no second request in its way on a slow connection. Comments and runs of whitespace go.
  eleventyConfig.addGlobalData("siteCss", () =>
    readFileSync("src/css/site.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};,>])\s*/g, "$1").replace(/:\s+/g, ":").trim()
  );

  eleventyConfig.addFilter("isoDate", (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : isoDate(value)));

  // schema.org JSON-LD for every indexable page: who wrote it, what kind of page it is, when.
  // Search engines and LLM crawlers read this to tie the site's pages to one person.
  eleventyConfig.addFilter("structuredData", function (page, title, description, about, site) {
    const base = "https://hadsed.com";
    const url = base + page.url;
    const person = { "@type": "Person", "@id": `${base}/#person`, name: about.name, url: `${base}/` };
    const tags = this.ctx?.tags || [];
    if (page.url === "/") {
      return {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", "@id": `${base}/#website`, url: `${base}/`, name: about.name, description, publisher: { "@id": person["@id"] } },
          { ...person, image: `${base}/assets/avatar.jpg`, description, jobTitle: about.tagline, email: "mailto:h@hadsed.com",
            sameAs: about.links.map((l) => l.url).filter((u) => u.startsWith("http")) },
        ],
      };
    }
    const common = { "@context": "https://schema.org", url, name: title || about.name, description, author: person, isPartOf: { "@id": `${base}/#website` } };
    if (tags.includes("blog")) {
      return { ...common, "@type": "BlogPosting", headline: title, datePublished: isoDate(page.date), mainEntityOfPage: url, image: `${base}/assets/og.jpg` };
    }
    if (tags.includes("notes")) {
      const tended = site.tended[page.url];
      return { ...common, "@type": "Article", headline: title, ...(tended && { dateModified: tended }), mainEntityOfPage: url };
    }
    if (tags.includes("projects")) {
      const info = site.projectByUrl[page.url] || {};
      return { ...common, "@type": "CreativeWork", headline: title, ...(info.updated && { dateModified: info.updated }), creator: person };
    }
    if (page.url === "/experience/") return { ...common, "@type": "ProfilePage", mainEntity: person };
    return { ...common, "@type": "CollectionPage" };
  });

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
  // Dates arrive as Date objects (front matter) or YYYY-MM-DD strings (the content model).
  const asDate = (value) => (value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00Z`));
  eleventyConfig.addFilter("readableDate", (date) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(asDate(date))
  );
  // "2026-10" -> "October 2026"; a bare year stays as is.
  eleventyConfig.addFilter("monthYear", (value) => {
    const m = String(value).match(/^(\d{4})-(\d{2})/);
    return m ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(+m[1], +m[2] - 1, 1))) : String(value);
  });
  eleventyConfig.addFilter("shortDate", (date) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(asDate(date))
  );

  const byOrder = (tag) => (api) =>
    api.getFilteredByTag(tag).sort((a, b) => a.data.order - b.data.order);
  eleventyConfig.addCollection("experience", byOrder("experience"));
  eleventyConfig.addCollection("featured", (api) => byOrder("experience")(api).filter((item) => item.data.featured));
  // Landing page panels keep their hand-set order; projects without one go last.
  eleventyConfig.addCollection("projects", (api) =>
    api.getFilteredByTag("projects").sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999))
  );
  eleventyConfig.addCollection("blog", (api) => api.getFilteredByTag("blog").sort((a, b) => b.date - a.date));

  return {
    dir: { input: ".", includes: "src/_includes", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
