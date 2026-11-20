# hadsed.com

Had Seddiqi's personal site. About, Experience, Projects, a Blog and Notes, rendered from markdown by [Eleventy](https://www.11ty.dev/) into plain HTML, deployed to Cloudflare Pages on every push to `main`.

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

Projects, blog posts and notes are three layers that link to each other with Obsidian `[[wikilinks]]`. Filenames are free to change in Obsidian: URLs come from front matter, and the deploy fails if a URL that hadsed.com has already published disappears without a redirect (`scripts/check-urls.mjs`).

A blog post, in `content/blog/<anything>.md`, renders at `/blog/<date>-<slug>/` (`slug` defaults to the filename; once published, leave `date` and `slug` alone):

```md
---
title: A 3D home from a street address
date: 2026-11-19
slug: home-3d-from-an-address
summary: One line for the blog index and the project page.
---
The post. Link a note with [[plan-fit]], or a section of any page with [[home-3d-from-an-address#Fitting the plan]].
```

A note, in `content/notes/<slug>.md`, renders at `/notes/<slug>/`. One idea each, no date; the page lists every page that links to it ("Linked from"), and "last tended" is the file's last commit:

```md
---
title: Fitting a floor plan to the footprint
summary: One line for the notes index and project pages.
---
```

A project, in `content/projects/<slug>.md`, renders at `/projects/<slug>/`. The body is the living summary. It lists its posts and key notes, so each post shows "Appears in" this project without naming it; "updated" is the newest listed post or the file's last commit. `slug` renames the URL (the old one redirects), and `redirect_from` keeps older names working. `order` places it on the landing page; `link` is optional:

```md
---
title: Home 3D
status: active          # active, paused or done
summary: One line for the project cards.
started: 2026-10
slug: home-3d
redirect_from: [address-to-3d-home]
posts:
  - "[[home-3d-from-an-address]]"
notes:
  - "[[plan-fit]]"
order: 3
---
```

A hero image, on a project or a blog post: put the file in `content/assets/` and name it in front matter as `hero_image: home-3d.jpg` (Obsidian's `"[[home-3d.jpg]]"` works too), with an optional `hero_image_alt`. It sits under the title and becomes the page's link-preview image. A name that isn't in `content/assets/` fails the build.

Or skip the front matter and start the note with the image embed (`![[home-3d.gif]]` on the first line). It shows at the top in Obsidian, and on the site it becomes the hero instead of appearing twice. `hero_image:` wins when both are there.

To break a note out of a post: link the section first (`[[post#Heading]]`), then move the text into `content/notes/`, point the links at the note, and leave a line in the post. A link to a heading that no longer exists fails the build.

Custom HTML, three ways: raw HTML right in the markdown; a self-contained `.html` file in `content/assets/` embedded with `![[viz.html]]` (or `![[viz.html|caption]]` on its own line), which runs in its own frame inside the page; or `layout: raw` in front matter (or a page written as `.html`), which skips the site template but keeps the URL, project listings and backlinks.

The About page's name, tagline, avatar, links, education, and publications are front matter in `content/about.md`; its body is the blurb.

## Changing the design

`src/` is the design: one layout (`src/_includes/base.njk`), page layouts for posts, projects and notes, partials for the timeline, project panels and backlinks, the index pages, and one stylesheet (`src/css/site.css`) whose `:root` block holds every color and spacing value. A design pass changes `src/` and never touches `content/`. `lib/content.mjs` derives URLs, backlinks, "Appears in" and project activity from `content/`.

`notes/` holds the SR-71 intro work in progress and the research behind it. It stays in the repository and is not deployed. The design and plan documents are under `docs/superpowers/`.

## Editing in Obsidian

Content is edited in the Obsidian vault, folder `hadsed.com/`, which mirrors
`content/`: `about.md`, `experience/`, `projects/`, `articles/`, `assets/`.
A bridge on the Hetzner box (`scripts/hadsed-bridge.sh`, installed with the
units in `scripts/systemd/`) copies that folder into the `obsidian` branch every
20 seconds and keeps one PR open to `main`. Pushes to `obsidian` deploy a
preview at https://obsidian.hadsed-com.pages.dev; merging deploys hadsed.com.
`[[slug]]` wikilinks resolve to project, article, and experience pages at build
time (a role by its filename, `[[2017-06-ontra]]`, or by the bare `[[ontra]]`), and `![[file.png]]` embeds images from `assets/`. An unresolved wikilink
fails the build.

Shell changes (anything outside `content/`) go through normal branches and
PRs. The vault's `hadsed.com/AGENTS.md` explains the folder from the editing
side. The `/publish` skill in `.claude/skills/` is the review step between the
vault and a merge.
