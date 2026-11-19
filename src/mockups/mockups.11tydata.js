// Mockups of the projects / blog / notes layers. Branch previews only: eleventy.config.js
// ignores src/mockups/ unless SITE_URL or LAB is set, so production never builds them.
export default {
  layout: "base.njk",
  mockNav: true,
  noindex: true,
  eleventyExcludeFromCollections: true,
  permalink: "{{ mockUrl }}",
};
