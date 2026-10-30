# Minimal personal websites of ML/AI researchers (inspiration for hadsed.com redesign)

Method: On 2026-10-27 each homepage below was fetched with curl. Its HTML and CSS were parsed to pull out fonts, colors, layout rules and section structure. Descriptions come from those fetched files, not from memory. Screenshots were not taken, so visual impressions are inferred from the CSS. Target design for comparison: dark slate-navy background, light gray text, no cards, a plain text menu on the left, an About page with a compact timeline (line plus small orbs), project panels, and Portfolio, Experience and Blog pages.

## Which ML/AI researcher sites are the strongest minimal references, verified live, and what does each look like?

### Takeaway
Two sites match the target almost exactly. karpathy.ai is a single page with a vertical experience timeline: a 2px gray line with small round dots and right-aligned date spans. worrydream.com (Bret Victor) is a text-only page on a deep navy background (#10183a) with light-blue body text and gray section labels in a hanging left column. nonint.com is the best charcoal-dark ML blog. The rest are useful for single patterns: how publication lists are formatted, section labels, and restraint.

### Cited Findings

**1. karpathy.ai (Andrej Karpathy). Live. MOST RELEVANT for the timeline.**
- Single page with no top nav. Sections are introduced by large lowercase labels set in a `.ctitle` class: "bio", "featured talks", "teaching", "featured writing", "pet projects", "publications". Label style is 36px with 40px top margin. — [karpathy.ai](https://karpathy.ai)
- Experience timeline: each `.entry.row` is a grid with a `.timespan` column (14px, right-aligned, color #bbb, e.g. "2024 -", "2023 - 2024", "2017 - 2022"), an `.ico` column with `border-left: 2px solid #cfcfcf`, and a `.desc` column at 17px. An `.entry-dot` sits on the line: a 10px circle, `background #cfcfcf`, `border: 2px solid white`, `left:-8px`. The white border cuts the line around the dot, so it looks like an orb threaded on a string. Seven entries. — [karpathy.ai/style.css](https://karpathy.ai/style.css)
- Typography and color: `font-family: sans-serif`, body text #333, muted text #555/#999/#bbb, white background, one accent #900 (used for the "This list is now very outdated" note). The `<hr>` is a horizontal gradient that fades transparent→black→transparent. There is a `transition: opacity 0.7s` hover reveal, and decorative "hassets" are hidden below 991px. — [karpathy.ai/style.css](https://karpathy.ai/style.css)
- Publications are a plain list. Each `.pub` has a `border-left: 4px solid #aaa`, 14px text, and title / authors / venue on separate lines. "Featured writing" is a bare `<ul class="nodot">` of "Mon YYYY Title" lines. — [karpathy.ai](https://karpathy.ai)
- Personality: the bio opens with a deliberately absurd "Order of the Unicorn" paragraph, followed by emoji in the tagline ("I like to train deep neural nets on large datasets"). — [karpathy.ai](https://karpathy.ai)
- Caveat: talks and projects use image cards (`.card`, `.ccimg`, 22 instances), so the target should not copy that part.
- Borrow: the timeline mechanics directly. On a dark slate background, invert them: line about #3a4560, dot fill the same color, dot border equal to the page background so the line appears cut around each orb, and dates right-aligned in a dim gray column.

**2. worrydream.com (Bret Victor, Dynamicland). Live; 2024 redesign ("/Home2024/" font path). MOST RELEVANT for the dark navy palette.**
- `body { background:#10183a; color:#ace; font: 13px/1.2 "Avenir" }`. Content sits in a centered `.everything` column with `max-width: 564px`. h1 is uppercase #999 at 19px. Links are #fff and bold, with no underline until hover. Visited/special items are #ff0 (".good"). `hr` is a `1px solid #346` hairline in navy-gray. — [worrydream.com](https://worrydream.com)
- Layout: `h3` section labels are `position:absolute` at 30px left with color #999, and the `ul` list is indented 70px. That builds a hanging left label column (year or category) next to a plain list of works, e.g. "2024 / The communal science lab…", "2023 / Improvising cellular playgrounds…". No cards anywhere. — [worrydream.com](https://worrydream.com)
- Restrained interaction: hovering a link shows a `.preview` image pinned full-height on the right (`position:fixed; height:100vh; object-fit:contain`) on a translucent `rgba(0,0,0,0.2)` panel. Two decorative line drawings (`.windmill`, `.rider`) sit outside the column and are hidden below 500px. — [worrydream.com](https://worrydream.com)
- Borrow: the palette almost as-is. Use navy #10183a for the background, pale blue #ace for body text, #999 for labels, white bold for links, and #346 for rules. The hover-to-preview image is a way to give project panels imagery without drawing a card.

**3. nonint.com ("Non_Int — Software & ML"). Live; last post 2026-09-05. RELEVANT for charcoal dark mode.**
- `:root { color-scheme: dark; --background:#1a1b1d; --foreground:#f0efe9; --muted:#b7b5ae; --line:#62625e }`. Body font is "Source Serif 4" (self-hosted), sized with fluid `clamp(16px, calc(14px + 0.2vw), 22px)` at line-height 1.44. — [nonint.com/site.css](https://nonint.com/site.css)
- The header is a single flex row in `ui-monospace` at 0.72rem with letter-spacing 0.08em and a 1px bottom rule. Site name sits left, description ("SOFTWARE & ML") right, in muted color. The home page is a post roll of 46 `.post-preview` items (title, date, summary) with no images or cards. Selection is inverted (cream on charcoal). — [nonint.com](https://nonint.com)
- Borrow: pair a small-caps monospace "lab header" with a serif body on a warm off-black, and use underline offset/thickness tweaks (`text-underline-offset: 0.14em`) as the only link styling.

**4. jonbarron.info (Jon Barron, Google DeepMind). Live. Widely forked academic template.**
- Table-based layout with `max-width:800px`, Lato at 14px, links #1772d0 with an orange hover (#f09228). The bio is followed by a slash-separated link row: "Email / CV / Bio / Scholar / Twitter / Github". — [jonbarron.info](https://jonbarron.info), [stylesheet.css](https://jonbarron.info/stylesheet.css)
- Publications are one row per paper: thumbnail left, then title, authors, venue/year and "project page / arXiv". "Highlighted" papers get a pale-yellow row background `bgcolor="#ffffd0"` (19 rows). 102 `onmouseout` handlers swap a static thumbnail for an animated one on hover, with `transition: opacity .2s ease-in-out`. — [jonbarron.info](https://jonbarron.info)
- Borrow: mark featured items with a background tint on the row instead of a card. On navy, use a slightly lighter slate band. The hover-animate thumbnail suits project panels.

**5. rush-nlp.com (Sasha Rush; Cursor; formerly Cornell/Harvard). Live; recently redesigned.**
- The top text nav reads "Main Blog Group Projects Publications" (`<nav aria-label="Primary navigation">`). Under the name comes a one-line subtitle "ML Researcher. NYC." and a link list "[cv] email github twitter youtube". — [rush-nlp.com](https://rush-nlp.com)
- CSS tokens: `--ink:#222; --muted:#828282; --line:#e8e8e8; --link:#2a7ae2; --content-width:50rem`. Headings are 1.375–1.625rem and the header has a 1px bottom line. — [rush-nlp.com/css/site.css](https://rush-nlp.com/css/site.css)
- Publications are 17 `.paper` blocks: title line, author line, venue + year (e.g. "Composer 2 / Cursor Team. / Arxiv 2026"). No thumbnails. — [rush-nlp.com](https://rush-nlp.com)
- Borrow: the four-token CSS system (ink / muted / line / link) and the three-line paper entry. A dark equivalent would be roughly ink #d6dbe4, muted #8a93a6, line #2b3448, link a cool blue.

**6. lucasb.eyer.be (Lucas Beyer). Live.**
- One-page site with in-page anchor nav: "↑ / Things I've done / Writing / Curriculum Vitae / Contact Me". It ships separate `light.css` and `dark.css` selected by `prefers-color-scheme`. Dark mode uses `--col-bg: #585858` (mid-gray) and `--col-fg: #e8e8e8` with light-blue links (#6bd1fb). The fonts are a quirky mix: DejaVu Sans/Mono, Ostrich, "evelethclean_thin". — [lucasb.eyer.be](https://lucasb.eyer.be), [dark.css](https://lucasb.eyer.be/static/dark.css), [colors.css](https://lucasb.eyer.be/static/colors.css)
- Personality: an on-page Konami-code easter egg (↑↑↓↓←→←→BA renders in the DOM), the line "Lucas Beyer is well known as the greatest person earth has ever seen", and link colors that fade with `transition: color 0.5s ease`. — [lucasb.eyer.be](https://lucasb.eyer.be), [txt.css](https://lucasb.eyer.be/static/txt.css)
- Borrow: one hidden playful interaction (an easter egg) as the only "fun" on an otherwise severe site.

**7. nicholas.carlini.com (Nicholas Carlini, Anthropic). Live.**
- Top bar "Main / Papers / Talks / Code / Writing". The title uses `font-variant: small-caps; letter-spacing: .15em`, the body is Lora at 14pt with line-height 170%, and there is a 60em max width. Body background is #FEFEFE, text #222, and the accent is oxblood (#633 buttons, #A02020 links). — [nicholas.carlini.com](https://nicholas.carlini.com)
- The home page states role, career line and email in obfuscated form ("nicholas [at] carlini [dot] com"): "Previously… Google Brain (2018-2023) and DeepMind (2023-2025)". A right sidebar uses light boxed elements with shadows, so it carries a little UI chrome. — [nicholas.carlini.com](https://nicholas.carlini.com)
- Borrow: a small-caps, letter-spaced name as the only typographic flourish. Career history can be written inline as one prose sentence instead of a separate section.

**8. bastian.rieck.me (Bastian Grossenbacher-Rieck, Univ. of Fribourg / AIDOS Lab). Live. Strong "small lab" feel.**
- Nav "Home / Research / Group / Blog / Talks / About" (`nav#menu` is a flex row and becomes a column on mobile). The body font is 'Equity OT' (a Butterick book serif), with background #F5F5F5, accent cardinal red #C41E3A, muted #808080, max-width 960px, and a blockquote `border-left: 10px solid #E5E5E5`. — [bastian.rieck.me](https://bastian.rieck.me), [style.css](https://bastian.rieck.me/css/style.css)
- Lab feel comes from the Latin motto under the name ("Nec laudibus nec timore"), an ORCID number shown as plain text, a "Group" page, and a bulleted list of research interests. — [bastian.rieck.me](https://bastian.rieck.me)
- Borrow: a motto or subtitle line directly under the name, and ORCID/Scholar shown as plain text identifiers.

**9. jxmo.io (Jack Morris, Cornell PhD). Live.**
- Nav "Home / Research / Code / Blog / Misc". Research is shown as a bracketed-year plain list: "[2025] Proposed the first exact measurement of language model capacity…", "[2024] …". The bio text reads "living in New York City San Francisco", which looks like a struck-out city (markup not inspected). The CSS is a single 1.5KB typography.css with a dark-red link color #9B0000 and KaTeX fonts. — [jxmo.io](https://jxmo.io), [typography.css](https://jxmo.io/css/typography.css)
- Borrow: "[YYYY] one-sentence claim" entries are the densest way to list projects without cards.

**10. evjang.com (Eric Jang, ex-1X). Live; last post Sep 10, 2026.**
- Jekyll-minima-style site. The header reads "Book: AI is Good for You / Projects / About / Talks", followed by a date-then-title post list ("Sep 10, 2026 Smooth Exponentials for Robotics"…). Background #fdfdfd and body text #111. — [evjang.com](https://evjang.com), [main.css](https://evjang.com/assets/main.css)
- Borrow: the reverse-chronological date + title blog index, with no excerpts.

**11. karpathy.github.io (Andrej Karpathy's original blog). Live; newest post "microgpt", Feb 12 2026.**
- Header "Andrej Karpathy blog / About". The index shows date, title and a one-sentence dek. Helvetica/Arial, white background, #333 header band. — [karpathy.github.io](https://karpathy.github.io), [main.css](https://karpathy.github.io/css/main.css)
- Borrow: a single italic-free summary sentence under each blog title.

**12. danluu.com (Dan Luu). Live; posts dated 10/26.**
- No `<title>`, no stylesheet and no inline CSS were found. The home page is a bare list of "MM/YY Title" lines, all in browser-default type. — [danluu.com](https://danluu.com)
- Borrow: the "MM/YY" date column format is compact enough for a sidebar Blog page.

**13. jeremy.fast.ai (Jeremy Howard, fast.ai / Answer.AI). Live.**
- About 7.9KB with no CSS at all. It opens with one paragraph ("If and when I find some time, I'll flesh this personal web site out…") followed by a categorized bulleted list of things created: Answer.AI, ULMFiT, course.fast.ai… — [jeremy.fast.ai](https://jeremy.fast.ai)
- Borrow: a "things I've made" list grouped under plain category headings, as a Portfolio page fallback.

**14. lilianweng.github.io (Lilian Weng, "Lil'Log"). Live; recent post on recursive self-improvement.**
- Hugo PaperMod theme. Top nav "Posts / Archive / Search / Tags / FAQ", a `theme-toggle` button with `localStorage pref-theme` light/dark persistence, and a welcome line "documenting my learning notes in this blog since 2017" above full-width post entries with excerpts. — [lilianweng.github.io](https://lilianweng.github.io)
- Borrow: a remembered theme toggle, if the site offers a light alternative to the navy default.

**15. gwern.net (Gwern Branwen). Live.**
- Nav "Site / Me / New / Blog / Links / Patreon / Substack". It has a JS-driven dark mode (`dark-mode-invert` classes), "reader mode", link annotation popups, sidenotes and collapsible sections. Without JavaScript the page shows a "JavaScript Disabled" warning listing those features. Neutral grays #f6f6f6/#dcdcdc/#333 in the inline CSS. — [gwern.net](https://gwern.net)
- Borrow (lightly): hover popups that preview a linked paper or post. This is the most "research-lab" interaction, but it is heavy to build.

**16. transformer-circuits.pub (Anthropic Interpretability team; a team site, not personal). Live.**
- The homepage is a dated list: month heading ("August 2026", "July 2026") then paper title then a one-sentence summary. Fonts are 'Styrene A' (sans) and 'Tiempos Text' (serif) via CSS vars, with text #333. — [transformer-circuits.pub](https://transformer-circuits.pub)
- Borrow: month-grouped headings for the Blog page. The serif/sans pairing (Tiempos + Styrene) reads as "lab journal".

**17. people.csail.mit.edu/kaiming/ (Kaiming He, MIT / DeepMind). Live.**
- White page, no external CSS. Name with Chinese characters, then a stacked title block ("Associate Professor, EECS, MIT / Distinguished Scientist, Google DeepMind / email"), a prose bio, and a publication list. — [Kaiming He](https://people.csail.mit.edu/kaiming/)
- Borrow: the stacked three-line role block under the name, which serves as a compact "current position" summary above a timeline.

**18. fleuret.org/francois (François Fleuret, Univ. of Geneva). Live.**
- `max-width: 36em`, sans-serif 12pt, `text-align: justify` with `hyphens:auto`. h1/h2 are uppercase and links are pure #0000d0. A pure-CSS collapsible (checkbox hack) is used for expandable sections, and `hr` is only `1em` wide (a short centered dash). — [fleuret.org/francois](https://fleuret.org/francois/), [default.css](https://fleuret.org/francois/default.css)
- Borrow: a 1em-wide `hr` as a section divider (very lab-notebook), and CSS-only expand/collapse for long experience descriptions.

**Also checked, less useful or with caveats:**
- thesephist.com (Linus Lee): nav "posts / projects / stream / rss", IBM Plex Serif. Opens "My name is Linus." then a research statement. — [thesephist.com](https://thesephist.com)
- Eugene Yan (Anthropic MTS): Merriweather + Raleway, nav "Start Here / Writing / Speaking / Prototyping / About", "Hi, I'm Eugene Yan" hero. — [eugeneyan.com](https://eugeneyan.com)
- Hamel Husain: Quarto site with a promotional banner and emoji section labels; too busy for the target. — [hamel.dev](https://hamel.dev)
- Jacob Steinhardt: Minimal Mistakes Jekyll theme (#f2f3f3), nav "Publications / Teaching / Talks / Blog". — [jsteinhardt.stat.berkeley.edu](https://jsteinhardt.stat.berkeley.edu)
- Yang Song (MSL): al-folio Jekyll theme with lowercase nav "about / publications / blog" and a "ctrl k" search. — [yang-song.net](https://yang-song.net)
- Ferenc Huszár inFERENCe: "Title · Month D, YYYY · tags" post index. — [inference.vc](https://www.inference.vc)
- Shreya Shankar: Astro + Inter/Lora, plain mentee list with "→" outcome arrows. — [shreyashankar.com](https://shreyashankar.com)

**Dead, moved or redesigned:**
- chrisolah.com is a "For Sale Domain" page. Chris Olah's live site is colah.github.io (Bootstrap + Computer Modern serif, a categorized list of posts, many marked "On Distill"). — [chrisolah.com](https://chrisolah.com), [colah.github.io](https://colah.github.io)
- Jay Alammar froze his blog. Its top post is "Moving To Substack". — [jalammar.github.io](https://jalammar.github.io)
- kipp.ly now serves a Substack ("kipply's blog | Substack"). — [kipp.ly](https://kipp.ly)
- michaelnielsen.org shows "michaelnielsen.org is almost here!", which suggests a redesign is in progress. — [michaelnielsen.org](https://michaelnielsen.org)
- sholtodouglas.com shows "Coming Soon". — [sholtodouglas.com](https://sholtodouglas.com)
- Neel Nanda and Jason Wei are on Squarespace templates with "Open Menu / Close Menu" chrome, so they are not minimal references. — [neelnanda.io](https://www.neelnanda.io), [jasonwei.net](https://jasonwei.net)
- Patrick Kidger uses a full-bleed background photo. — [kidger.site](https://kidger.site)

### Inferences
- karpathy.ai and worrydream.com together cover nearly the entire target. A redesign that renders Karpathy's timeline (line + white-ringed dots + right-aligned dim dates) in Bret Victor's palette (#10183a / #ace / #999 / #fff links / #346 rules) would match the brief closely.
- "Beautifully minimal" ML sites cluster into three types. First, raw HTML (Dan Luu, Jeremy Howard, Kaiming He). Second, one-file-CSS academic pages (Barron, Rush, Fleuret, jxmo). Third, themed blogs (PaperMod, al-folio, Minimal Mistakes). The first two read as personal. The themed blogs read as generic.

### Gaps
- Sebastian Raschka (sebastianraschka.com) returned HTTP 406 to the scripted fetch (likely bot filtering), so his layout was not verified.
- The nonint.com homepage does not print its author's name in the fetched HTML. It is commonly known as James Betker's blog, but that was not confirmed on-page.
- The transformer-circuits.pub home.css returned S3 AccessDenied to curl, so its colors and sizes were not extracted (fonts came from the inline HTML).
- No screenshots were taken. Visual judgments are inferred from CSS values.

## Which sites use a left-hand text menu, a timeline for experience, or a plain list for publications/projects?

### Takeaway
None of the verified ML sites uses a persistent left sidebar text menu. Almost all put a horizontal text nav at the top. The closest thing to a left column is Bret Victor's hanging section labels. Karpathy.ai is the only verified ML site with a true dot-and-line timeline. Plain publication lists are the norm.

### Cited Findings
- **Left-hand labels or menu:** worrydream.com places `h3` labels absolutely in a left gutter (30px) beside lists indented 70px. This is a left label column, not a nav. — [worrydream.com](https://worrydream.com). bastian.rieck.me's `#menu ul` switches from `flex-direction: row` to `column` on small screens, so it is vertical only on mobile. — [style.css](https://bastian.rieck.me/css/style.css)
- **Top text nav (the majority):** Rush ("Main Blog Group Projects Publications"), Carlini, jxmo, Steinhardt, Eric Jang, Lilian Weng, gwern, thesephist, Eugene Yan. Lucas Beyer uses a top anchor nav on a single page. — sources as cited above.
- **Timeline:** karpathy.ai (`.timespan` + `.ico` border-left + `.entry-dot`). — [karpathy.ai/style.css](https://karpathy.ai/style.css). Inline prose career history instead: Carlini ("Google Brain (2018-2023) and DeepMind (2023-2025)") and Rush ("previously a professor at Cornell and Harvard… worked as an ML researcher at Cursor… and Hugging Face"). — [nicholas.carlini.com](https://nicholas.carlini.com), [rush-nlp.com](https://rush-nlp.com)
- **Plain publication/project list:** Rush (`.paper` title/authors/venue), Karpathy (`.pub` with a 4px left rule), jxmo ("[YYYY] claim"), Jeremy Howard (categorized bullets), Kaiming He, Bret Victor (year + title), transformer-circuits.pub (month + title + summary). — sources as cited above.
- **Thumbnail-row list (still not cards):** Jon Barron (thumbnail + text row, highlighted rows #ffffd0). — [jonbarron.info](https://jonbarron.info)

### Inferences
- A left text menu would be distinctive within this genre because almost no one does it. The closest precedent to cite is Victor's hanging-label gutter. A fixed left nav in the same dim #999 as his labels, with the active page in white, would extend his idea.
- Ways to present history without cards, in order of density: inline prose sentence (Carlini) < "[YYYY] claim" list (jxmo) < dot timeline (Karpathy) < row with thumbnail (Barron).

### Gaps
- Searches for Hacker News or Twitter threads ranking "best minimal researcher websites" returned only generic academic-website guides (e.g. [Elsevier](https://elsevier.com/connect/creating-a-simple-and-effective-academic-personal-website)). No authoritative "most cited" ranking was found, so "most often cited" relies on fame and on how widely the Barron template is forked, not on a measured source.

## What creates a "small research lab" feel, which dark palettes work, and what is each site's one personality move?

### Takeaway
The lab feel comes from four things: serif or small-caps typography, quiet section labels, dense dated lists, and identifiers shown as plain text (ORCID, Scholar, "[at]" email). The verified dark sites that work are Bret Victor's navy (#10183a), nonint's charcoal (#1a1b1d / #f0efe9), and Lucas Beyer's mid-gray dark mode. Each memorable site has exactly one quirk.

### Cited Findings
- Dark palettes:
  - worrydream: #10183a background, #ace text, #999 labels, #fff links, #346 hairlines. — [worrydream.com](https://worrydream.com)
  - nonint: #1a1b1d background, #f0efe9 text, #b7b5ae muted, #62625e lines, `color-scheme: dark`. — [nonint.com/site.css](https://nonint.com/site.css)
  - Lucas Beyer dark mode: #585858 background, #e8e8e8 text, #6bd1fb links. — [dark.css](https://lucasb.eyer.be/static/dark.css)
  - Hinton's page uses navy #2E446E as an accent band, not as the background. — [Hinton](https://www.cs.toronto.edu/~hinton/)
- Lab-feel devices:
  - Motto + ORCID + "Group" page. — [bastian.rieck.me](https://bastian.rieck.me)
  - Small-caps letter-spaced name. — [nicholas.carlini.com](https://nicholas.carlini.com)
  - Monospace micro-header with letter-spacing. — [nonint.com/site.css](https://nonint.com/site.css)
  - Uppercase h1/h2 with a 1em hr. — [fleuret.org](https://fleuret.org/francois/default.css)
  - Lowercase section labels ("bio", "teaching", "publications"). — [karpathy.ai](https://karpathy.ai)
  - Tiempos + Styrene with month-dated entries. — [transformer-circuits.pub](https://transformer-circuits.pub)
- One personality move per site:
  - Karpathy: the Unicorn bio paragraph plus the dotted timeline.
  - Victor: full-height hover image previews plus marginal line drawings.
  - Beyer: Konami-code easter egg.
  - Barron: hover-animated thumbnails and yellow highlight rows.
  - jxmo: corrected-city bio line (likely strikethrough).
  - Fleuret: justified, hyphenated text with a tiny hr.
  - nonint: inverted selection color and a fluid clamp() type size.
  - Carlini: obfuscated email in small-caps.
  - Dan Luu: no CSS at all as a statement.
  - Sources as cited above.

### Inferences
- For the target navy site, the strongest combination is: Victor's palette, a serif body (Source Serif 4 as on nonint, or Tiempos-like), lowercase Karpathy-style section labels in muted gray, and a monospace micro-label for dates and the left menu.
- Pick one quirk only, e.g. a hover preview image on project rows (Victor/Barron) or a hidden easter egg (Beyer). More than one breaks the "lab page" restraint.

### Gaps
- No dark-slate example was found with exactly a fixed left nav plus timeline. That combination appears to be novel within this sample.
- Colors were not contrast-checked. #ace on #10183a looks high-contrast by value, but it was not measured.
