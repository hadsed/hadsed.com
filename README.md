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

A role, in `content/experience/<start>-<slug>.md`, such as `2017-06-ontra.md`, so the files sort chronologically; the site addresses the role by the part after the date, as `/experience/#ontra` (omit `end` for a current role; `order` 1 is most recent; `featured: false` keeps a role off the landing page timeline while it stays on the Experience page; `role` and `subtitle` are optional, and `link` turns the subtitle into a link; `upcoming: true` marks the entry with the glowing orb, as `2026-next.md` does):

```md
---
org: Vinci
role: Founding ML Engineer
subtitle: Semiconductor physics AI unicorn
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

An article, in `content/articles/<slug>.md` (renders at `/blog/<slug>/`):

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

## Editing in Obsidian

Content is edited in the Obsidian vault, folder `hadsed.com/`, which mirrors
`content/`: `about.md`, `experience/`, `projects/`, `articles/`, `assets/`.
A bridge on the Hetzner box (`scripts/hadsed-bridge.sh`, installed with the
units in `scripts/systemd/`) copies that folder into the `obsidian` branch every
two minutes and keeps one PR open to `main`. Pushes to `obsidian` deploy a
preview at https://obsidian.hadsed-com.pages.dev; merging deploys hadsed.com.
`[[slug]]` wikilinks resolve to project, article, and experience pages at build
time (a role by its filename, `[[2017-06-ontra]]`, or by the bare `[[ontra]]`), and `![[file.png]]` embeds images from `assets/`. An unresolved wikilink
fails the build.

Shell changes (anything outside `content/`) go through normal branches and
PRs. The vault's `hadsed.com/AGENTS.md` explains the folder from the editing
side. The `/publish` skill in `.claude/skills/` is the review step between the
vault and a merge.
