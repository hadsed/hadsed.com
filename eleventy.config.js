import { basename, dirname } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import markdownKatex from "@vscode/markdown-it-katex";
import { buildModel, urlFor, roleSlug, slugify, uniqueId, isoDate } from "./lib/content.mjs";
import { markdownCallouts, tocFrom } from "./lib/article.mjs";
import { prepareHeroes, heroHtml, heroShareUrl } from "./lib/hero.mjs";
import { POSTHOG, analyticsOn, posthogHosts } from "./lib/analytics.mjs";

export default function (eleventyConfig) {
  // content/articles is the blog's old folder (now content/blog); a copy left in the vault stays unbuilt.
  // content/assets holds images and self-contained .html embeds: copied as files, never templates.
  for (const path of ["flight/**", "notes/**", "plans/**", "docs/**", "scripts/**", "test/**", "lib/**", ".superpowers/**", ".claude/**", "README.md", "content/articles/**", "content/assets/**"]) {
    eleventyConfig.ignores.add(path);
  }

  // src/lab/: option pages for branch previews (SITE_URL set). Production builds never include them.
  if (!(process.env.SITE_URL || process.env.LAB)) eleventyConfig.ignores.add("src/lab/**");

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
  // Hero images (lib/hero.mjs): sizes read and animated ones turned into a still + motion up front,
  // so templates can render them synchronously.
  eleventyConfig.on("eleventy.before", async ({ directories, dir }) => {
    model = buildModel();
    await prepareHeroes(Object.values(model.heroByUrl), (directories?.output || dir.output).replace(/\/$/, ""));
  });
  // {{ image | heroHtml(image_alt) }} on a page; {{ item.hero | heroHtml("", true) }} on a card in a list.
  eleventyConfig.addFilter("heroShareUrl", heroShareUrl);
  // Animated heroes: "auto" plays them while on screen, "hover" only while their card is hovered
  // (assets/hero.js). Either way the still paints first and the motion loads after.
  eleventyConfig.addGlobalData("heroMotion", "auto");
  eleventyConfig.addFilter("heroHtml", (value, alt = "", card = false) => heroHtml(value, { alt, card, className: card ? "card-hero" : "hero" }));
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
        const open = new state.Token("html_inline", "", 0);
        open.content = `<a class="anchor" href="#${id}" aria-hidden="true">#</a>`;
        inline.children.unshift(open);
      }
    });
  });

  // Obsidian callouts (> [!note] Title) and the reading pages' table of contents (lib/article.mjs).
  eleventyConfig.amendLibrary("md", markdownCallouts);
  // LaTeX the way Obsidian writes it: $inline$ and $$display$$, typeset at build time by KaTeX,
  // so a page with math needs only katex.min.css and its fonts, no script.
  eleventyConfig.amendLibrary("md", (md) => md.use(markdownKatex.default || markdownKatex, { throwOnError: false, enableMathBlockInHtml: false, enableMathInlineInHtml: false }));
  eleventyConfig.addPassthroughCopy({ "node_modules/katex/dist/katex.min.css": "css/katex/katex.min.css", "node_modules/katex/dist/fonts": "css/katex/fonts" });
  eleventyConfig.addFilter("toc", tocFrom);

  // Obsidian links: [[page]], [[page|text]], [[page#Heading]], [[#Heading]] (this page).
  // Embeds: ![[image.png]] becomes an image; ![[viz.html]], a self-contained page from content/assets,
  // runs in its own frame inside the page (its CSS and JS can't touch the site's).
  // ![[widgets.js|name]] is a native figure: an ES module from content/assets that renders into the page's
  // own DOM (and inherits the page's styles). The module finds its mounts by data-widget-src; the text
  // after the | is handed to it as the widget's name. The same module on one page runs once.
  const embedWidget = (file, alias) => {
    // the asset cache keeps a script for a day, so its URL carries a hash of its contents:
    // a changed script is a new URL and a reload picks it up at once
    const disk = `content/assets/${file}`;
    const v = existsSync(disk) ? createHash("md5").update(readFileSync(disk)).digest("hex").slice(0, 10) : "";
    const src = `/assets/${encodeURI(file)}${v ? `?v=${v}` : ""}`;
    return `<div class="widget-mount" data-widget-src="${src}" data-widget="${(alias || "").trim()}"></div><script type="module" src="${src}"></script>`;
  };
  // The figure kit (vault hadsed.com/design-system, copied to content/assets/kit): the wikilinks transform
  // puts it once ahead of the first widget embed on a page. Hashed URLs, like the scripts above.
  const kitTags = () => {
    const tag = (f) => { const disk = `content/assets/kit/${f}`; if (!existsSync(disk)) return null;
      return `/assets/kit/${f}?v=${createHash("md5").update(readFileSync(disk)).digest("hex").slice(0, 10)}`; };
    const css = tag("ui.css"), js = tag("ui.js");
    return (css ? `<link rel="stylesheet" href="${css}">` : "") + (js ? `<script src="${js}" defer></script>` : "");
  };
  const embedFrame = (file) =>
    `<iframe class="embed-frame" src="/assets/${encodeURI(file)}" title="${file.replace(/\.html$/, "")}" loading="lazy" allow="fullscreen; xr-spatial-tracking"></iframe>`;
  // ![[pic.png|600]] sets a width, as in Obsidian; any other text after the | is the alt text,
  // and an image on its own line shows that text as a caption.
  const embedImage = (file, alias) => {
    const width = alias && /^\d+(x\d+)?$/.test(alias.trim()) ? alias.trim().split("x")[0] : null;
    const alt = alias && !width ? alias.trim() : "";
    return `<img src="/assets/${encodeURI(file)}" alt="${alt}"${width ? ` width="${width}"` : ""} loading="lazy">`;
  };
  const resolveLinks = (content, where, url) => {
    const self = model.byUrl.get(url);
    return content
      .replace(/<p>\s*!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]\s*<\/p>/g, (m, file, alias) => {
        file = file.trim();
        if (file.endsWith(".js")) return embedWidget(file, alias);
        if (file.endsWith(".html")) return `<figure class="embed">${embedFrame(file)}${alias ? `<figcaption>${alias.trim()}</figcaption>` : ""}</figure>`;
        const caption = alias && !/^\d+(x\d+)?$/.test(alias.trim()) ? `<figcaption>${alias.trim()}</figcaption>` : "";
        return `<figure class="figure">${embedImage(file, alias)}${caption}</figure>`;
      })
      .replace(/(!?)\[\[([^\]|#]*)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (match, embed, name, heading, alias) => {
        name = name.trim();
        if (embed) return name.endsWith(".js") ? embedWidget(name, alias) : name.endsWith(".html") ? embedFrame(name) : embedImage(name, alias);
        const hit = name ? model.targets.get(name) : self;
        if (!hit) throw new Error(`Unresolved wikilink ${match} in ${where}`);
        let href = hit.url;
        if (heading) {
          const id = slugify(heading.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
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
    const out = resolveLinks(content, this.page.inputPath, this.page.url);
    // a page with figure scripts gets the figure kit once, ahead of the first figure
    const at = out.indexOf('<div class="widget-mount"');
    return at < 0 ? out : out.slice(0, at) + kitTags() + out.slice(at);
  });
  // Links to other sites open in a new tab (LinkedIn, GitHub, Scholar, links in posts). Own-site links stay put.
  eleventyConfig.addTransform("outsideLinks", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    return content.replace(/<a\s([^>]*?)>/g, (tag, attrs) => {
      const href = /\bhref="(https?:\/\/[^"]*)"/.exec(attrs);
      if (!href || /\btarget=/.test(attrs) || /^https?:\/\/(www\.)?hadsed\.com(\/|$)/.test(href[1])) return tag;
      return `<a ${attrs} target="_blank" rel="noopener">`;
    });
  });
  // The feed carries a post's body before page transforms run: resolve its links here, and make
  // site-relative links absolute so they work in a feed reader.
  eleventyConfig.addFilter("feedHtml", (html, inputPath, url) =>
    resolveLinks(html, inputPath, url).replace(/(href|src)="\/(?!\/)/g, '$1="https://hadsed.com/')
  );
  // Absolute URLs for link previews. Branch previews set SITE_URL to their own
  // pages.dev alias so the share image resolves before it reaches production.
  eleventyConfig.addGlobalData("siteUrl", () => (process.env.SITE_URL || "https://hadsed.com").replace(/\/$/, ""));

  // PostHog (lib/analytics.mjs). Off until the project key is set; base.njk renders nothing then.
  eleventyConfig.addGlobalData("analytics", () => ({ on: analyticsOn(), key: POSTHOG.key, ui: posthogHosts().ui }));
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
  // "October 28th, 2026" (and "Oct 28th, 2026" for the short form).
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
  const usDate = (date, month) => {
    const d = asDate(date);
    const name = new Intl.DateTimeFormat("en-US", { month, timeZone: "UTC" }).format(d);
    return `${name} ${ordinal(d.getUTCDate())}, ${d.getUTCFullYear()}`;
  };
  eleventyConfig.addFilter("readableDate", (date) => usDate(date, "long"));
  // A hero or share image in front matter (hero_image / share_image: hero.jpg, or "[[hero.jpg]]" as Obsidian
  // writes it) is a file in content/assets. A name that isn't there fails the build rather than shipping a broken image.
  // Our own scripts are cached at the edge for a day; a content hash in the URL makes a new deploy
  // fetch the new file at once instead of pairing fresh HTML with yesterday's script.
  eleventyConfig.addFilter("busted", (path) => {
    const file = `src${path}`;
    return existsSync(file) ? `${path}?v=${createHash("md5").update(readFileSync(file)).digest("hex").slice(0, 8)}` : path;
  });
  eleventyConfig.addFilter("assetUrl", (value) => {
    if (!value) return "";
    const name = String(value).trim().replace(/^!?\[\[/, "").replace(/(\|[^\]]*)?\]\]$/, "").replace(/^\/?(assets\/)?/, "");
    if (!existsSync(`content/assets/${name}`) && !existsSync(`src/assets/${name}`)) throw new Error(`${value} is not in content/assets`);
    return `/assets/${encodeURI(name)}`;
  });
  // With no hero_image in front matter, an image embed on the first line of a post or project is the
  // hero, so the note shows it at the top in Obsidian too. The page renders it once, as the hero
  // (the embed is still raw <p>![[...]]</p> here; the wikilinks transform runs later).
  eleventyConfig.addFilter("leadImage", (inputPath) => {
    const path = String(inputPath || "").replace(/^\.\//, "");
    if (!/^content\/(blog|projects)\/[^/]+\.md$/.test(path) || !existsSync(path)) return null;
    const first = matter(readFileSync(path, "utf8")).content.split("\n").find((line) => line.trim());
    const m = first && first.trim().match(/^!\[\[([^\]|]+\.(?:png|jpe?g|gif|webp|avif|svg))(?:\|([^\]]*))?\]\]$/i);
    if (!m) return null;
    return { src: m[1].trim(), alt: m[2] && !/^\d+(x\d+)?$/.test(m[2].trim()) ? m[2].trim() : "" };
  });
  eleventyConfig.addFilter("dropLeadFigure", (html) => String(html).replace(/^\s*<p>!\[\[[^\]]*\]\]<\/p>/, ""));
  // "2026-10" -> "October 2026"; a bare year stays as is.
  eleventyConfig.addFilter("monthYear", (value) => {
    const m = String(value).match(/^(\d{4})-(\d{2})/);
    return m ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(+m[1], +m[2] - 1, 1))) : String(value);
  });
  eleventyConfig.addFilter("shortDate", (date) => usDate(date, "short"));

  const byOrder = (tag) => (api) =>
    api.getFilteredByTag(tag).sort((a, b) => a.data.order - b.data.order);
  eleventyConfig.addCollection("experience", byOrder("experience"));
  eleventyConfig.addCollection("featured", (api) => byOrder("experience")(api).filter((item) => item.data.featured));
  // Landing page panels keep their hand-set order; projects without one go last.
  eleventyConfig.addCollection("projects", (api) =>
    api.getFilteredByTag("projects").sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999))
  );
  // About page: the projects named in about.md's selected_projects, in that order; all of them if none are.
  eleventyConfig.addFilter("selectedProjects", (items) =>
    model.selectedProjects ? model.selectedProjects.map((url) => items.find((item) => item.url === url)).filter(Boolean) : items
  );
  eleventyConfig.addCollection("blog", (api) => api.getFilteredByTag("blog").sort((a, b) => b.date - a.date));

  return {
    dir: { input: ".", includes: "src/_includes", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
