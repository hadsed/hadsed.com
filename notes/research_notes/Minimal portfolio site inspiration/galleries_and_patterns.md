# Minimal portfolio site inspiration: galleries and recurring patterns

Research date: 2026-10-27. Method: WebSearch, WebFetch (text extraction), and direct `curl` of page HTML to inspect real class names and markup. WebFetch returns only text, so it cannot see layout or color. Where I state a CSS detail, it comes from grepping the raw HTML. Target direction throughout: dark slate navy background, light gray text, no cards, a plain text menu on the left, an About page with a compact line-and-orbs experience timeline, project panels below, plus Portfolio, Experience, and Blog pages.

## Which galleries, directories, and threads are best for finding minimal personal sites?

### Takeaway
The galleries most useful for this direction are not the big design-award sites. They are the developer-oriented directories (personalsit.es, the HN Personal Websites Directory, emmabostian/developer-portfolios) and httpster's style filters (`/style/minimal/`, `/style/dark/`, `/style/typographic/`). minimal.gallery has Personal and Portfolio tags but no dark filter. godly.website, awwwards, and land-book lean toward agency and showcase sites full of the "modern UI chrome" the target avoids. The single closest existing match to the target is brittanychiang.com, listed in developer-portfolios.

### Cited Findings

**minimal.gallery** — https://minimal.gallery/
- Indexes curated website design inspiration in three sections: Websites, Templates, and Tools. The Websites listing runs to 132 pages — [minimal.gallery](https://minimal.gallery/)
- Filter by tag: Portfolio (987 entries) and Personal (811) are the relevant ones. It also filters by build platform (Framer, Webflow, Readymag). There is no "dark" or "text-only" content filter; "Dark" is only a theme toggle for the gallery itself (Alt+M) — [minimal.gallery](https://minimal.gallery/)
- Personal or portfolio entries visible on the front page at fetch time include Ev Astapov (https://astapable.com/), Eli Horn (https://elihorn.ca/), Isaac Fayemi (https://fayemi.design/), David Fiz (https://www.davidfiz.com/), and Bleibtgleich (https://bleibtgleich.dev/) — [minimal.gallery](https://minimal.gallery/). I did not check these individually for dark palettes or timelines. Most of the gallery is light-background designer portfolios.

**httpster** — https://httpster.net/
- The page HTML exposes style filters as URL paths: `/style/minimal/`, `/style/dark/`, `/style/typographic/`, `/style/monotone/`, `/style/brutalist/`, `/style/retro/`, `/style/non-standard-navigation/`, `/style/low-carbon/`, `/style/print/`. It also has type filters, including `/type/blog/` — [httpster.net](https://httpster.net/) (raw HTML inspected)
- How to filter: start from https://httpster.net/style/dark/ and cross-check against `/style/minimal/` and `/style/typographic/`. `/style/non-standard-navigation/` is where left-hand text menus are likely to turn up. Inferred from the filter names; I did not open each filter page.

**One Page Love, Personal category** — https://onepagelove.com/gallery/personal
- A dedicated "Personal Website Design Inspiration" gallery page. The live HTML links entries such as https://onepagelove.com/felix-haas, https://onepagelove.com/josh-puckett, https://onepagelove.com/sam-peitz, and https://onepagelove.com/tim-van-damme-max-voltar. It also has a "lofi" collection (https://onepagelove.com/lofi) — [onepagelove.com](https://onepagelove.com/gallery/personal)
- Relevance: one-page sites only, so the format matches a single About landing page more than a multi-page site.

**dark.design** — https://www.dark.design/
- Self-described "Dark Themed Web Design Inspiration". Responded 200 at fetch time, with per-site pages such as `/site/personal-website-…` — [dark.design](https://www.dark.design/)
- It is the only gallery here built around dark palettes, but most entries are product and agency sites. Search it for "personal" or "portfolio". I found no tag filter in the static HTML; the site is mostly JavaScript-rendered.

**godly.website** — https://godly.website/
- "Recent — Design Inspiration". The static HTML exposed only `/websites`, and the filters are JavaScript-rendered — [godly.website](https://godly.website/)
- Relevance is low. Godly favors heavy motion and WebGL showcase sites, the opposite of the target. Use it only to see which animation conventions are fashionable.

**awwwards, Minimal collection** — https://www.awwwards.com/websites/minimal/
- "Best Minimal Websites". Current entries are mostly agencies and brands (e.g. /sites/mathias-adolfsson-2026, /sites/giordano-betti, /sites/danilele-buser-portfolio, /sites/brandon-yasin) — [awwwards.com](https://www.awwwards.com/websites/minimal/)
- Relevance is low to medium. On awwwards, "minimal" usually means a lot of whitespace plus heavy motion, not text-first.

**brutalistwebsites.com** — https://brutalistwebsites.com/
- Live. A long alphabetical index of raw-HTML-leaning sites (e.g. 032c.com, 1000.library.kr) — [brutalistwebsites.com](https://brutalistwebsites.com/)
- Relevance: useful for the "visible rules, dense text, early-web structure" side of the brief. There is no filter beyond browsing.

**siteinspire** — https://www.siteinspire.com/
- Returned a Vercel Security Checkpoint (HTTP 429) to automated fetches, so I could not inspect it — [siteinspire.com](https://www.siteinspire.com/). From memory, not verified this session: it has style and type filters including "Minimal", "Personal", and "Portfolio".

**land-book** — https://land-book.com/
- Returned a Cloudflare challenge (403) to automated fetches, so I could not inspect it — [land-book.com](https://land-book.com/)

**bestfolios** — https://www.bestfolios.com/
- Returned a 2.9 KB JavaScript shell, so I could not read its contents — [bestfolios.com](https://www.bestfolios.com/). It is mostly product-designer case-study portfolios, a weak fit for a text-first dark site (inferred).

**personalsit.es** — https://personalsit.es/
- A directory of about 1,148 personal websites. It is open source; Andy Bell built it, and Henry Desroches and Declan Chidlow now maintain it. Each entry shows a thumbnail, name, URL, and tags. A tag bar shows counts (developer 813, designer 321). Selecting several tags gives OR logic. There is an RSS-only filter and a "random site" link — [personalsit.es](https://personalsit.es/)
- How to filter: combine the "designer" and "developer" tags, or use "random site" to sample. It is the best directory for hand-built, text-forward sites. Sample entries: bell.bz, charlottedann.com, candost.blog, janlukas.blog, short.is — [personalsit.es](https://personalsit.es/)

**HN Personal Websites Directory (hnpwd)** — https://hnpwd.github.io/
- "A community-maintained directory of personal websites by active members of the HN community". It lists 162 sites, roughly alphabetical, each with Blog, About, Now, and Feed links, and offers an OPML download. There is no search or filter — [hnpwd.github.io](https://hnpwd.github.io/)
- It was started by the original poster of the January 2026 "Ask HN: Share your personal website" thread — [hn.svelte.dev mirror of item 46618714](https://hn.svelte.dev/item/46618714)
- Sample entries: https://alexharri.com/, https://www.evalapply.org/, https://xorvoid.com/, https://amontalenti.com/ — [hnpwd.github.io](https://hnpwd.github.io/)

**Ask HN: Share your personal website (Jan 2026, item 46618714)** — https://news.ycombinator.com/item?id=46618714
- Dated by a linked summary of 2026-01-17. Sites shared include https://westegg.com ("a timeline of interesting projects"), https://masswerk.at, https://danilafe.com, https://simonsarris.com, https://nindalf.com, https://christopheradams.io, and https://rasmuskirk.com — [hn.svelte.dev mirror](https://hn.svelte.dev/item/46618714)
- Timeline pages that commenters pointed to: https://paulstamatiou.com/timeline, and Simon Collison's colly.com named as a favorite life timeline — [hn.svelte.dev mirror](https://hn.svelte.dev/item/46618714). colly.com returned 403 to my fetch, so its status is unverified.

**emmabostian/developer-portfolios (the main "awesome portfolio" list)** — https://github.com/emmabostian/developer-portfolios
- 2,072 portfolios, about 27.4k stars, sorted A to Z, with link-checker config (lychee) and a feed.json. Actively maintained — [GitHub](https://github.com/emmabostian/developer-portfolios)
- Notable entries for this direction: https://brittanychiang.com, https://leerob.io (now leerob.com), https://andy-bell.design, https://chriscoyier.net — [GitHub](https://github.com/emmabostian/developer-portfolios)
- How to filter: there are no tags, so you have to sample. My automated scan of about 400 of its entries (see the next section) found that "timeline" markup is common among student and junior portfolios but rare among the well-regarded minimal ones.

**GitHub topic "personal-website"** — https://github.com/topics/personal-website
- Live (HTTP 200). Useful for finding source code of templates — [GitHub](https://github.com/topics/personal-website)

### Standout sites that fit the target (3 to 6 per source, where verified)
- **brittanychiang.com** (from developer-portfolios) — https://brittanychiang.com/. The closest existing match to the whole target. Details are in the next section — [raw HTML](https://brittanychiang.com/)
- **paulstamatiou.com/timeline** (from the HN thread) — https://paulstamatiou.com/timeline. A dated history of the site's own redesigns ("Built with TanStack Start 2026—Now", "Built with Next.js 2024—2026"). Dates are set in monospace (`font-mono` class, accent color `text-stammy-400`). It shows how a timeline can run as prose entries rather than cards — [raw HTML](https://paulstamatiou.com/timeline)
- **westegg.com** (from the HN thread) — https://westegg.com. Morgan Friedman's "timeline of interesting projects". It is a WordPress/Elementor build, and every one of its 46 entries uses `class="animated fadeInUp"`. It shows the timeline-of-projects idea, but the build is heavy and the fade-on-every-item is the template-style motion to avoid — [raw HTML](https://westegg.com)
- **bell.bz** (from personalsit.es) — https://bell.bz. Andy Bell's personal site, from the creator of personalsit.es. I did not inspect its design this session.
- **alexharri.com** (from hnpwd) — https://alexharri.com/. A long-form technical blog. I did not inspect its design this session.

### Inferences
- For a dark, text-first, left-nav personal site, browse in this order: personalsit.es (random sampling), hnpwd, httpster `/style/dark/` plus `/style/minimal/`, then dark.design. The award galleries (awwwards, godly) are good for motion references and poor for structure references.
- The HN threads are the best source of opinions about what is tasteful. The galleries give no commentary.

### Gaps
- siteinspire, land-book, and bestfolios blocked automated access, so their filters and current entries are unverified.
- I could not reach the "Ask HN: What does your personal website look like?" threads from 2023 to 2025 directly. Only the January 2026 "Share your personal website" thread was found and read (partially; about 100k of 275k characters).
- I did not open "awesome personal websites" lists other than emmabostian's.
- I found no design Twitter/X threads.

## Which sites have a left-hand text menu and a line-and-dots experience timeline, and how is it drawn?

### Takeaway
The combination the target wants (a left text menu plus an experience timeline drawn as a line with orbs) is rare among well-regarded minimal sites. The best-known left-menu dark site, brittanychiang.com, uses a plain dated list with no line or dots, and puts its line motif in the nav instead. Line-and-dot timelines show up mostly in templates and junior portfolios. That makes the target combination a point of differentiation, not a cliché. I could verify only one high-quality left-nav site and a few weaker timeline examples; I did not reach the requested 5 strong examples.

### Cited Findings
- **brittanychiang.com: left-nav reference.** The left column is `lg:sticky lg:top-0 lg:flex lg:max-h-screen lg:w-[48%] lg:flex-col lg:justify-between lg:py-24`: a sticky half-width panel holding name, title, tagline, nav, and socials pushed to the bottom. Each nav item is a small-caps-style label (`text-xs font-bold uppercase tracking-widest text-slate-500`) preceded by a `nav-indicator`, a 1px horizontal line (`h-px w-8 bg-slate-600`) that grows to `w-16` and lightens to `slate-200` on hover or focus (`transition-all … motion-reduce:transition-none`). Section dates are `text-xs font-semibold uppercase tracking-wide text-slate-500`. The background uses Tailwind slate-900 (#0f172a), a slate navy. A `pointer-events-none fixed inset-0 z-30 transition duration-300` overlay is the cursor-following spotlight layer — [brittanychiang.com raw HTML](https://brittanychiang.com/)
- Brittany Chiang's experience section is six dated entries ("2024 — Present", "July — Dec 2017"), each with a role · company heading, a paragraph, and tech tags. There is no timeline line or dots. The colophon reads "Built with Next.js and Tailwind CSS… All text is set in the Inter typeface." — [brittanychiang.com](https://brittanychiang.com/)
- A common, robust technique is one absolutely positioned spine on the container (2px, drawn with `::before`) rather than a border on each entry, because a per-entry border leaves gaps at the margins. Circular nodes sit on each item, with the current role filled — [GitHub issue, slolobdill44/portfolio_page #54](https://github.com/slolobdill44/portfolio_page/issues/54) (via search summary)
- A border-left variant: `border-l` on an `<ol>` forms the line, and each entry gets an absolutely positioned circle that overlaps it (`-left-1.5`, `rounded-full`) — [Flowbite timeline component](https://glama.ai/mcp/servers/@zoltanszogyenyi/flowbite-mcp/blob/576676e46a27d3f036898d6cb64cc9b2a4c24919/data/components/timeline.md) (via search summary)
- A semantic approach: use `<ol>`/`<li>` for ordered history and `<time>` for dates, with the dot as an `li::before` — [CSS-Tricks, simple vertical timeline with a ul](https://css-tricks.com/?p=288037); [Quackit timeline list template](https://www.quackit.com/html/templates/lists/timeline_list.cfm)
- Automated scan: I fetched about 400 sites from developer-portfolios and hnpwd and grepped for "timeline", sticky/aside, `rounded-full`/`border-radius:50%`, and `border-l`/`::before`. Matches included http://marc.dev (dark `#0a050d`), https://aashutosh.dev (`bg-slate-900` / `#0f172a`, a slate navy close to the target), https://adityapoojary.dev, https://abdulmomin.dev, and https://akhileswar6.github.io/Portfolio/ (13 "timeline" classes plus sidebar markup). These are raw-HTML signal matches only. I did not inspect them visually, and they are not curated "best of" sites — [developer-portfolios](https://github.com/emmabostian/developer-portfolios); [hnpwd](https://hnpwd.github.io/)
- Templates that pair a single-column vertical experience timeline with a minimal nav: https://github.com/shivliagrawal/personal-website (a calendar metaphor with a vertical time rail and a sticky minimal nav, live at shivliagrawal.com) and https://github.com/wjdwl556/wjdwl556.github.io (adapted from RyanFitzgerald/vertical-timeline, dates set via a data attribute) — [search results](https://github.com/shivliagrawal/personal-website)

### Inferences
- The recommended build for the target is an `<ol>` with `position:relative`. Draw a single 1px `::before` spine in a muted slate (e.g. slate-700 on slate-900). Give each `<li>` a `::before` orb of 7 to 9px, filled with the background color and a 1px light border, and fill only the current role. Put dates in a small monospace or tabular-nums label. This merges Brittany Chiang's typographic restraint with the line-and-orbs motif she doesn't use.
- The fastest way to fill the "5 strong examples" gap is to browse httpster `/style/dark/` and personalsit.es by hand. Automated grepping is weak because most good sites render through JavaScript and don't name their classes "timeline".

### Gaps
- I found fewer than 5 verified, high-quality examples with both a left text menu and a line-plus-dot timeline. Only brittanychiang.com is verified as a strong left-nav example, and it has no dot timeline. The scan hits are unverified visually.
- colly.com (Simon Collison's life timeline) returned 403. I could not check whether it is live or what its markup is.
- rauno.me, paco.me, and emilkowal.ski render client-side; static HTML gave no structural evidence.

## What makes an early-2000s-structured site (sidebar nav, dense text, visible rules) feel fresh today?

### Takeaway
The structure can stay old-fashioned when the craft details are modern: a sticky half-width sidebar instead of a fixed-width frame, small uppercase tracked labels instead of bold headers, a muted slate palette with one accent instead of pure black or white, a modern grotesk or variable font, and micro-interactions on the nav (lines that grow) instead of image rollovers.

### Cited Findings
- Brittany Chiang's site shows the modern sidebar formula: a sticky panel taking 48% of the width, vertically justified with content at the top and socials at the bottom. The nav is uppercase `tracking-widest` labels in slate-500 that lighten to slate-200. Everything is set in Inter on a slate-900 field. On mobile the sidebar collapses into a sticky blurred header (`bg-slate-900/75 … backdrop-blur`, `lg:sr-only`) — [brittanychiang.com raw HTML](https://brittanychiang.com/)
- Paul Stamatiou's timeline uses monospace accent-colored dates (`font-mono … text-stammy-400 … tracking-tight`) beside sans headings — [paulstamatiou.com/timeline raw HTML](https://paulstamatiou.com/timeline)
- HN commenters favor deliberately plain, hand-built sites. One aims for KISS and dislikes "modern web design"; another describes "an extremely light hand crafted website". The only critique given to one minimal site was "Too small page margins" — [Ask HN, Jan 2026](https://hn.svelte.dev/item/46618714)

### Inferences
- Freshness levers for the target: (1) generous margins and a measured line length (about 60 to 70ch), since cramped margins were the one critique of a minimal site in the HN thread; (2) a two-tone hierarchy (light gray body, dimmer slate metadata) instead of underlines and colors everywhere; (3) hairline rules at 1px in a low-contrast slate, not `<hr>` defaults; (4) small-caps or uppercase tracked section labels; (5) monospace only for dates and metadata; (6) a modern font (Inter, or a less generic grotesk to avoid looking like Tailwind defaults).
- A slate-navy palette (#0f172a-ish) reads as "considered" rather than "dark mode" because it is blue-tinted rather than neutral. Brittany Chiang's site made this palette famous, so tweak the hue or lightness, or pick a non-Inter font, to avoid looking like a clone of it.

### Gaps
- I found no CSS-Tricks or Smashing article specifically on "making retro sidebar layouts feel modern". The points above combine observed sites with inference.

## Which animations do the most admired minimal sites use, and which are called tasteful versus gimmicky?

### Takeaway
The admired pattern is motion on interaction, not on load: nav lines that grow, hover color shifts, and at most a subtle cursor-following spotlight, always honoring `prefers-reduced-motion`. A fade on every item (`fadeInUp` on everything), page jumps, and heavy WebGL or canvas backgrounds get criticized as distracting or slow.

### Cited Findings
- Brittany Chiang uses three restrained motions: the nav indicator line grows (`w-8` to `w-16`) on hover or focus; a cursor-following spotlight sits on a fixed overlay (`transition duration-300`); and every transition is disabled under `motion-reduce:transition-none` — [brittanychiang.com raw HTML](https://brittanychiang.com/)
- westegg.com applies `animated fadeInUp` (an Animate.css-style class) to all 46 entries, a template-default staggered fade — [westegg.com raw HTML](https://westegg.com)
- Paul Stamatiou's nav labels fade and slide in on hover (`opacity-0 … -translate-y-1 … group-hover/link:opacity-100 … duration-300 ease-in-out`) — [paulstamatiou.com/timeline raw HTML](https://paulstamatiou.com/timeline)
- On HN, a header that "generates as the page loads and you can click to add things on it" got praise. A "slight page jump" was called "distracting". A three.js background's author admitted it "is _not_ performant on some devices" — [Ask HN, Jan 2026](https://hn.svelte.dev/item/46618714)
- Motion guidance attributed to Emil Kowalski says to keep most control transitions around 140 to 220ms, avoid custom cursors, particle effects, and motion that competes with content, and note that long staggered lists feel slow — [skillselion summary of the emilkowalski-motion skill](https://skillselion.com/skills/nexu-io/open-design/emilkowalski-motion) (secondary source). A secondhand summary puts the stagger sweet spot at 30 to 80ms per item — [instagit summary](https://instagit.com/emilkowalski/skills/how-to-implement-stagger-animations-list-items/) (secondary, unverified against the original)
- Cloud Four on staggered transitions: whether to use them "will vary project to project" — [Cloud Four](https://cloudfour.com/?p=4987)

### Inferences
- A tasteful motion budget for the target: (1) one staggered fade-in of the About page's top-level blocks on first load, around 30 to 60ms apart and under about 400ms in total, never per word; (2) the timeline spine draws once, e.g. `scaleY` from 0 to 1 over about 600ms, with orbs fading in after it; (3) underlines or a nav line that grow on hover; (4) cross-document view transitions (`@view-transition { navigation: auto; }`) between Portfolio, Experience, and Blog for continuity; (5) skip or tone down the cursor spotlight, which is now strongly tied to brittanychiang.com. Gate everything behind `prefers-reduced-motion`.
- Gimmicky by community consensus: page jumps or layout shift, heavy canvas or WebGL backgrounds, custom cursors, and fade-ins on every list item.

### Gaps
- I found no primary-source essays from Rauno Freiberg or Emil Kowalski this session. Their sites render client-side, and the motion guidance above comes from secondary summaries.
- I found no community discussion specifically evaluating view transitions or line-drawing timelines on personal sites.
