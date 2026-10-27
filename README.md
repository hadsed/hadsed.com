# hadsed.com

Had Seddiqi's personal site. Four pages (About, Portfolio, Experience, Blog) rendered from markdown by [Eleventy](https://www.11ty.dev/) into plain HTML, deployed to Cloudflare Pages on every push to `main`.

```sh
npm install
npm run dev     # serves http://localhost:8080 and rebuilds on change
npm run build   # writes _site/
npm test        # builds and checks the output
```

## Adding content

Everything you write lives under `content/`. Each file is markdown with a short front matter block.

A role, in `content/experience/<slug>.md` (omit `end` for a current role; `order` 1 is most recent; `featured: false` keeps a role off the landing page timeline while it stays on the Experience page):

```md
---
org: Vinci
role: Founding ML Engineer
subtitle: Foundation models for physics
start: "2024-03"
end: "2025-09"
featured: true
order: 2
---
- Bullets for the Experience page.
```

A project, in `content/projects/<slug>.md` (`link` is optional; the body renders at `/portfolio/<slug>/`):

```md
---
title: Subassembler
summary: One line shown under the title.
year: 2026
order: 1
---
The write-up.
```

A post, in `content/posts/<slug>.md` (renders at `/blog/<slug>/`):

```md
---
title: Hello
date: 2026-10-27
summary: One line for the blog index.
---
The post.
```

The About page's name, tagline, avatar, links, education, and publications are front matter in `content/about.md`; its body is the blurb.

## Changing the design

`src/` is the design: one layout (`src/_includes/base.njk`), two partials for the timeline and the project panels, four page templates, and one stylesheet (`src/css/site.css`) whose `:root` block holds every color and spacing value. A design pass changes `src/` and never touches `content/`.

`notes/` holds the SR-71 intro work in progress and the research behind it. It stays in the repository and is not deployed. The design and plan documents are under `docs/superpowers/`.
