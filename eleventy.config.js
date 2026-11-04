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
  for (const path of ["notes/**", "plans/**", "docs/**", "scripts/**", "test/**", ".superpowers/**", ".claude/**", "README.md"]) {
    eleventyConfig.ignores.add(path);
  }

  eleventyConfig.addPassthroughCopy({ "src/css": "css", "src/assets": "assets", "content/assets": "assets" });

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

  eleventyConfig.addGlobalData("buildYear", () => new Date().getFullYear());

  eleventyConfig.addFilter("year", (value) =>
    value instanceof Date ? String(value.getUTCFullYear()) : String(value).slice(0, 4)
  );
  eleventyConfig.addFilter("roleSlug", roleSlug);
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
