# Minimal designer / design-engineer personal sites (inspiration for hadsed.com redesign)

Method note: every site below was fetched directly on 2026-10-27 (raw HTML + linked CSS via curl, plus live screenshots in a browser at desktop and 375px mobile width for the key ones). Colors/fonts quoted as rgb/hex values come from computed styles or the site's own CSS. "Observed" animation claims come from CSS keyframes/classes found in the source or seen in screenshots; I could not record motion video, so durations are only given where read from CSS.

Target design for reference: dark slate-navy background, light gray text, no cards/chrome, plain left text menu, About landing page with compact experience timeline (name, subtitle, dates, line with small orbs), project panels below, plus Portfolio / Experience / Blog pages.

## Which designer and design-engineer personal sites are most admired for minimalism with personality, and what does each actually look like?

### Takeaway
The closest single match to the target is Brittany Chiang's site (slate-900 navy, slate-400 gray text, sticky left column with a three-item text nav, dated experience list, cursor spotlight). For the "melt away" text-first feel, the strongest references are Shu Ding (left italic-serif text menu + vertical rule + dated list), Frank Chimero (dark gray-green, Courier 14px, two-column index), Paco Coursey (staggered fade-in, three-column Building/Projects/Writing index), Linus Lee/thesephist (dated "workline" lists), and Emil Kowalski (labelled sections, tiny type, generous vertical space). Several names in the brief could not be verified (see Gaps).

### Cited Findings

**1. Brittany Chiang — https://brittanychiang.com (Frontend Engineer, Klaviyo) — LIVE, most directly relevant**
- Layout: two columns on desktop. Left column is `lg:sticky lg:top-0` and holds name (large bold), "Frontend Engineer" subtitle, one-line tagline, then a text nav "About / Experience / Projects", and social icons pinned to the bottom. Right column scrolls: About paragraphs, then Experience, then Projects. — [brittanychiang.com](https://brittanychiang.com) (HTML classes `lg:sticky`, `lg:top-0`; nav text extracted via JS: `["About","Experience","Projects"]`)
- Experience is a dated list: small uppercase date range in the left gutter of the right column ("2024 — PRESENT", "2018 — 2024", "JULY — DEC 2017", "2016 — 2017"), then role · company with a ↗ arrow, past titles stacked in dimmer text beneath (e.g. "Lead Engineer · Upstatement / Senior Engineer / Engineer"), a description, and teal pill tags for technologies. — [brittanychiang.com](https://brittanychiang.com)
- Palette: computed body background `rgb(15, 23, 42)` (Tailwind slate-900), body text `rgb(148, 163, 184)` (slate-400), headings/hover `slate-200` (rgb 226 232 240), accent teal-300 (rgb 94 234 212) used for tag text on a teal/10 background. Font: Inter. — [brittanychiang.com](https://brittanychiang.com) (computed styles + CSS)
- Interactions observed in source: (a) a full-page cursor "spotlight" — a fixed div whose background is `radial-gradient(600px at <mouse x,y>, rgba(29, 78, 216, 0.15), transparent 80%)`, i.e. a very faint blue glow follows the pointer; (b) nav items have a `nav-indicator` rule: a 1px line `w-8 bg-slate-600` that grows to `w-16` and brightens to `slate-200` on hover/focus/active section (`transition-all … motion-reduce:transition-none`); (c) experience rows use `group-hover:bg-slate-800/50` with drop-shadow and `group-hover:text-slate-200` so the whole row lifts on hover; (d) arrows nudge with `group-hover:translate-x-*`; (e) a page-load fade-in (first screenshot captured text at low opacity; CSS defines `fadeIn`/`fadeOut`/`wobble` keyframes). — [brittanychiang.com](https://brittanychiang.com)
- Mobile (375px): sticky column collapses into a normal top block; the text nav disappears entirely and section headings ("ABOUT", "EXPERIENCE") become small uppercase labels inline in the flow; social icons move up under the tagline. — [brittanychiang.com](https://brittanychiang.com) (mobile screenshot)
- Relevance: nearly identical palette and structure to the target (navy, gray text, left text menu, dated experience list). Risk: this exact template is heavily copied (it has a public repo), so it reads as "the Brittany Chiang template" if cloned wholesale; the pill tags and row hover cards are the "modern chrome" the target wants to avoid.
- Borrow: the `nav-indicator` — a 1px horizontal rule before each menu item that lengthens on hover/active. It is the most restrained possible "active state" and fits a plain text menu.

**2. Shu Ding — https://shud.in (Vercel) — LIVE**
- Layout: desktop has a narrow left text menu "about / thoughts / projects / guestbook", right-aligned, in a serif (computed: `serifCore … Baskerville, Georgia`), with the active item darker and the rest gray; a thin vertical rule separates the menu from the content column. Content is in a sans (`sansCore, system-ui…`) at 16px, color `rgb(74, 81, 91)` on `rgb(252, 252, 252)`. — [shud.in](https://shud.in) (computed styles + screenshot)
- The Thoughts page is a pure dated list: title on the left, date like `2026.10.22` right-aligned in light gray, connected by a faint dotted leader line; older items separated by a gap. — [shud.in/thoughts](https://shud.in/thoughts)
- Animation: CSS includes `view-transition` rules and `appear`/`hide` keyframes, and respects `prefers-reduced-motion`. — [shud.in](https://shud.in) (CSS)
- Mobile: the left menu flips to a horizontal row of italic serif links, right-aligned at the top, with a horizontal rule under it (the vertical rule becomes horizontal). — [shud.in](https://shud.in) (375px screenshot)
- Relevance: the best example of a persistent left text menu that is genuinely plain (no icons, no boxes) and of an early-web dated index. Light palette, but the structure maps directly to the target.
- Borrow: menu in a different typeface (serif italic) from body (sans) — the type contrast alone marks it as navigation, no chrome needed; plus the vertical-rule-becomes-horizontal-rule mobile pattern.

**3. Frank Chimero — https://frankchimero.com — LIVE**
- Layout: two columns of tiny text. Left: "Frank Chimero / New York-based designer". Right: an index of items each as a two-line pair — title in light text, a dimmer descriptor line ("Studio Frank ↗ / My design practice", "The Shape of Design ↗ / Book · 2012", "Dust / Collages · 2017–2020", "About / Profile & Contact", "Post Archive / 2009–2025"). Nothing else on the page. — [frankchimero.com](https://frankchimero.com)
- Palette/type: computed background `rgb(61, 67, 64)` (dark warm gray-green), text `rgb(238, 238, 238)`, dim lines via `--color-light-text-dim`; font `Courier, mono` at 14px / 21px line-height. No keyframes in CSS; uses `position: sticky`. — [frankchimero.com](https://frankchimero.com) (computed styles + CSS)
- Mobile: columns stack into a single list; same pairs. — [frankchimero.com](https://frankchimero.com) (375px screenshot)
- Relevance: proof that a dark, non-black, slightly tinted background plus a monospace and two text weights (bright/dim) is enough personality. Directly relevant to "dark slate with gray text" without looking like a dark-mode template.
- Borrow: the title + dim-descriptor pair with a middot date ("Book · 2012", "Collages · 2017–2020") as the format for project and experience entries.

**4. Paco Coursey — https://paco.me (Webmaster at Linear; ex-Vercel) — LIVE**
- Layout: single narrow left-aligned column. Name, an italic lead ("Crafting interfaces."), short bio, then a three-column index with small gray labels "Building / Projects / Writing", each entry a title (some with ↗) plus a one-line gray description; then a "Now" section of prose. — [paco.me](https://paco.me) (screenshot + text)
- Type: Inter, Newsreader (serif, for italic accents), and Söhne subsets loaded; colors via a `--mono1…12` gray scale. — [paco.me](https://paco.me) (CSS)
- Animation: elements carry `data-animate` with inline `style="--stagger:N"`; CSS: `[data-animate]{animation:.6s both enter; animation-delay: calc(var(--stagger) * .12s + var(--start))}` and `@keyframes enter{0%{opacity:0; transform:translateY(10px)} to{opacity:1; transform:none}}`, with a reduced-motion override setting `animation:none`. — [paco.me](https://paco.me) (CSS)
- Relevance: the canonical restrained "staggered fade-up on load" — runs once, 10px, 0.6s, 120ms steps — then gets out of the way.
- Borrow: the exact stagger recipe above for the About page timeline rows (CSS-only, one custom property per row).

**5. Emil Kowalski — https://emilkowal.ski (Design Engineer; ex-Linear, Vercel) — LIVE**
- Layout: one narrow column, very small text, lots of vertical whitespace. Sections each start with a small label: "Today", "Projects", "Writing"; entries are title + one gray line (e.g. "Sonner — An opinionated toast component for React"). A dismissable top banner advertises his course. — [emilkowal.ski](https://emilkowal.ski) (screenshot + text)
- Palette: light by default with dark theme support (`data-theme`, near-black rgb 11 11 9 / 13 13 13 backgrounds in CSS); gray scale `--color-gray-900…1200`. — [emilkowal.ski](https://emilkowal.ski) (CSS)
- Animation: CSS limited to popover enter/exit and a `transformAnimation`; reduced-motion respected. His own latest essay is titled "You Don't Need Animations — Why you are animating more often than you should." — [emilkowal.ski](https://emilkowal.ski)
- Relevance: the design-engineer most associated with animation keeps his own home page almost motionless — a useful argument for "melt away".
- Borrow: section labels as the only hierarchy device (no headings, no rules, no boxes).

**6. Linus Lee (thesephist) — https://thesephist.com — LIVE** (note: linus.zone is a personal utility/notes service, not his portfolio — [linus.zone](https://linus.zone))
- Layout: top text nav "thesephist.com posts projects stream rss", a single prose column ("My name is Linus." then paragraphs dense with underlined links), newsletter form, then dated lists. — [thesephist.com](https://thesephist.com)
- Experience/speaking presented as `workline` rows: "Cursor Compile, Notational Intelligence — Jun '26", "AI Council, Context engineering at the frontier — May '26", "Dialectic, Engineering for aliveness — Aug '25"; posts list uses a `dateprefix` span. — [thesephist.com](https://thesephist.com) (HTML classes `workline`, `dateprefix`)
- Type: IBM Plex Serif from Google Fonts; no keyframes. — [thesephist.com](https://thesephist.com)
- Relevance: text-first, link-dense, with compact "Venue, Title — Mon 'YY" rows — a good format for the Experience page.
- Borrow: the abbreviated date style ("Jun '26") right-aligned in a dimmer tone.

**7. Rauno Freiberg — https://rauno.me (interaction designer, Vercel / Devouring Details) — LIVE, highly interactive**
- On load the page shows a gray canvas with a ruler/ticks UI at the top and a white card with a crosshair; after ~4s it reveals large type "Rauno Freiberg is an Estonian interaction designer working with Vercel and Devouring Details" over a big yellow circle. Links: Craft, History of Software Design, Projects, Field Notes, Twitter, GitHub, Email ("Copied" toast). Ends with a manifesto stack: "Make it fast. / Make it beautiful. / … / Make it." — [rauno.me](https://rauno.me) (screenshots + text)
- Type: Georgia/serif + JetBrains Mono; gray12/gray11 tokens; keyframes `fade`, `animate`. — [rauno.me](https://rauno.me)
- Relevance: low for structure (it's a playful canvas, not text-first), but the "click email → 'Copied'" micro-interaction and the manifesto list are borrowable.
- Borrow: click-to-copy email with a one-word inline confirmation instead of a mailto.

**8. Jenny Wen — https://jennywen.ca (design lead for Claude/Cowork at Anthropic; ex-Director of Design, Figma) — LIVE**
- Layout: large expressive display name top-left, prose bio, then a reverse-chronological feed: small colored month label ("March 2026"), bold title + em dash + one-paragraph description, and a large image. Top-right is a plain right-aligned text menu "Work / Notes" and below it a vertical stack of text social links (Instagram, Twitter, LinkedIn, Substack, Bluesky). — [jennywen.ca](https://jennywen.ca) (screenshot + text)
- Type: neue-haas-grotesk-text; Tailwind gray scale. — [jennywen.ca](https://jennywen.ca)
- Relevance: experience-as-dated-feed ("March 2026 — Dispatch —", "January 2026 — Claude Cowork —", "March 2025 — Claude.ai visual refresh —") is a warmer alternative to a résumé table.
- Borrow: month-year label above each entry and the "Title — one sentence" pattern.

**9. Lee Robinson — https://leerob.com — LIVE (he now lists SpaceX ML; formerly Cursor, Vercel)**
- Layout: centered narrow column, "@leerob" header, a "Bio" row with a "Default / Long" toggle that switches bio length, two-column bulleted "Notes" list, then "Blogs" as a ruled list with month-year dates right-aligned ("July 2026", "December 2025"…). — [leerob.com](https://leerob.com) (screenshot + text)
- Type: "Iowan Old Style" reading font + UI sans + Caveat (handwriting accent); CSS has `painting-drift`/`painting-gust` keyframes for a decorative aside ("home-visual"). — [leerob.com](https://leerob.com) (CSS)
- Borrow: the Default/Long bio toggle — a single, content-serving interaction.

**10. Jhey Tompkins — https://jhey.dev (Brand Design Studio @ Shopify; ex-Google, Vercel) — LIVE**
- Layout: light grid-paper background, a lamp dangling on a cord from the top, big black name, mono uppercase subtitle "DESIGNER · ENGINEER · TASTEMAKER", short bio with squiggly-underlined links, a mono text row "INDEX · EMAIL · AMA · FOLLOW", signature scribble, "LATEST" list with ↳ glyphs, and a live status strip (weather, time, now-playing). — [jhey.dev](https://jhey.dev) (screenshot + text)
- Animation: Astro view transitions (`astroFadeIn`, `astroSlideFromLeft`…), plus custom `draw`, `blink`, `gem-spin` etc.; reduced-motion respected. — [jhey.dev](https://jhey.dev) (CSS)
- Relevance: more playful than the target, but shows mono-uppercase micro-labels and view transitions on a mostly-text page.
- Borrow: the ↳ glyph for list items and a mono small-caps subtitle line under the name.

**11. Benji Taylor — https://benji.org (Head of Design for X/SpaceXSI; maker of cmdk contributions, Agentation, Liveline) — LIVE**
- Layout: single column bio ("Updated Aug 22, 2026" stamp at top), then "Writing" as title + date rows in `DD/MM / YYYY` format. Type: Inter + Newsreader + a custom "lfeSans"; text in `rgba(0,0,0,.4)` and `#111`. Keyframes include `staggerIn` and whimsical ones (`awakeLeftEarTwitch`, `zFloat1-3` — a sleeping-creature easter egg). — [benji.org](https://benji.org)
- Borrow: an "Updated <date>" line at the top of the About page — honest, early-web, zero chrome.

**12. Jakub Krehel — https://jakub.kr (founding design engineer, Interfere) — LIVE**
- Single column; bio with inline links, "Projects" list (interfaces.dev, loading.dev, /skills). Type: Berkeley Mono + Open Runde; dark mode support (`#101010`/`#111`). Keyframes `viewfinder-focus`, `viewfinder-scan`, `pulse`. — [jakub.kr](https://jakub.kr)

**13. Derek Sivers — https://sive.rs — LIVE (early-web reference, not a designer)**
- "me in 10 seconds" section is a dated life timeline written as prose rows: "(1984-1997): Musician…", "(1998-2008): Entrepreneur…", "(2009-2025): Author, speaker…", "(2026+): ?". Tiny CSS (~2.4KB), Georgia serif, `prefers-color-scheme` dark mode. — [sive.rs](https://sive.rs)
- Borrow: the open-ended final row "(2026+): ?" — personality in one line of the timeline.

**14. Mariana Silva — https://mariana.design (Staff Product Designer, SoFi) — LIVE** (NB: this is not "Mariana Castilho"; see Gaps)
- A one-page résumé: "Work Experience" with left date column ("2024 — Now", "2016 — 2023", "2014 — 2016") and role at company + city + a sentence; "Education"; "Contact". Inter + Roboto Mono (Framer-built). — [mariana.design](https://mariana.design)
- Borrow: "— Now" instead of "Present".

**15. Anthony Hobday — https://anthonyhobday.com (product designer) — LIVE**
- Plain text index where each blog post shows its length ("Notes on visual design — 2,346 words", "Popular terms with no clear definition — 32 words"), with "[Show 17 more]" disclosure. Monospace stack, 3.3KB CSS, light/dark via `prefers-color-scheme`. — [anthonyhobday.com](https://anthonyhobday.com)
- Borrow: metadata as personality (word counts instead of dates/thumbnails) for the Blog page.

**16. Niki Tonsky — https://tonsky.me — LIVE**
- Text nav "Blog Work Talks Logos About", year headers ("2026", "2025") with posts as title + `M/D` date. IBM Plex Sans/Mono. Seasonal easter egg (`snow-fall` keyframes); the fake "Sign In / Personal Information / User Agreement" links are a joke on web chrome. — [tonsky.me](https://tonsky.me)
- Borrow: year-group headers with short dates beneath — compact Blog archive.

**17. Adam Morse (mrmrs) — https://mrmrs.cc — LIVE**
- Opens with an ASCII cat and an Apple ][ boot sequence ("APPLE ][ READY… BOOTING SKULLCAT"), then plain lists: Projects, Writing with uppercase dates ("MAR 24, 2025"). Monospace, green phosphor accents (`#78ff87`). Keyframes `apple-ii-boot-cursor/flicker/scan`; reduced-motion respected. — [mrmrs.cc](https://mrmrs.cc)
- Relevance: one nostalgic gimmick in an otherwise plain list site — an example of "one interaction" personality, though louder than the target wants.

**Others checked (less relevant to the target, recorded for completeness)**
- Brian Lovin — https://brianlovin.com — LIVE: "software designer… making AI products at Notion"; app-like sidebar of sections (Writing, Projects like HN reader, App Dissection, Stack, AMA, TIL, Listening, Sites). Source Serif 4 + Inter. Too app-like for the target, but his `/sites` page is a curated list of ~128 personal sites (Paco, Rauno, Shu Ding, Ryo Lu, Jakub Krehel, Tobias Ahlin, Rasmus Andersson, etc.). — [brianlovin.com](https://brianlovin.com); [brianlovin.com/sites](https://brianlovin.com/sites)
- Josh W. Comeau — https://www.joshwcomeau.com — LIVE: tutorial/blog magazine layout, whimsical; not minimal. — [joshwcomeau.com](https://www.joshwcomeau.com)
- Adam Argyle — https://nerdy.dev — LIVE: a "Nerdy Notebook" feed with filters by type/topic/year (482 posts); dense, CSS-showcase. — [nerdy.dev](https://nerdy.dev)
- Guillermo Rauch — https://rauchg.com — LIVE: posts grouped by year, each with a view count ("Pure UI — 709,054"); Geist + Geist Mono, no keyframes. — [rauchg.com](https://rauchg.com)
- Nicolas Ménard — https://www.nicolasmenard.com — LIVE: animator/illustrator; nav "Selected / Projects / About", AT Surt typeface, image-led project list. Not text-first. — [nicolasmenard.com](https://www.nicolasmenard.com)
- Josh Puckett — https://joshpuckett.me — LIVE: bio in Cormorant Garamond/Martina Plantijn; view transitions; `xray-flicker` effect. — [joshpuckett.me](https://joshpuckett.me)
- Pedro Duarte — https://ped.ro — LIVE: "Home Writing Speaking Shooting" text nav; Radix Themes. — [ped.ro](https://ped.ro)
- Lynn Fisher — https://lynnandtonic.com — LIVE: annual full redesigns ("v. XIX"); Sydonia Atramentiqua serif. — [lynnandtonic.com](https://lynnandtonic.com)
- Henry Heffernan — https://henryheffernan.com — LIVE, title still "Henry Heffernan - Portfolio 2022"; HTML is a JS shell (OCR-A mono, `blink`/`jittery` keyframes). Not text-first. — [henryheffernan.com](https://henryheffernan.com)
- Ryo Lu — https://ryo.lu — LIVE but a client-rendered JS app (no text in HTML); content could not be verified by fetch. — [ryo.lu](https://ryo.lu)
- Craig Mod — https://craigmod.com — LIVE: writer/photographer, newsletter-led; not minimal. — [craigmod.com](https://craigmod.com)

### Inferences
- The top-tier "design engineer" sites (Paco, Emil, Shu, Jakub, Benji) converge on the same formula: one narrow column or a narrow left menu, 14–16px text, two gray tones (primary/secondary), section labels instead of headings, title + one-line description entries, and at most one motion idea. Personality comes from a single typographic decision (serif italic nav, monospace everything, expressive display name) rather than from layout.
- For the target, a strong blend is: Brittany Chiang's palette and sticky-left-column structure, minus her cards/pills/spotlight; Shu Ding's typographic nav and mobile behavior; Frank Chimero's bright/dim two-line entries; Paco's stagger.

### Gaps
- "Mariana Castilho": marianacastilho.com did not resolve and a web search found no designer by that name ([search results incl. behance.net/MarianaDCG](https://www.behance.net/MarianaDCG)); mariana.design belongs to Mariana Silva. Likely a misremembered name.
- "Alec Lownes": no site found by search ([search](https://www.fontsinuse.com/uses/63804/alec-tear-website) returned only other Alecs); alec.is belongs to Alec Armbruster ([alec.is](https://alec.is)), a tech lead with a plain bio + dated "thoughts" list — usable as a text-first reference but not the requested person.
- Ryo Lu and Henry Heffernan sites are JS-rendered; I did not screenshot them, so layout claims are omitted.
- Exact animation durations are only known where read from CSS (Paco). Brittany's spotlight/nav timings use Tailwind defaults (`transition-all`, typically 150ms) — inferred, not measured.

## Which use dark or navy palettes with gray text, and how do they avoid looking like a generic dark-mode template?

### Takeaway
Only Brittany Chiang (slate-900 navy, slate-400 text) and Frank Chimero (dark gray-green #3D4340, #EEE text, Courier) are dark by default among the verified sites; most others are light-first with an optional dark theme. Both avoid the template look by tinting the background (not #000/#111), using exactly two text brightnesses, and adding one signature (Brittany: faint blue cursor glow; Frank: monospace at 14px).

### Cited Findings
- Brittany Chiang: background `rgb(15,23,42)`, text `rgb(148,163,184)`, highlights `rgb(226,232,240)`, accent teal `rgb(94,234,212)`; a 600px radial gradient of `rgba(29,78,216,0.15)` follows the cursor, giving the navy subtle depth. — [brittanychiang.com](https://brittanychiang.com)
- Frank Chimero: background `rgb(61,67,64)`, text `rgb(238,238,238)` with a dim variable for secondary lines, `Courier, mono` 14px/21px. — [frankchimero.com](https://frankchimero.com)
- Emil Kowalski and Jakub Krehel offer dark themes with near-black warm/neutral backgrounds (Emil: rgb 11 11 9 / 13 13 13; Jakub: #101010 / #111) via `data-theme`. — [emilkowal.ski](https://emilkowal.ski); [jakub.kr](https://jakub.kr)
- mrmrs uses a very dark warm brown `#15120f` with phosphor-green accents for its retro boot sequence. — [mrmrs.cc](https://mrmrs.cc)
- Light-first sites with `prefers-color-scheme` dark variants: sive.rs, anthonyhobday.com, lynnandtonic.com, paco.me, rauchg.com. — [sive.rs](https://sive.rs); [anthonyhobday.com](https://anthonyhobday.com); [paco.me](https://paco.me)

### Inferences
- What reads as "generic dark template" is pure black or #121212 plus white text plus a saturated accent on buttons/cards. The sites that avoid it (a) tint the ground (navy, green-gray, warm brown), (b) keep the brightest text off pure white (#EEE, slate-200), (c) use the accent sparingly or not at all, (d) remove containers so the background is one uninterrupted field.
- For the target, slate-900-ish navy with slate-400 body and slate-200 for names/titles (Brittany's exact ramp) is proven, but should be paired with a non-Inter typeface or a mono/serif for the menu to avoid being read as her template.

### Gaps
- No verified designer site found that uses a navy palette *without* also being Brittany-derived; dark.design / godly / minimal.gallery were not fetched (tool budget), so a gallery sweep for other navy sites remains undone.

## What subtle animations do the best ones use, and which suit a site meant to "melt away"?

### Takeaway
The restrained set is: one-time staggered fade-up on load (Paco), a lengthening 1px line on nav hover/active (Brittany), view transitions between pages (Shu Ding, Jhey), color-only hover on text, and click-to-copy feedback (Rauno). Cursor glows, boot sequences, dangling lamps and canvases are personality pieces that do not melt away.

### Cited Findings
- Paco: `opacity 0→1, translateY(10px)→0`, 0.6s, delay `stagger × 0.12s`, disabled under reduced motion. — [paco.me](https://paco.me)
- Brittany: nav-indicator line `w-8 → w-16`, `bg-slate-600 → slate-200`, `motion-reduce:transition-none`; row hover background `slate-800/50`; cursor radial glow. — [brittanychiang.com](https://brittanychiang.com)
- Shu Ding: `view-transition` CSS + `appear`/`hide` keyframes; reduced-motion handled. — [shud.in](https://shud.in)
- Jhey: Astro view transitions (fade/slide) plus decorative `draw`, `blink` keyframes. — [jhey.dev](https://jhey.dev)
- Rauno: "Copied" confirmation on email click; intro canvas reveal. — [rauno.me](https://rauno.me)
- Emil Kowalski's essay "You Don't Need Animations — Why you are animating more often than you should" is featured on his home page. — [emilkowal.ski](https://emilkowal.ski)
- Frank Chimero, Linus Lee, sive.rs, Anthony Hobday, Guillermo Rauch: no keyframes at all in their CSS. — [frankchimero.com](https://frankchimero.com); [thesephist.com](https://thesephist.com); [rauchg.com](https://rauchg.com)

### Inferences
- For the target's timeline "line with small orbs", the Paco stagger applied per row, plus a CSS `scaleY` draw of the connecting line (0→1 once, ~600ms), is consistent with the restrained set. Orbs could brighten on row hover (color only).
- Cross-page view transitions (Shu Ding) suit a multi-page Eleventy site (Portfolio/Experience/Blog) and are CSS-only via `@view-transition { navigation: auto; }`.

### Gaps
- Could not record motion, so subjective "feel" of durations is not verified beyond the CSS values.

## How do they handle a left-side text menu on narrow screens?

### Takeaway
Two verified patterns: Shu Ding converts the vertical left menu into a horizontal row of the same text links at the top (rule rotates from vertical to horizontal); Brittany Chiang drops the menu entirely on mobile and lets inline section labels do the job. Frank Chimero simply stacks columns. None use a hamburger.

### Cited Findings
- Shu Ding at 375px: "about thoughts projects guestbook" in italic serif in one right-aligned row, followed by a horizontal hairline, then content. — [shud.in](https://shud.in) (screenshot; nav classes `mobile:mr-6 sm:mr-10 md:mr-14 w-full mobile:w-16`)
- Brittany Chiang at 375px: no nav; name/subtitle/tagline/social icons on top, then "ABOUT" uppercase label and content. — [brittanychiang.com](https://brittanychiang.com)
- Frank Chimero at 375px: name block then the index list in one column. — [frankchimero.com](https://frankchimero.com)
- Jenny Wen keeps a short right-aligned text menu ("Work / Notes") at the top corner. — [jennywen.ca](https://jennywen.ca)

### Inferences
- With only four pages (About/Portfolio/Experience/Blog), Shu Ding's pattern (same links, horizontal, top) is the right fit; no hamburger needed.

### Gaps
- Did not test tablet widths (768px) for when the switch happens.

## What early-2000s structural ideas have been revived tastefully, and by whom?

### Takeaway
Plain text sidebars (Shu Ding), dense small monospace type (Frank Chimero, Anthony Hobday), visible rules and dotted leaders (Shu Ding), year-grouped dated archives (tonsky, rauchg, Shu Ding, Dan Luu-style MM/YY lists), "Updated <date>" stamps (Benji Taylor), prose timelines (Derek Sivers), and retro computer gimmicks (mrmrs Apple ][ boot).

### Cited Findings
- Shu Ding: left serif text nav + vertical rule; Thoughts list with dotted leaders to `YYYY.MM.DD` dates. — [shud.in/thoughts](https://shud.in/thoughts)
- Frank Chimero: 14px Courier, two text brightnesses, no images. — [frankchimero.com](https://frankchimero.com)
- Anthony Hobday: monospace, word counts per post, "[Show 17 more]". — [anthonyhobday.com](https://anthonyhobday.com)
- Derek Sivers: "(1984-1997): Musician… (2026+): ?" timeline, 2.4KB CSS, "(Everything here is 100% me, no AI.)" note. — [sive.rs](https://sive.rs)
- Benji Taylor: "Updated Aug 22, 2026" at top of page. — [benji.org](https://benji.org)
- Guillermo Rauch: year headers with per-post view counts. — [rauchg.com](https://rauchg.com)
- Niki Tonsky: year headers with M/D dates; joke "Sign In / User Agreement" links. — [tonsky.me](https://tonsky.me)
- Adam Morse: ASCII cat + Apple ][ boot sequence before plain lists. — [mrmrs.cc](https://mrmrs.cc)

### Inferences
- The tasteful revivals keep the *structure* of early-web sites (sidebar, dated lists, rules, small type) but use modern type rendering, careful gray ramps, and reduced-motion-aware CSS. The target's "visible line with orbs" timeline is in the same spirit as Shu Ding's dotted leaders.

### Gaps
- Galleries (minimal.gallery, siteinspire, personalsit.es, brutalistwebsites) were not crawled; a generic web search for 2026 minimal-portfolio roundups returned mostly low-quality site-builder marketing pages ([mycodelesswebsite.com](https://mycodelesswebsite.com/minimalist-websites/), [designrush.com](https://www.designrush.com/best-designs/websites/personal)), so I relied on Brian Lovin's curated `/sites` list as the "admired by peers" signal instead.
