# hadsed.com redesign: design

Date: 2026-10-27. Status: draft for Had's approval.

## Intent

Replace the pixel-sprite homepage with a minimal personal site that reads like a small research lab's page. The site should mostly disappear behind the content, with a little personality from the structure of early-2000s personal sites: a plain text menu down the left, generous whitespace, text sitting directly on the page.

The same shell will later be reused for research.appliedrealities.ai with a brand swap. That is why content and shell must stay cleanly separated: Had expects to iterate heavily on the visual design (including ambitious animation later) while the content stays put.

## Goals

- Four pages: About (the landing page), Portfolio, Experience, Blog.
- Dark slate navy background, light gray text, a lighter gray as the only accent.
- Left-hand text menu for navigation. No header bar, no hamburger, no icons.
- No cards, no shadows, no rounded panels, no gradients, no modern component look.
- Landing page: name, avatar, short blurb on the left; a compact experience timeline on the right; project panels below.
- All content in markdown files with front matter. The design never touches content files.
- Minimal tooling so agents can do creative frontend work without fighting a framework.
- Keep the Cloudflare Pages deploy.

## Non-goals

- Sprite, pixel art, retro-terminal effects. The earlier research notes on those stay in `notes/` but are not part of this design.
- Animations beyond a restrained accent. Structure comes first; animation is a later pass once the structure exists.
- A CMS, comments, search, RSS, analytics. (RSS is a reasonable later addition and nothing here blocks it.)
- Dark/light theme toggle. The site is dark only.
- Mobile-specific features. Pages must be readable on a phone, nothing more.

## Anti-goals

Things that would make this a failure even if it technically works:

- Content baked into templates or HTML, so a design pass has to re-touch content.
- A dependency tree or build pipeline that an agent has to learn before changing the look.
- A result that looks like a Tailwind or Notion template: cards, pills, drop shadows, gradient buttons, oversized hero type.
- Visual noise that competes with the writing.

## Constraints

- Static output. The deploy is Cloudflare Pages through the existing GitHub Actions workflow.
- Had's real history comes from the May 2026 resume. The facts the site needs are reproduced in "Initial content" below so the builder does not need the resume file. Phone number never appears on the site.
- Markdown is the only content format. Front matter holds the structured fields the layout needs.

## How it gets made

### Tooling (Had: minimal; Claude's call on the specific tool)

Eleventy (11ty) as the only dev dependency. It is a static site generator, not a frontend framework: it reads markdown and a few template files and writes HTML. There is no client-side runtime. One `package.json`, one short `eleventy.config.js`, one layout file. Cloudflare Pages runs `npm run build` and serves the `_site/` folder.

The GitHub Actions workflow changes from deploying the repo root to running the build and deploying `_site/`.

### Repository layout

```
content/
  about.md                 name, tagline, avatar path, links; body is the blurb
  experience/*.md          one file per role
  projects/*.md            one file per project
  posts/*.md               one file per blog post
src/
  _includes/base.njk       the one shared layout: head, left menu, main column
  index.njk                About landing page
  portfolio.njk            Portfolio index
  experience.njk           Experience page
  blog.njk                 Blog index
  css/site.css             all styling
  assets/                  avatar and any images
eleventy.config.js
package.json
.github/workflows/deploy.yml
```

Everything under `content/` is Had's. Everything under `src/` is the design's. A design pass may change anything in `src/` and nothing in `content/`.

The old `index.html`, `css/`, `js/`, and `assets/sprites/` are deleted. `notes/`, `plans/`, and `scripts/` stay in the repository as they are.

Today the workflow deploys the repository root, so everything in `notes/` (about 51 MB of storyboards, inspiration images, and the SR-71 directing-room page) is publicly served from hadsed.com. The new build deploys only `_site/`, so nothing in `notes/` is served any more. That is intended: the SR-71 directing room is work in progress that Had previews through a loopback-only local server, and it stays in the repository untouched. Wiring the finished SR-71 intro in front of the About page is a later design pass on the shell.

### Content front matter

Experience (`content/experience/<slug>.md`):

```
---
org: Vinci
role: Founding ML Engineer
subtitle: Foundation models for physics
start: 2024-03
end: 2025-09        # omit for a current role
featured: true      # appears on the landing timeline
order: 2            # sort key, most recent first
---
Body: the bullets for the Experience page, as markdown.
```

Project (`content/projects/<slug>.md`):

```
---
title: Subassembler
summary: One line shown under the title on the landing page and Portfolio.
year: 2026
link: https://...   # optional external link
order: 1
---
Body: the write-up, rendered at /portfolio/<slug>/.
```

Post (`content/posts/<slug>.md`):

```
---
title: ...
date: 2026-10-27
summary: One line for the Blog index.
---
Body, rendered at /blog/<slug>/.
```

About (`content/about.md`):

```
---
name: Had Seddiqi
tagline: One short line under the name.
avatar: /assets/avatar.jpg
links:
  - label: GitHub
    url: https://github.com/hadsed
  - ...
publications:
  - Adiabatic Quantum Optimization for Associative Memory Recall
  - ...
---
Body: the blurb, two or three short paragraphs.
```

### Pages and routes

| Route | Source | Content |
|---|---|---|
| `/` | `index.njk` | About block, featured timeline, project panels |
| `/portfolio/` | `portfolio.njk` | All projects, same panel treatment as the landing page |
| `/portfolio/<slug>/` | project markdown | Project write-up |
| `/experience/` | `experience.njk` | All roles, full timeline, bullets under each |
| `/blog/` | `blog.njk` | Post list: title, date, summary |
| `/blog/<slug>/` | post markdown | The post |

### The shell

- A single centered content area. Left column holds the text menu; right column holds the page. The menu column is narrow and fixed-width; the page column has a comfortable maximum reading width (roughly 70 to 80 characters for body text, wider for the landing page's two-column section).
- Menu: the site name at top, then four plain text links stacked vertically: About, Portfolio, Experience, Blog. The current page is marked by weight or color only, no background. Links underline on hover.
- Footer: name and year, muted.
- On narrow screens the menu becomes a single row of text links above the content. Nothing else changes.

### The landing page

Top section, two columns:

- Left: avatar (small, square or softly rounded, no frame), name, tagline, the blurb, then a short "Publications" list in muted text.
- Right: the experience timeline for roles marked `featured` (initially all seven, so the `featured` flag is there for later pruning). Each entry shows the organization in regular weight, the role and subtitle in muted text beneath it, and the year range right-aligned on the organization's line. Entries connect through a thin vertical line with a small orb at each entry. This is the one place where restrained animation is welcome (for example orbs or the line drawing in on load), honoring `prefers-reduced-motion`.

Below, full width: a "Projects" heading in the same muted small-caps style as the other section labels, then project panels. A panel is title, year, summary, with the title linking to the project page. Panels flow in a loose two-column arrangement: not a rigid grid of equal boxes. No borders or backgrounds; panels are separated by spacing and the thin rules the rest of the site uses. On narrow screens they stack.

### The other pages

- Portfolio: the same panels, all projects.
- Experience: the full timeline, every role, with the markdown body rendered under each entry. Same line-and-orb treatment as the landing page.
- Blog: a plain list. Post pages are the base shell with the post body, a title, and a date.

### Palette and type (Claude's call, open to change)

- Background: dark slate navy, close to `#1c2433`.
- Text: light gray, close to `#c8cdd5`. Muted text a step darker, close to `#8a919c`. Lines and orbs in the muted gray.
- Accent: a lighter gray, close to `#e6e9ed`, for the current menu item and hover states. No colored accent.
- Type: a plain sans-serif stack, with the era in mind. Body around 15 to 16px, line height around 1.6. Section labels small, uppercase, letter-spaced, muted. No display fonts.

All colors and spacing are CSS custom properties on `:root` so a brand swap for Applied Realities is a few lines.

### Initial content

Experience, all seven roles, most recent first. Subtitles are Claude's one-line cut; Had edits them. All seven are featured and appear on the landing timeline (Had's decision: Oak Ridge and NASA Ames belong there).

| Org | Role | Subtitle | Start | End | Featured |
|---|---|---|---|---|---|
| Alpine Intelligence | Founder | Frontier models and agents for the physical world | 2025-09 | current | yes |
| Vinci | Founding ML Engineer | Foundation models for physics | 2024-03 | 2025-09 | yes |
| Solara Health | Cofounder and CTO | Clinician-facing AI copilot | 2023-06 | 2024-01 | yes |
| Ontra | Director of Machine Learning | Built the ML function from first hire to a team of 13 | 2017-06 | 2022-02 | yes |
| GenapSys | Software and ML Engineer | Electrical DNA sequencing | 2015-05 | 2016-11 | yes |
| Oak Ridge National Laboratory | Research Associate | Machine learning and quantum computing | 2012-05 | 2015-05 | yes |
| NASA Ames Research Center | Research Associate | AI for the Planetary Lake Lander | 2013-06 | 2013-12 | yes |

Bodies for the Experience page, as markdown bullets:

- Alpine Intelligence: consulting in frontier models and agents for the physical world at VC-backed startups and large companies. Led a small team building multi-agent systems that parse structural, environmental, and electrical engineering plans for permit approvals. Pretraining, RL post-training, evaluations, and experimentation practice for a foundation model that generates mechanical CAD.
- Vinci: foundation models for physics, validated by over half of the world's top 20 semiconductor companies and in production at three. Led pretraining of thermal simulation foundation models for semiconductor design and designed their evaluation benchmarks and red-teaming protocols. Built synthetic data pipelines for chip packages and mechanical part geometries. Owned a generative model for CAD applied to consumer electronics industrial design, from core modeling through product wrapping. Built simulation agents that automate experiment design, simulation setup, and post-analysis for hardware engineering.
- Solara Health (now SanLuca AI): led technical strategy and the MVP build for a clinician-facing AI copilot. Raised a seed round from Define Ventures and SemperVirens. Drove the pivot to enterprise healthcare based on market signal.
- Ontra (formerly InCloudCounsel): employee 12, engineer 4. Built the ML function into a 13-person department spanning research, ML engineering, operations, and product. Led ML through the Series A (Battery Ventures, 2019) and Series B (Blackstone Growth, 2021). Owned end-to-end ML for contract automation products serving 9 of the top 10 private equity firms by assets under management.
- GenapSys: ML signal-processing models for the first purely electrical DNA sequencing platform, reading single-nucleotide incorporations from CMOS biosensor chips with millions of impedance sensors. High-throughput sensor data pipelines and device drivers for chip-to-cloud transfer.
- Oak Ridge National Laboratory: machine learning for adiabatic quantum computers (Hopfield networks, Boltzmann machines, Monte Carlo simulators in Python, C++, MPI, OpenMP, CUDA). Numerical solvers for a quantum programming IDE. Two published papers.
- NASA Ames Research Center: Gaussian process models for adaptive sensor sampling to cut onboard power use, and HMM-based storm detection from environmental sensor streams, for the Planetary Lake Lander. Co-author on the mission methodology paper.

About page front matter:

- Name: Had Seddiqi. Tagline is Claude's draft, something like "Machine learning for the physical world"; Had edits it.
- Links, in this order: GitHub (github.com/hadsed), LinkedIn (linkedin.com/in/hadsed), Google Scholar (scholar.google.com/citations?user=nYbFo6EAAAAJ), Email (hadsed@gmail.com, as a mailto link). Including the email is Claude's call; Had can strike it.
- Education, one muted line after the publications: "B.S. Physics, Georgia Southern University." Claude's call to include it, since it fits the research-lab framing and costs one line.
- Publications, in this order: Adiabatic Quantum Optimization for Associative Memory Recall; Planetary Lake Lander: Adaptive Science Initial Results; An Integrated Programming and Development Environment for Adiabatic Quantum Optimization; Performance Models for Split-Execution Computing Systems; Approximate Mean-Field Equations for Quasi-2D Bose-Einstein Condensates.
- Blurb body: drafted by Claude from the resume summary (12+ years in ML, founded the ML function at Ontra and grew it to 13, now focused on foundation models and agents for scientific and industrial domains), two or three short paragraphs, flagged for Had to rewrite.
- Avatar: a placeholder image until Had supplies one.

Projects, as mockups Had will rewrite, each with a one-line summary and a paragraph of placeholder body:

- Subassembler: step-by-step assembly walkthroughs generated from CAD.
- Video to assembly instructions: turning a video of someone building a thing into CAD assembly instructions.
- Address to 3D home: a 3D model of a house from its street address.

Blog: one placeholder post so the index and post layout can be seen.

## Left to the builder

- Exact spacing, type sizes, and the loose two-column rule for project panels.
- How the timeline line and orbs are drawn (pseudo-elements vs. inline SVG) and what the one restrained animation is.
- Eleventy configuration details (collections, permalinks, passthrough copy, date formatting).
- The workflow change for building before deploy.
- A short README section describing how to add a role, project, or post.
