# Lab and Studio Sites: Minimal, Text-First, Research-Serious but Product-Aware

Method: each homepage was fetched directly on 2026-10-27 (WebFetch for structure, curl of raw HTML/CSS for exact colors and fonts). Target design for comparison: dark slate-navy background, light gray text, no cards, a plain text menu on the left, an About page with a compact orb-and-line experience timeline, project panels, and Portfolio, Experience, and Blog pages. This site will later be reused for research.appliedrealities.ai.

## Which independent research labs and studios have admired minimal sites? (verified site-by-site catalogue)

### Takeaway
I verified 17 live sites. The ones closest to the target are worrydream.com (literally dark navy `#10183a` with light-blue text and years hung in the left gutter), Ink & Switch (typed metadata lines and date stamps on a narrow grid), Thinking Machines (numbered post list with a sidebar, plus a serif and grotesk pair), Dynamicland and Folk Computer (raw, archival "lab" honesty), and Transluce, Goodfire, and Physical Intelligence (dated and authored research lists that sit next to products). Sakana, Nous, and Anthropic are useful only for their metadata conventions, because their page chrome is card- and product-heavy.

### Cited Findings

**1. worrydream.com (Bret Victor). Most relevant to the palette.**
- What it is: the personal and lab index of Bret Victor, who leads Dynamicland. The page title is "Bret Victor, human being." — [worrydream.com](https://worrydream.com/)
- Palette and type (from inline CSS): `body { background:#10183a; color:#ace; font: 13px/1.2 "Avenir" }`. Links are `#fff` bold with no underline (underline appears on hover). Headings and list text are `#999`. A highlight class `.good { color:#ff0 }` marks standout items. The column is `max-width: 564px`. — [worrydream.com source](https://worrydream.com/)
- Layout: a single narrow centered column. `h3` year labels use `position:absolute`, so they hang in the left gutter beside each `ul` (which has `margin-left:70px`). Sections are separated by rules and introduced by lowercase taglines such as "placemaking" and "Earlier work". Entries read "Title: short descriptor" (e.g. "Hypercard in the World: escaping the tiny rectangle") or show several media links in a row (talk / doc / poster / notes). A grid of untitled thumbnails closes the page, and there is a "More on previous website" link. — [worrydream.com](https://worrydream.com/)
- Timeline: years act as the only date markers, newest first, so the whole page works as a reverse-chronological timeline without drawing one. — [worrydream.com](https://worrydream.com/)
- Lab feel: dense, tiny type and a navy "night sky" field. Work is listed as artifacts (talk, doc, poster) rather than marketing.
- Borrow: **hanging year labels in the left gutter** (an absolutely positioned `h3` beside an indented list). It is a timeline with no drawn chrome and pairs naturally with orbs on a vertical line. Also borrow the restrained single accent (yellow `.good`) for "featured" items.
- Relevance: the closest existing reference to "dark slate navy, light text, no cards." Note the 13px body is too small for a modern blog; scale it up.

**2. Ink & Switch.**
- What it is: an independent industrial research lab (local-first software, tools for thought). — [inkandswitch.com](https://www.inkandswitch.com/)
- Layout: a single vertical flow of headed sections: "Research Areas", "Featured Work", "Production Software", "Lab Meta", "Appearances". Each entry is a linked title, a short description, and a metadata line with an icon and a type label such as "Lab Notebook" or "2019 Essay". The Appearances section uses compact date stamps such as "2026APR" and "2026JUL12-14". — [inkandswitch.com](https://www.inkandswitch.com/)
- Palette and type (base.css): `--bg-color:#fcfcfc`, `--text-color:black`, `--text-faded:#999`, `--link-color:#f7505e`. Fonts are "Geogrotesque" for headings, Merriweather Sans for body, and Fira Mono. A fluid grid uses `--page-width:62rem`, `--col: 3rem`, `--gap: 2rem`, with text measures of roughly 33–47rem. — [base.css](https://www.inkandswitch.com/static/base.css), [index.css](https://www.inkandswitch.com/index.css)
- Lab feel: the "Lab Notebook" vs "Essay" type labels, a "Lab Meta" section about how the lab runs, and a section named "Production Software" (product awareness inside a research site).
- Borrow: **a typed metadata line per entry** (`2025 · Essay`, `Lab Notebook`, `Production Software`) and **compressed date stamps** (`2026APR`) set in mono. For Applied Realities, labels could be `Paper`, `Prototype`, `Notebook`, and `Shipped`.
- Relevance: light theme, but its information design transfers directly to project panels.

**3. Dynamicland.**
- What it is: Bret Victor's research group building "a humane dynamic medium". — [dynamicland.org](https://dynamicland.org/)
- Layout: the homepage, titled "Dynamicland front shelf", is a photo of a physical shelf, implemented as a clickable image map (CSS `body{background:black}`, `.imagemap a:hover` with a translucent overlay, and a keydown handler that reveals all hotspots). Each item has a title with a year, a media type with length, and a one-liner, e.g. "6-minute intro, 2024 — Video, 6 min" and "The Library, 2019 — Fiction, 2 pages". Top sections are Publications, Archive ("All projects, big and small"), People ("Who did this."), and FAQ. — [dynamicland.org](https://dynamicland.org/)
- Lab feel: the archive *is* the interface. Media type and length are stated plainly, like a library catalogue.
- Borrow: **state media type and length in the metadata** ("Video, 6 min", "PDF, 12 pages"). Also the deadpan section blurbs ("Who did this.") for People/About.
- Relevance: dark ground, catalogue-style listing, and history presented as an object archive.

**4. Folk Computer (Omar Rizwan, Andrés Cuervo et al.).**
- What it is: a physical computing research project. Its site is a plain DokuWiki whose home page starts "hello –". — [folk.computer](https://folk.computer/)
- Layout: wiki header and breadcrumb ("Trace: start"), then link lists for Software, Guides, Long-form notes, People, Discord, and Sponsors. Entries carry month-year stamps, e.g. "Towards a folk computer ('tableshots') (December 2023)" and "Folk Computing: A Computer for the Real World (Causal Islands Berlin, October 2024)". The footer shows "last modified 2026/10/08 by osnr". — [folk.computer](https://folk.computer/)
- Lab feel: no design at all beyond default wiki chrome. Credibility comes from the visible revision history, named people, and supporters (including Ink & Switch and NYU ITP).
- Borrow: **a "last updated YYYY/MM/DD" line in the footer** as a quiet lab-notebook signal.

**5. Thinking Machines Lab.**
- What it is: an AI research and product company (models such as Inkling, the Tinker fine-tuning product, and the "Connectionism" research blog). — [thinkingmachines.ai](https://thinkingmachines.ai/)
- Layout: top nav (Inkling, Tinker, Connectionism, News, Join us), a "NEW" announcement line, and a mission written as four bold-italic lead-in paragraphs ("Science is better when shared", "Solid foundations matter"…). The blog index is a **vertical numbered list** with title / author / date lines, e.g. "On-Policy Distillation / Kevin Lu in collaboration with others at Thinking Machines / Oct 27, 2025". It has no thumbnails or summaries, and a sidebar groups site links under "Models", "Tinker", and "Company". — [thinkingmachines.ai](https://thinkingmachines.ai/), [thinkingmachines.ai/blog](https://thinkingmachines.ai/blog/)
- Palette and type: `--bg: white`, a warm gruvbox-like scale (`--fg1:#3c3836`, `--fg2:#504945`, `--bg1:#ebdbb2`, `--bg2:#d5c4a1`). Fonts are GT America (sans) and Iowan Old Style BT / Georgia (serif). — [thinkingmachines.ai source](https://thinkingmachines.ai/)
- Lab feel plus product feel: research has a named publication ("Connectionism") sitting beside product names in the same nav.
- Borrow: **a numbered, image-free post index** (title, then a muted author line, then a date) for the Blog page, and **a named research series** (e.g. "Applied Realities Notes").

**6. Physical Intelligence (π).**
- What it is: a robotics foundation-model company. physicalintelligence.company now 308-redirects to **pi.website** (domain change). — [pi.website](https://www.pi.website/)
- Layout: minimal top nav (Home, Research, Join Us), a reverse-chronological feed of posts with title, "Month Day, Year", and a 1–2 sentence summary. A single "New" label sits on the latest item, e.g. "π0.7: a Steerable Model with Emergent Capabilities — April 16, 2026" and "π0: Our First Generalist Policy — October 31, 2024". Funders are acknowledged in the footer. — [pi.website](https://www.pi.website/)
- Palette: CSS shows plain #fff/#000 with a gold gradient variable `#E0BC4E` and dark-mode tokens. — [pi.website source](https://www.physicalintelligence.company/)
- Borrow: **the whole homepage is a dated research feed**, with one small "New" label as the only emphasis.
- Note: the WebFetch summary described entries as "clickable cards". Visually they are list items, but I did not screenshot the page to confirm.

**7. Transluce.**
- What it is: a nonprofit research lab "building the public tech stack for scalable oversight of AI" (501(c)(3), SF). — [transluce.org](https://transluce.org/)
- Layout: top nav (About, News, Incident Reports, Behavior Reports, Docent, Join Us). Hero: "Infrastructure for understanding AI". There are three illustrated work cards, then a "Latest News" list whose entries read *type · date · title · summary*, e.g. "Research · September 30, 2026 · AI Agents Targeted U.S. and Canadian Government Websites". — [transluce.org](https://transluce.org/)
- Product plus research: a product (Docent) gets its own blog next to the research reports.
- Borrow: **the "Type · Full date" kicker above each title**. The cards are not worth borrowing.

**8. Goodfire.**
- What it is: an AI interpretability research lab. goodfire.ai now 301-redirects to **goodfire.com**. — [goodfire.com](https://www.goodfire.com/)
- Layout: product-led (customer logo row, "Talk to our team" CTA, three-column "Intentional Design Agenda" with case-study cards: Understand / Debug / Design). The Research list, however, is a clean title / date / **full author list**, e.g. "The World Inside Neural Networks / May 7, 2026 / Atticus Geiger, Ekdeep Singh Lubana, Thomas Fel…". — [goodfire.com](https://www.goodfire.com/)
- Palette hints: the CSS contains muted ochre and steel-blue values (`#de9d50`, `#c58a44`, `#7495ab`, `#5e7d95`). — [goodfire source](https://www.goodfire.ai/)
- Borrow: **the full author list in a muted line under each paper title**, which signals real research. Treat it as a counter-example for chrome (it is card-heavy).

**9. Answer.AI.**
- What it is: "Practical AI R&D", a lab building "practical end-user products from foundational research". — [answer.ai](https://www.answer.ai/)
- Layout: a Quarto-style blog index with tag filters showing counts ("All (48), ai (27), coding (10), research (4)…"). Each entry has a title, an excerpt, tags, a date, and an author, e.g. "Lessons from history's greatest R&D labs — Jan 26, 2024, Eric Gilliam". An "Other Formats → CommonMark" link offers a plain-text version. — [answer.ai](https://www.answer.ai/)
- Borrow: **tag filter with counts as plain text** on the Blog page, and offering a Markdown/plain-text version of each page (a nerdy lab signal, and agent-friendly).

**10. Anthropic Research.**
- What it is: Anthropic's research index. — [anthropic.com/research](https://www.anthropic.com/research)
- Layout: intro sentence, then team entries with post counts (Alignment 49, Economics 25, Engineering 27, Frontier Red Team 35, Interpretability 35, Societal Impacts 24, Science 19). After a featured carousel ("01 / 05" counter) comes "199 ARTICLES" with Filter / Most recent / Gallery view controls, and entries with a team tag, date, thumbnail, title, and summary, e.g. "Alignment · Oct 23, 2026 · An alignment assessment of the UK AISI cybertesting incident". — [anthropic.com/research](https://www.anthropic.com/research)
- Borrow: **research areas listed with post counts** ("Multimodal interfaces (6)") as a plain-text index, and **an all-caps count header** ("199 ARTICLES"). Skip the carousel and thumbnails.

**11. Sakana AI.**
- What it is: a Tokyo frontier AI lab. — [sakana.ai](https://sakana.ai/)
- Layout: now a product and marketing homepage ("Building Frontier AI in Japan", "Try Sakana Chat", mega-menu nav, research shown as a card grid). The useful part is its metadata convention: venue plus year above the title ("ICLR 2026", "NeurIPS 2025 Spotlight"), then a one-sentence summary, e.g. "Trinity — An evolved coordinator that hands each step of a task to the right model." There is an "English | 日本語" text toggle. — [sakana.ai](https://sakana.ai/)
- Status: **redesigned toward product marketing.** Its earlier reputation as a minimal blog-style lab site no longer matches the homepage.
- Borrow: **the venue/status kicker** ("NeurIPS 2025 Spotlight", "Open source").

**12. Nous Research.**
- What it is: an open-source AI training lab (Hermes Agent, Nous Portal). — [nousresearch.com](https://nousresearch.com/)
- Layout: product-led homepage with cards (Terminal/TUI, Desktop/GUI, Portal), a ⌘K command shortcut, and an embedded X announcement feed. Primary nav (Research, Releases, Careers, Blog…) sits in the footer. The CSS uses a "Rules Gothic" condensed display font and a mono font. — [nousresearch.com](https://nousresearch.com/)
- Relevance: low for layout (heavy chrome). The ⌘K palette idea is the only thing to note. **Counter-example.**

### Individual researcher sites that read as one-person labs

**13. Andy Matuschak.**
- Applied researcher ("user interfaces meant to expand what people can think and do"), Patreon-funded since 2019, on "para-academic leave" to help build Pico as of late 2025. — [andymatuschak.org](https://andymatuschak.org/)
- Layout: sections grouped by **type and era** rather than date: "Projects: tools for thought", "Projects: experimental ed-tech", "Working notes", "Letters from the lab", "Research Blog". Entries are a bold title plus a one-line subtitle, e.g. "Orbit — A platform for memory system experiments", with a lock icon for Patreon-only items. — [andymatuschak.org](https://andymatuschak.org/)
- Palette and type: accent `#3b0aff` / `#766afb`, tint `#fff3f1`, "Alegreya Sans SC" (true small caps) for labels, and "Spartan MB" / Avenir / Futura. — [commons css](https://andymatuschak.org/_next/static/css/commons.d658f866.chunk.css)
- Borrow: **"Letters from the lab"** as a section name, and **true small caps (Alegreya Sans SC) for section labels**. Grouping projects by era ("Projects: X") gives a timeline without dates.

**14. thesephist.com (Linus Lee).**
- Researcher on "the future of knowledge representation and creative work aided by machine understanding of language" (currently at Thrive Capital, previously Notion). — [thesephist.com](https://thesephist.com/)
- Layout: single column with a top text nav (posts, projects, stream, rss), the heading "My name is Linus.", and a Speaking list formatted as event, *italic linked title*, then a short date, e.g. "Cursor Compile, *Notational Intelligence* Jun '26". — [thesephist.com](https://thesephist.com/)
- Palette (main.css): light `#f8f8f8`/`#222` with a **dark mode of `--background-default:#222`, `--foreground-default:#f8f8f8`, `--foreground-light:#d8d8d8`**, accent `#11b6a5`, IBM Plex Serif, Menlo mono, `max-width:700px`. — [main.css](https://thesephist.com/css/main.css)
- Borrow: **the compact date format `Jun '26`** for the experience timeline and talks. Also the single teal accent on a near-black ground.

**15. Omar Rizwan (omar.website).**
- Personal site of the Folk Computer co-creator. — [omar.website](https://omar.website/)
- Layout: short bio, then lowercase section heads ("wrote", "talks and podcasts", "projects", "etc"). Projects are thumbnail tiles with a lowercase description and a date range, e.g. "⭐ TabFS — mount your browser tabs as files (2020)" and "Screenotate — take screenshots you can search (Jun 2015–)". The star marks featured work. — [omar.website](https://omar.website/)
- Type: LibreCaslon serif, Helvetica, text `rgb(44,44,44)`, accent `orangered`, background `#eee`. — [style.css](https://omar.website/css/style.css), [home.css](https://omar.website/css/home.css)
- Borrow: **open-ended date ranges ("Jun 2015–")** for ongoing projects, and **a single ⭐ glyph** as the featured marker (the repo already has a `featured` flag).

**16. Maggie Appleton.**
- A designer-researcher digital garden. — [maggieappleton.com](https://maggieappleton.com/)
- Layout: section entries (Essays, Notes, Patterns, Smidgeons, Talks, Podcasts, Library, Antilibrary) shown as large cards, with **relative dates** ("about 1 year ago"). A Now page and a Colophon are linked. The fetched homepage did not show growth-stage labels. Palette tokens include `--color-light-cream` and `--color-crimson`. — [maggieappleton.com](https://maggieappleton.com/)
- Relevance: moderate (card-heavy). Borrow **a Colophon page** (fonts, stack, and where the site is hosted), which is common on lab sites and cheap to make.

**17. Hundred Rabbits (100r.co).**
- Two-person art and technology studio living on a sailboat (Uxn, Orca, Left, and more). — [100r.co](https://100r.co/site/home.html)
- Layout: icon-plus-text top nav (Home, About, Knowledge, Articles, Projects, Travel). The home page is a **monthly log** ("09-2026", "08-2026"… with in-page jump links), with bulleted work updates such as "Uxn, we released a new SDL2 emulator called uxn2…" followed by narrative. Archives go back to 2018. The CSS is mostly black/white with `max-width:700px`. — [100r.co](https://100r.co/site/home.html)
- Borrow: **a monthly lab log as the Blog's default view** (month heading, then 3–5 bullets of what shipped, then optional prose). It is low-effort to maintain and reads as a research notebook.

### Inferences
- Truly minimal, chrome-free sites are almost all *individual* or *tiny-lab* sites (worrydream, Folk, Ink & Switch, Matuschak, thesephist, Omar, 100r). Funded AI labs (Sakana, Nous, Goodfire, Anthropic) have moved toward product marketing chrome, and their minimalism survives only in the research list rows. The research.appliedrealities.ai site should borrow the row grammar from the AI labs and the page grammar from the indie labs.

### Gaps
- Not verified this session (no fetch made, so they are not described): Midjourney research, Figma Research, Notion Labs, Basecase, Every, Sublime, Readwise, and Arcade/agentic-lab sites. Are.na's homepage was downloaded (its CSS uses `--colors-slate` / `gray1–7` tokens), but its layout was not reviewed. These should not be cited without a check.
- linus.zone / thesis.io: the brief named "Linus Lee's thesis.io". I verified thesephist.com instead and did not check thesis.io.
- Colors for Ink & Switch, Sakana, Transluce, and Folk could not be read from WebFetch text. The Ink & Switch and worrydream values come from raw CSS. Others are left unspecified.
- No screenshots were taken, so "list vs card" judgments rest on DOM and text structure, and motion and animation could not be observed. No site showed scripted motion in its HTML except Dynamicland's hover/keydown hotspot reveal.

## How do lab sites present a body of projects or papers in a loose, non-grid way?

### Takeaway
The recurring non-grid patterns are: (a) year-grouped lists with years hanging in the left margin (worrydream); (b) numbered, image-free indices (Thinking Machines, Matuschak); (c) a single reverse-chronological feed with one-line metadata (Physical Intelligence, Transluce, Goodfire); (d) grouping by type or era instead of date (Matuschak, Ink & Switch); and (e) a monthly log (100r).

### Cited Findings
- worrydream: `h3` years absolutely positioned left of a `ul` indented 70px, entries as "Title: descriptor", newest first. — [worrydream.com](https://worrydream.com/)
- Thinking Machines blog: a numbered list of title / author / date with no images. — [thinkingmachines.ai/blog](https://thinkingmachines.ai/blog/)
- Matuschak: numbered lists grouped as "Projects: tools for thought" vs "Projects: experimental ed-tech". — [andymatuschak.org](https://andymatuschak.org/)
- Ink & Switch: sections by role ("Featured Work", "Production Software", "Lab Meta"), each row with a type label. — [inkandswitch.com](https://www.inkandswitch.com/)
- Dynamicland: title plus year, media type plus length, one-liner. Not in strict chronological order. — [dynamicland.org](https://dynamicland.org/)
- 100r: monthly log headings with bullets. — [100r.co](https://100r.co/site/home.html)

### Inferences
- An "uneven two-column" feel comes cheaply from a narrow left gutter of metadata (year, type) beside a wider text column. This is the worrydream move and suits the orb timeline: the orb and line sit in the gutter, and the title, subtitle, and dates sit in the column.

### Gaps
- No verified site used true varying-width tiles in a non-card way. Omar's tiles come closest, but they are image tiles.

## Which use a dark navy, slate, or charcoal palette, and how do they stay readable and un-generic?

### Takeaway
Only worrydream.com, among the verified sites, is genuinely dark navy (`#10183a`). It stays distinctive by tinting the body text light blue (`#ace`) rather than gray, making links pure white and bold, using `#999` for metadata, and reserving yellow for highlights. thesephist's dark mode (`#222` / `#f8f8f8` / `#d8d8d8`, teal accent) and Dynamicland's black field are the other dark references.

### Cited Findings
- worrydream: `background:#10183a; color:#ace;` links `#fff` bold, `h1/h2/li #999`, `.good{color:#ff0}`, Avenir 13px/1.2. — [worrydream.com](https://worrydream.com/)
- thesephist dark tokens: `--background-default:#222; --foreground-default:#f8f8f8; --foreground-light:#d8d8d8; --background-block:#555; --accent:#11b6a5`. — [main.css](https://thesephist.com/css/main.css)
- Dynamicland: `body{background:black}`, header text `#888` in Helvetica 12px. — [dynamicland.org](https://dynamicland.org/)

### Inferences
- A three-tier text system on navy avoids the generic "dark mode" look: hue-tinted body text (blue-gray rather than neutral gray), white for links and names, and a warm desaturated gray for dates and metadata. Add exactly one saturated accent for featured items. Worrydream also shows that small, dense type reads as "lab". For the blog, raise it to about 16–17px and keep the 13–14px density for metadata and the timeline.

### Gaps
- No verified AI lab uses a navy theme. Dark palettes for Nous and Anthropic were not confirmed from CSS.

## Which sites feel research-serious and product-oriented at once, and what design moves produce that?

### Takeaway
The balance comes from putting **named products and named research series in the same nav** (Thinking Machines: Inkling, Tinker, Connectionism; Transluce: Docent next to Incident Reports; Ink & Switch: a "Production Software" section) and from **metadata kickers** (type · date · venue · authors) above or below plain titles.

### Cited Findings
- Thinking Machines nav: Inkling, Tinker, Connectionism, News, Join us. — [thinkingmachines.ai](https://thinkingmachines.ai/)
- Transluce rows: "Research · September 30, 2026 · …", "Essay · …", "News · …", plus a Docent product and blog. — [transluce.org](https://transluce.org/)
- Ink & Switch: "Production Software" and "Lab Meta" sections, "Lab Notebook" and "2019 Essay" labels. — [inkandswitch.com](https://www.inkandswitch.com/)
- Sakana kickers: "ICLR 2026", "NeurIPS 2025 Spotlight", "Open source". — [sakana.ai](https://sakana.ai/)
- Goodfire: full author lists under research titles. — [goodfire.com](https://www.goodfire.com/)
- Answer.AI positions itself as research that leads to "practical end-user products" and offers a CommonMark version of pages. — [answer.ai](https://www.answer.ai/)
- Matuschak: Alegreya Sans SC small caps for labels. — [andymatuschak.org css](https://andymatuschak.org/_next/static/css/commons.d658f866.chunk.css)

### Inferences
- Recommended row grammar for Portfolio and project panels: `SMALL-CAPS TYPE · Mon 'YY` kicker → title (white) → one-line descriptor (body color) → muted line for collaborators, venue, or status (Shipped / Prototype / Paper). Mark featured items with one accent glyph, as Omar's ⭐ or worrydream's yellow do.

### Gaps
- Visible horizontal rules: confirmed on worrydream (section separators). Not confirmed elsewhere without screenshots.

## Which have a persistent left or side text navigation?

### Takeaway
Persistent side navigation is rare among these sites. Thinking Machines' blog has a sidebar grouping links under "Models", "Tinker", and "Company". Folk's DokuWiki has wiki tools and a breadcrumb but no content sidebar. Every other verified site uses a top text nav or no nav. A left text menu would therefore be a distinctive choice rather than a convention, and worrydream's left-gutter year labels are the nearest stylistic precedent.

### Cited Findings
- Thinking Machines blog sidebar with grouped headings. — [thinkingmachines.ai/blog](https://thinkingmachines.ai/blog/)
- Top text navs: thesephist (posts, projects, stream, rss), PI (Home, Research, Join Us), Transluce, Ink & Switch (inline links). — [thesephist.com](https://thesephist.com/), [pi.website](https://www.pi.website/), [transluce.org](https://transluce.org/)
- 100r: icon-plus-text top nav. Monthly jump links act as an in-page index. — [100r.co](https://100r.co/site/home.html)

### Inferences
- For the target, a left text menu combined with Thinking Machines-style grouped headings (e.g. "Lab" → About, Portfolio, Experience; "Writing" → Blog, Notes) will scale when the site becomes research.appliedrealities.ai.

### Gaps
- Whether the Thinking Machines sidebar stays sticky on scroll was not confirmed, because it was inferred from fetched structure and no screenshot was taken.
