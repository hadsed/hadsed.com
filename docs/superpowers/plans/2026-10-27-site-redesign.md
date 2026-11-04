# hadsed.com Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sprite homepage with a four-page, markdown-driven static site (About, Portfolio, Experience, Blog) rendered by Eleventy, with a left text menu and a timeline on the landing page.

**Architecture:** Eleventy reads markdown under `content/` and page templates under `src/`, renders everything through one layout, and writes `_site/`. Content files carry front matter the templates read; nothing in `content/` contains layout. A single CSS file holds the design as custom properties.

**Tech Stack:** Node 24, Eleventy 3.1.x (only dev dependency), Nunjucks templates, plain CSS, `node:test` for build checks, Cloudflare Pages via the existing GitHub Actions workflow.

**Spec:** `docs/superpowers/specs/2026-10-27-site-redesign-design.md`

## Global Constraints

- The only dev dependency is `@11ty/eleventy` 3.1.7. No client-side JavaScript in this plan.
- `content/` is Had's; nothing under `src/` reads it in a way that requires editing content to change the design.
- Colors and spacing are CSS custom properties on `:root`. Starting values: background `#1c2433`, text `#c8cdd5`, muted `#8a919c`, accent `#e6e9ed`.
- No cards, shadows, border radii on panels, gradients, icons, or display fonts. Plain sans-serif stack.
- Phone number never appears. Email appears once, as a mailto link on the About page.
- `notes/`, `plans/`, `docs/`, `scripts/`, `README.md` are never rendered or copied into `_site/`.
- Menu order: About, Portfolio, Experience, Blog. Site name at the top of the menu: "Had Seddiqi".
- Timeline sort: `order` ascending (1 is most recent). Projects sort: `order` ascending. Posts sort: `date` descending.
- A role with no `end` shows "now" as its end year.

## Review Focus

1. A role with no `end` renders as "2025 – now", not "2025 – undefined" (test in Task 4).
2. A project with no `link` renders a panel without a dangling anchor (test in Task 4).
3. Experience bodies written as markdown bullets render as `<ul>` on the Experience page (test in Task 5).
4. At a 400px viewport, the menu is a row above the content and nothing overflows horizontally (manual check in Task 7).
5. With `prefers-reduced-motion: reduce`, the timeline shows fully with no animation (manual check in Task 7).

---

### Task 1: Eleventy scaffold and shell

**Files:**
- Create: `package.json`, `eleventy.config.js`, `.gitignore`
- Create: `src/_includes/base.njk`, `src/css/site.css`, `src/index.njk`
- Create: `test/site.test.mjs`
- Delete: `index.html`, `css/main.css`, `css/sprite.css`, `css/tiles.css`, `js/sprite.js`, `assets/sprites/*`

**Interfaces:**
- Produces: layout `base.njk` consuming `title` (string, page title appended to "Had Seddiqi") and `page.url` (to mark the current menu item). Produces `_site/` with `index.html`, `css/site.css`. Produces `npm run build` and `npm test`.
- Produces: in `eleventy.config.js`, `dir = { input: ".", includes: "src/_includes", output: "_site" }`, ignores for `notes/**`, `plans/**`, `docs/**`, `scripts/**`, `README.md`, `test/**`, passthrough copy of `src/css` to `css` and `src/assets` to `assets`.
- Produces: test helper in `test/site.test.mjs`: `before()` runs `npx @11ty/eleventy --quiet` once; `read(relPath)` returns `_site/<relPath>` as a string.

- [ ] **Step 1: Write the failing test**

```js
// test/site.test.mjs
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../_site/${p}`, import.meta.url), "utf8");
before(() => { execFileSync("npx", ["@11ty/eleventy", "--quiet"], { stdio: "inherit" }); });

test("landing page carries the shell", () => {
  const html = read("index.html");
  for (const label of ["About", "Portfolio", "Experience", "Blog"]) assert.match(html, new RegExp(`>${label}<`));
  assert.match(html, /href="\/css\/site\.css"/);
  assert.match(html, /<title>Had Seddiqi<\/title>/);
});

test("notes and plans are not published", () => {
  assert.equal(existsSync(new URL("../_site/notes", import.meta.url)), false);
  assert.equal(existsSync(new URL("../_site/plans", import.meta.url)), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: fails because `package.json` does not exist yet.

- [ ] **Step 3: Create `package.json`**

Fields: `"private": true`, `"type": "module"`, scripts `build` = `eleventy`, `dev` = `eleventy --serve`, `test` = `node --test test/`, devDependencies `@11ty/eleventy` `^3.1.7`. Run `npm install`.

- [ ] **Step 4: Create `.gitignore`**

Entries: `node_modules/`, `_site/`.

- [ ] **Step 5: Create `eleventy.config.js`**

`export default function (eleventyConfig)` returning the `dir` object above. Add the ignores and passthrough copies from the Interfaces block. Add filter `year(value)` returning the first four characters of `String(value)`, and filter `readableDate(date)` returning e.g. "27 October 2026" via `Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })` (UTC so a YAML date does not shift a day in local time). Add global data `buildYear` = `new Date().getFullYear()`. Add collections `experience` and `projects` as `getFilteredByTag(tag)` sorted by `data.order` ascending; `posts` and `about` come from tags alone.

- [ ] **Step 6: Create `src/_includes/base.njk`**

HTML5 document, `lang="en"`, viewport meta, `<title>` = `title` if set then " · Had Seddiqi", else "Had Seddiqi". Body: `<nav class="menu">` with `<a class="site-name" href="/">Had Seddiqi</a>` and a `<ul>` of the four links (`/`, `/portfolio/`, `/experience/`, `/blog/`), each with `aria-current="page"` when `page.url` equals the href (for `/` require exact match; for others, `page.url` starts with the href). Then `<main>{{ content | safe }}</main>` and `<footer>Had Seddiqi · {{ buildYear }}</footer>`. Keep the DOM to those elements.

- [ ] **Step 7: Create `src/index.njk`**

Front matter: `layout: base.njk`, `permalink: /`. Body: a placeholder `<p>About</p>` (Task 4 replaces it).

- [ ] **Step 8: Create `src/css/site.css`**

`:root` custom properties: `--bg`, `--text`, `--muted`, `--accent`, `--rule` (same as muted), `--font` (sans-serif stack starting with Verdana, Geneva, system-ui), `--measure: 42rem`, `--gap: 2.5rem`, `--menu-width: 9rem`. Base: body background `--bg`, color `--text`, font 15px/1.6, margin 0. Layout: `body` is a grid with columns `var(--menu-width) minmax(0, 1fr)` and a max width around 64rem centered, padding `3rem 1.5rem`. `.menu` list unstyled, links `--text` no underline, underline on hover, `[aria-current="page"]` in `--accent` and `font-weight: 600`. `.site-name` in `--accent`. `footer` spans both columns, muted, small, with a top margin. Below 640px: `body` becomes a single column, `.menu ul` is a horizontal flex row with `gap: 1.25rem`.

- [ ] **Step 9: Delete the old site files**

`git rm index.html css/main.css css/sprite.css css/tiles.css js/sprite.js assets/sprites/*`.

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm test`
Expected: both tests pass. Also run `npm run build` and confirm `_site/` contains only `index.html` and `css/site.css`.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json .gitignore eleventy.config.js src test
git commit -m "Replace sprite site with Eleventy shell and left menu"
```

---

### Task 2: Content files

**Files:**
- Create: `content/about.md`
- Create: `content/experience/experience.json` and seven role files: `alpine-intelligence.md`, `vinci.md`, `solara-health.md`, `ontra.md`, `genapsys.md`, `oak-ridge.md`, `nasa-ames.md`
- Create: `content/projects/projects.json` and `subassembler.md`, `video-to-assembly-instructions.md`, `address-to-3d-home.md`
- Create: `content/posts/posts.json` and `hello.md`
- Create: `src/assets/avatar.svg` (placeholder)

**Interfaces:**
- Produces collections `about` (one item), `experience` (7), `projects` (3), `posts` (1), via `tags` in the directory data files.
- Experience front matter: `org`, `role`, `subtitle`, `start` (string "YYYY-MM"), `end` (string, omitted for current), `featured` (bool), `order` (int). Body: markdown bullets.
- Project front matter: `title`, `summary`, `year` (int), `link` (optional), `order` (int).
- Post front matter: `title`, `date`, `summary`.
- About front matter: `name`, `tagline`, `avatar`, `links` (list of `{label, url}`), `education` (string), `publications` (list of strings). Body: blurb.

- [ ] **Step 1: Write the failing test**

Append to `test/site.test.mjs`:

```js
test("content collections are complete", () => {
  // Task 3+ renders these; here only confirm the build still succeeds and content is not emitted as pages
  assert.equal(existsSync(new URL("../_site/content", import.meta.url)), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: the new test passes trivially until content exists; proceed (the real assertion lands in Task 4). If it fails, the build broke.

- [ ] **Step 3: Create the directory data files**

`content/experience/experience.json`: `{ "tags": ["experience"], "permalink": false }`.
`content/projects/projects.json`: `{ "tags": ["projects"], "layout": "project.njk", "permalink": "/portfolio/{{ page.fileSlug }}/" }`.
`content/posts/posts.json`: `{ "tags": ["posts"], "layout": "post.njk", "permalink": "/blog/{{ page.fileSlug }}/" }`.

- [ ] **Step 4: Create the seven experience files**

Values from the spec's "Initial content" table and bullets, verbatim. `order` 1 through 7 in table order. `featured: true` on all seven. Omit `end` for Alpine Intelligence.

- [ ] **Step 5: Create `content/about.md`**

Front matter per the spec's About section: `tags: [about]`, `permalink: false`, `name: Had Seddiqi`, `tagline: Machine learning for the physical world`, `avatar: /assets/avatar.svg`, the four links in order, `education: B.S. Physics, Georgia Southern University`, the five publications in order. Body: two short paragraphs drafted from the resume summary, followed by an HTML comment `<!-- Draft from the May 2026 resume. Rewrite freely. -->` as the first line of the body.

- [ ] **Step 6: Create the three project files and one post**

Projects per the spec's project list: `order` 1 to 3, `year: 2026`, no `link`, a one-paragraph placeholder body opening with `<!-- Placeholder. Rewrite freely. -->`. Post `hello.md`: `title: Hello`, `date: 2026-10-27`, `summary: A placeholder post so the blog layout can be seen.`, two short paragraphs.

- [ ] **Step 7: Create `src/assets/avatar.svg`**

A 160×160 SVG: a filled square in `#2a3447` with a slightly lighter circle centered, no text.

- [ ] **Step 8: Run the test**

Run: `npm test`
Expected: pass. The build will warn about missing `project.njk` and `post.njk` layouts; if it errors, create empty stub layouts `src/_includes/project.njk` and `src/_includes/post.njk` containing `{{ content | safe }}` with front matter `layout: base.njk` (Task 5 fills them in).

- [ ] **Step 9: Commit**

```bash
git add content src/assets test
git commit -m "Add markdown content for about, experience, projects, and blog"
```

---

### Task 3: Timeline and panel partials

**Files:**
- Create: `src/_includes/timeline.njk`, `src/_includes/panels.njk`
- Modify: `src/css/site.css`

**Interfaces:**
- `timeline.njk` consumes a variable `roles` (array of experience collection items) and `detailed` (bool). Renders `<ol class="timeline">`; each `<li class="timeline-entry">` has `<span class="orb"></span>`, a header row with `.org` and `.dates` ("2024 – 2025" using the `year` filter; "now" when `end` is missing), a `.role` line (`role` + " · " + `subtitle`), and when `detailed` is true, `<div class="entry-body">{{ item.templateContent | safe }}</div>`.
- `panels.njk` consumes `projects` (array). Renders `<section class="panels">`; each `<article class="panel">` has `<h3><a href="{{ item.url }}">{{ title }}</a></h3>`, `<span class="year">`, `<p class="summary">`, and an external `<a class="link">` only when `link` is set.

- [ ] **Step 1: Create `src/_includes/timeline.njk` and `src/_includes/panels.njk`**

Per the Interfaces block. Callers set the variables with `{% set roles = collections.experience %}` and `{% set detailed = false %}` before `{% include %}`; the collections are already sorted by the config from Task 1.

- [ ] **Step 2: Add the CSS**

In `site.css`: `.timeline` list unstyled with `border-left: 1px solid var(--rule)` and left padding; `.timeline-entry` relative with margin between entries; `.orb` absolutely positioned 7px circle in `--muted` centered on the line at the org baseline; `.org` and `.dates` on one row via flex with `justify-content: space-between`, `.dates` muted and tabular numerals; `.role` muted, smaller; `.entry-body` smaller, muted, with `ul` padding restored. Load animation: `.timeline-entry` fades in and translates up 4px over 300ms, staggered by `--i` using `animation-delay: calc(var(--i) * 60ms)`; set `style="--i: {{ loop.index0 }}"` on each entry. Wrap the animation in `@media (prefers-reduced-motion: no-preference)` so reduced-motion users see the static timeline.
`.panels`: `column-count: 2; column-gap: var(--gap)` with `.panel { break-inside: avoid; margin-bottom: 2rem; }` so panels flow unevenly rather than in a strict grid; below 640px `column-count: 1`. `.panel h3` regular weight, `.year` muted, `.summary` normal text. No borders, no backgrounds.

- [ ] **Step 3: Verify by rendering**

Temporarily include both partials from `src/index.njk` and run `npm run build`; open `_site/index.html` and confirm seven entries and three panels render without Nunjucks errors. Leave the includes in place (Task 4 arranges them).

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "Add timeline and project panel partials"
```

---

### Task 4: About landing page

**Files:**
- Modify: `src/index.njk`, `src/css/site.css`
- Modify: `test/site.test.mjs`

**Interfaces:**
- Consumes `collections.about[0]` (data: `name`, `tagline`, `avatar`, `links`, `education`, `publications`; `templateContent` is the blurb), `collections.experience`, `collections.projects`, `timeline.njk`, `panels.njk`.

- [ ] **Step 1: Write the failing tests**

```js
test("landing page shows about, timeline, and projects", () => {
  const html = read("index.html");
  assert.equal((html.match(/class="timeline-entry"/g) || []).length, 7);
  assert.equal((html.match(/class="panel"/g) || []).length, 3);
  assert.match(html, /2025 – now/);
  assert.match(html, /2012 – 2015/);
  assert.match(html, /mailto:hadsed@gmail.com/);
  assert.match(html, /Adiabatic Quantum Optimization for Associative Memory Recall/);
  assert.doesNotMatch(html, /class="link"/); // no project has a link yet
  assert.doesNotMatch(html, /404-694/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the new test fails on the about assertions (mailto, publication).

- [ ] **Step 3: Write `src/index.njk`**

Front matter unchanged. Body: `<section class="about">` with `<img class="avatar">`, `<h1>{{ about.data.name }}</h1>`, `<p class="tagline">`, the blurb via `templateContent | safe`, `<ul class="links">` of the links, then `<h2 class="label">Publications</h2>` with a `<ul class="publications">` and a `<p class="education">`. Beside it, `<section class="recent">` with `<h2 class="label">Experience</h2>` and `{% include "timeline.njk" %}` with `detailed = false`. Below both, `<section class="projects">` with `<h2 class="label">Projects</h2>` and `{% include "panels.njk" %}`. Wrap the first two sections in `<div class="landing">`.

- [ ] **Step 4: Add the CSS**

`.landing` grid `minmax(0, 1fr) minmax(0, 1fr)` with `gap: var(--gap)`, single column below 800px. `.avatar` 72px square, `border-radius: 4px`. `h1` 1.6rem regular weight, small margin. `.tagline` muted. `.label` 0.75rem uppercase letter-spaced muted with a top margin. `.links` inline list separated by " · " via `li + li::before`. `.publications` muted, small, `.education` muted small. `.projects` has a top margin of `var(--gap)` and a `border-top: 1px solid var(--rule)` with padding above the label.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src test
git commit -m "Build About landing page with timeline and project panels"
```

---

### Task 5: Portfolio, Experience, and Blog pages

**Files:**
- Create: `src/portfolio.njk`, `src/experience.njk`, `src/blog.njk`
- Create or replace: `src/_includes/project.njk`, `src/_includes/post.njk`
- Modify: `src/css/site.css`, `test/site.test.mjs`

**Interfaces:**
- Pages set `layout: base.njk`, `title`, and permalinks `/portfolio/`, `/experience/`, `/blog/`.
- `project.njk` and `post.njk` set `layout: base.njk` and render `<article class="prose">` with `<h1>{{ title }}</h1>`, a muted meta line (`year` for projects, `readableDate` of `date` for posts, plus the external `link` for projects when set), then `{{ content | safe }}`.

- [ ] **Step 1: Write the failing tests**

```js
test("portfolio page and project pages", () => {
  assert.equal((read("portfolio/index.html").match(/class="panel"/g) || []).length, 3);
  assert.match(read("portfolio/subassembler/index.html"), /<h1>Subassembler<\/h1>/);
});

test("experience page renders bodies as lists", () => {
  const html = read("experience/index.html");
  assert.equal((html.match(/class="timeline-entry"/g) || []).length, 7);
  assert.ok((html.match(/<ul>/g) || []).length >= 7);
  assert.match(html, /Planetary Lake Lander/);
});

test("blog index and post", () => {
  assert.match(read("blog/index.html"), /href="\/blog\/hello\/"/);
  assert.match(read("blog/hello/index.html"), /27 October 2026/);
});

test("current page is marked in the menu", () => {
  assert.match(read("blog/index.html"), /aria-current="page" href="\/blog\/"/);
  assert.doesNotMatch(read("blog/index.html"), /aria-current="page" href="\/"/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: fail on missing `portfolio/index.html`.

- [ ] **Step 3: Write the three pages**

`portfolio.njk`: label "Projects", include `panels.njk` with `collections.projects`. `experience.njk`: label "Experience", include `timeline.njk` with `detailed = true`. `blog.njk`: label "Blog", `<ul class="posts">` of `<li><a href="{{ post.url }}">{{ title }}</a> <span class="dates">{{ date | readableDate }}</span><p class="summary">` for `collections.posts | reverse`.

- [ ] **Step 4: Write `project.njk` and `post.njk`**

Per the Interfaces block.

- [ ] **Step 5: Add the CSS**

`.prose` max-width `var(--measure)`; `.prose h1` same as landing `h1`; `.prose p` margin `0 0 1rem`; `.meta` muted small. `.posts` unstyled list with `margin-bottom: 1.5rem` per item. Ensure `main` content on non-landing pages also respects `--measure` except `.panels` and `.timeline`, which may use the full column.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: all pass. Confirm the menu's `aria-current` attribute order in `base.njk` matches the regex (`aria-current="page" href=`); adjust the template attribute order if needed, not the test.

- [ ] **Step 7: Commit**

```bash
git add src test
git commit -m "Add Portfolio, Experience, and Blog pages"
```

---

### Task 6: Deploy workflow and README

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `README.md`

- [ ] **Step 1: Update the workflow**

After checkout add `actions/setup-node@v4` with `node-version: 24` and `cache: npm`, then `run: npm ci` and `run: npm run build`. Change the deploy command to `pages deploy _site --project-name=hadsed-com`.

- [ ] **Step 2: Write the README**

Sections: what the site is (one paragraph), `npm install`, `npm run dev`, `npm test`; "Adding content" with the front-matter fields for a role, a project, and a post, each as a five-line example; "Changing the design" stating that `src/` is the design and `content/` is never touched by it; a line that `notes/` holds the SR-71 intro work in progress and is not deployed.

- [ ] **Step 3: Verify**

Run: `npm ci && npm run build && npm test`
Expected: clean install, build, and tests pass, proving the workflow's commands work locally.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "Build with Eleventy before deploying to Cloudflare Pages"
```

---

### Task 7: Visual verification

**Files:** none unless the checks find a defect; fixes go to `src/css/site.css`.

- [ ] **Step 1: Serve and view**

Run `npm run dev` and open the site in the browser pane. Check each of the four pages and one project and one post page at desktop width.

- [ ] **Step 2: Check the shell rules**

No cards, shadows, gradients. Menu is plain text on the left, current page marked. Timeline line and orbs visible; dates right-aligned on the org line. Project panels flow in two uneven columns with no borders.

- [ ] **Step 3: Check narrow width and reduced motion**

At 400px: menu becomes a row above content, no horizontal scroll, panels stack. Emulate `prefers-reduced-motion: reduce` in the browser pane and reload: timeline fully visible immediately.

- [ ] **Step 4: Fix and commit any CSS defects**

```bash
git add src/css/site.css
git commit -m "Adjust shell styles after visual check"
```
