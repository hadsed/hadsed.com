# Winpaper Design Document

Winston's Paper Reader — a beautiful mobile-first reader for Deep Research reports.

---

## Visual Design

### Vibe

**Primary inspiration:** [gwern.net](https://gwern.net) — scholarly, typographically rich, information-dense yet calm. Sidenotes, careful hierarchy, metadata-forward.

**Secondary inspirations:**
- **Instapaper** — minimal chrome, pure reading focus, progress indicators
- **70s/80s neon/cyberpunk** — Darcula/Dracula, synthwave accents, CRT nostalgia

**Overall direction:** Scholarly elegance as the default, with theme options that range from warm low-contrast (Solarized) to full neon cyberpunk (Synthwave/Dracula).

---

### Typography

#### ✅ Final Font Choices
- **Headings/Titles:** Source Serif 4 — https://fonts.google.com/specimen/Source+Serif+4
- **Body:** Spectral — https://fonts.google.com/specimen/Spectral
- **Mono/Terminal:** Space Mono — https://fonts.google.com/specimen/Space+Mono

#### Serif Shortlist (for reference)
1. Faustina — https://fonts.google.com/specimen/Faustina
2. Source Serif 4 — https://fonts.google.com/specimen/Source+Serif+4
3. Literata — https://fonts.google.com/specimen/Literata
4. Newsreader — https://fonts.google.com/specimen/Newsreader
5. Spectral — https://fonts.google.com/specimen/Spectral

Other cool fonts:
- Avenir
- Menlo

---

#### Body Text (Serif — Primary)

**Source Serif 4** (Adobe, open-source)
- Used by gwern.net
- True small caps support
- Excellent legibility at long-form reading sizes
- Available via Google Fonts / Fontsource
- Weights: 200-900, plus italics
- https://fonts.google.com/specimen/Source+Serif+4

**Alternatives to consider:**
- **Lyon Text** — used by Instapaper, warmer/friendlier but not free

- **Spectral** — Google Font, slightly more contemporary

#### Headings

**Source Serif 4** (semibold/bold) for consistency, or:
- **Source Sans 3** for a cleaner heading contrast

#### Monospace (Code, Metadata)

**JetBrains Mono** or **Fira Code**
- For YAML frontmatter display, code blocks, terminal-style metadata
- Ligatures optional

#### Recommended Sizes (Mobile)

| Element | Size | Line Height |
|---------|------|-------------|
| Body | 17-18px | 1.6-1.7 |
| H1 | 28px | 1.2 |
| H2 | 22px | 1.3 |
| H3 | 18px | 1.4 |
| Captions/Meta | 14px | 1.4 |
| Sidenotes | 14px | 1.5 |

---

### Color Palettes

#### 1. Solarized Dark
*Designed by Ethan Schoonover. Warm, low-contrast, easy on eyes for long reading.*

**Source:** https://ethanschoonover.com/solarized/

| Token | Hex | Usage |
|-------|-----|-------|
| base03 | `#002b36` | Background |
| base02 | `#073642` | Background highlights |
| base01 | `#586e75` | Comments, secondary text |
| base00 | `#657b83` | Body text (light mode) |
| base0 | `#839496` | Body text (dark mode) |
| base1 | `#93a1a1` | Emphasized text |
| base2 | `#eee8d5` | Background (light mode) |
| base3 | `#fdf6e3` | Background highlights (light) |
| yellow | `#b58900` | Accent |
| orange | `#cb4b16` | Accent |
| red | `#dc322f` | Errors, warnings |
| magenta | `#d33682` | Accent |
| violet | `#6c71c4` | Links |
| blue | `#268bd2` | Links, highlights |
| cyan | `#2aa198` | Strings, success |
| green | `#859900` | Success |

#### 2. Solarized Light
*Same palette, inverted base values. Use base3/base2 as background, base00/base01 as text.*

#### 3. Abyss (VSCode built-in)
*Deep oceanic blue-purple. Moody, immersive.*

**Source:** https://github.com/microsoft/vscode (built-in theme)

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#000c18` | Main background |
| Editor foreground | `#6688cc` | Body text |
| Selection | `#770811` | Selection highlight |
| Line highlight | `#082050` | Current line |
| Comment | `#384887` | Secondary text |
| String | `#22aa44` | Green accent |
| Number/Constant | `#f280d0` | Pink accent |
| Keyword | `#225588` | Muted blue |
| Function | `#ddbb88` | Gold/tan |
| Type | `#9966b8` | Purple |
| Class | `#ffeebb` | Cream |
| Cursor | `#ddbb88` | Gold |

#### 4. Tomorrow Night Blue (VSCode built-in)
*Soft blue-tinted dark. Gentle, not harsh.*

**Source:** https://github.com/microsoft/vscode (built-in theme)

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#002451` | Main background |
| Foreground | `#ffffff` | Body text |
| Selection | `#003f8e` | Selection |
| Line highlight | `#00346e` | Current line |
| Comment | `#7285B7` | Secondary text |
| Variable/Tag | `#FF9DA4` | Pink/coral |
| Number/Constant | `#FFC58F` | Peach/orange |
| Class/Type | `#FFEEAD` | Cream/yellow |
| String | `#D1F1A9` | Mint green |
| Operator | `#99FFFF` | Cyan |
| Function | `#BBDAFF` | Light blue |
| Keyword | `#EBBBFF` | Lavender/pink |

#### 5. Dracula / Synthwave
*Full 80s neon. Cyberpunk. Hot pink, cyan, purple.*

**Source:** https://draculatheme.com/contribute

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#282A36` | Main background |
| Current Line | `#44475A` | Line highlight |
| Foreground | `#F8F8F2` | Body text |
| Comment | `#6272A4` | Secondary text |
| Cyan | `#8BE9FD` | Links, highlights |
| Green | `#50FA7B` | Success, strings |
| Orange | `#FFB86C` | Warnings |
| Pink | `#FF79C6` | Keywords, accents |
| Purple | `#BD93F9` | Functions, emphasis |
| Red | `#FF5555` | Errors |
| Yellow | `#F1FA8C` | Classes, strings |

**Synthwave enhancement ideas:**
- Subtle glow/text-shadow on headings: `text-shadow: 0 0 10px #FF79C6`
- Optional CRT scanline overlay (CSS pseudo-element)
- Grid background gradient (very subtle)

#### 6. OLED Black
*True black for battery savings and maximum contrast.*

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#000000` | Pure black |
| Foreground | `#e0e0e0` | Off-white text |
| Accent | `#8BE9FD` | Cyan links |
| Secondary | `#888888` | Muted text |

---

### Design Examples & References

#### gwern.net
- **URL:** https://gwern.net
- **Typography:** Source Serif Pro (Adobe)
- **Key features:**
  - Sidenotes (footnotes in margin on wide screens)
  - True small caps
  - Metadata block at top (status, confidence, importance, dates)
  - Dark mode toggle
  - Hover popups for link previews
  - Progress indicator
  - Multi-column layouts for indexes
- **Vibe:** Scholarly, dense, hypertext-maximalist

#### Instapaper
- **Typography:** Lyon Text (Commercial Fonts), SF Pro, Georgia fallbacks
- **Key features:**
  - Near-zero chrome
  - Progress bar at top
  - Theme switcher (sepia, white, dark)
  - Adjustable font size
  - Highlighting + notes
- **Vibe:** Pure reading focus, minimal, calm

#### Solarized
- **Designer:** Ethan Schoonover
- **URL:** https://ethanschoonover.com/solarized/
- **Philosophy:** Precision L*a*b* color values, symmetric light/dark inversion, reduced brightness contrast while maintaining hue contrast

#### Abyss
- **Source:** VSCode built-in theme
- **Vibe:** Deep ocean, twilight blue-purple, moody

#### Tomorrow Night Blue
- **Source:** VSCode built-in, part of Chris Kempson's Tomorrow theme family
- **Vibe:** Softer blue dark, pastel accents, gentle

#### Dracula
- **URL:** https://draculatheme.com
- **Designer:** Zeno Rocha
- **Vibe:** Neon vampire, hot pink + cyan + purple, 80s

---

### Theme System Architecture

```
themes/
  solarized-dark.css
  solarized-light.css
  abyss.css
  tomorrow-night-blue.css
  dracula.css
  oled-black.css
```

Each theme defines CSS custom properties:

```css
:root[data-theme="dracula"] {
  --bg-primary: #282A36;
  --bg-secondary: #44475A;
  --text-primary: #F8F8F2;
  --text-secondary: #6272A4;
  --accent-cyan: #8BE9FD;
  --accent-pink: #FF79C6;
  --accent-purple: #BD93F9;
  --accent-green: #50FA7B;
  --accent-orange: #FFB86C;
  --accent-red: #FF5555;
  --accent-yellow: #F1FA8C;
  --link-color: var(--accent-cyan);
  --link-hover: var(--accent-pink);
}
```

Theme switcher persists to localStorage. Respects `prefers-color-scheme` for initial load if no preference set.

---

## Open Questions for Had

1. **Source Serif 4** confirmed as body font? Or want to explore Lyon/alternatives?
2. **Default theme:** Solarized Dark? Dracula? System preference?
3. **Synthwave glow effects:** Subtle or go hard?
4. **Any other theme palettes** you want included from the start?

---

## Theme Vibes

These aren't color palettes — they're **conceptual/emotional inspirations** for selectable themes. Each could inform colors, typography, imagery, and mood.

### Fantasy / Sci-Fi
- **The Wall** — Game of Thrones: ice, dragonglass, obsidian, cold blue-black, ancient menace
- **Rocinante** — The Expanse: utilitarian spacecraft, blue glow, orange EVA suits, hard sci-fi
- **Morpheus katana / Escalade** — Matrix Reloaded: bullet time, black leather, green rain, chrome
- **Ashitaka and Yakul** — Princess Mononoke: dark forest, kodama spirits, earthy greens, mystical
- **Master Chief / Covenant bomb** — Halo 2: military green, alien purple, space opera heroics

### Personal / SoCal / Heritage
- **405 through the mountains at sunset** — Pink-purple sky, valley lights, golden hour, Ojai memories
- **Rocket pops** — Red/white/blue, 90s summer, nostalgic Americana
- **Poptarts and swimming pools** — Lazy summer, chlorine blue, frosted pastels
- **Persian rugs** — Grew up with these. Deep reds, navy medallions, cream fields, intricate geometric patterns, warm earth tones. Heritage and home. (saved: `inspo/persian-rug.jpg`)

### Science / Tech
- **Calabi-Yau manifolds** — String theory, impossible geometry, mathematical beauty
- **NASA Ames tarmac** — Big blimp hangars, Bay Area aerospace, industrial scale
- **Oak Ridge supercomputer** — Tennessee rivers, Smoky Mountains, computational power meets nature
- **Richard Feynman lectures** — Chalkboard diagrams, curiosity, playful genius, bongos

### Pop Culture / Nostalgia
- **2002 World Cup** — Ronaldo, Roberto Carlos, Zidane, Beckham — golden era football
- **Mulan** — Cherry blossoms, ink wash, honor, bold reds
- **A Bug's Life** — Macro world, leaf greens, ant colony, Pixar warmth
- **xkcd** — Stick figures, wit, science humor, clean black-and-white

### 90s/2000s Gaming
- **Age of Empires** — Wololo, gold mining, castle age, RTS fog of war, medieval sprites
- **SimCoaster** — Theme park tycoons, rollercoaster loops, neon lights, sim management vibes
- **Banjo Kazooie** — Colorful N64 platformer, jiggies, quirky music, Rare collectathon energy

---

---

## Future / Reminders

- [ ] Submit to **https://deadsimplesites.com/** once site is live — curated gallery of simple, well-designed sites

---

*Document created: 2026-03-16*
*Last updated: 2026-03-17*
