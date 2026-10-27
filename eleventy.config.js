export default function (eleventyConfig) {
  for (const path of ["notes/**", "plans/**", "docs/**", "scripts/**", "test/**", ".superpowers/**", ".claude/**", "README.md"]) {
    eleventyConfig.ignores.add(path);
  }

  eleventyConfig.addPassthroughCopy({ "src/css": "css", "src/assets": "assets" });

  eleventyConfig.addGlobalData("buildYear", () => new Date().getFullYear());

  eleventyConfig.addFilter("year", (value) =>
    value instanceof Date ? String(value.getUTCFullYear()) : String(value).slice(0, 4)
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
