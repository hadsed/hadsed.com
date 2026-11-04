# Retro Visual Design Research

Research compiled for Had's personal site design. Hidden terminal easter egg noted as a key feature to implement.

---

## Quick Reference: Best Finds

### Frameworks & Libraries
| Resource | URL | What It Does |
|----------|-----|--------------|
| **PXLKIT** | pxlkit.com | React + TypeScript + Tailwind pixel UI kit (53 components, 6 icon packs) |
| **98.css** | jdan.github.io/98.css | Complete Windows 98 UI recreation |
| **Lospec** | lospec.com | Pixel art palettes (4,100+) and community |
| **Game-Icons.net** | game-icons.net | 4,170+ free SVG game icons |
| **Press Start 2P** | Google Fonts | Arcade-style pixel font |
| **VT323** | Google Fonts | Authentic terminal font |

### Key CodePens
- **Lucas Bebber CRT** — codepen.io/lbebber/pen/XJRdrV (canonical scanline effect)
- **Keith Clark Starfield** — codepen.io/keithclark/pen/DQdKbg (pure CSS stars)
- **Keith Clark Single Element** — codepen.io/keithclark/pen/JjWyBb (350+ stars, one element)

---

## 1. Pixel Art Icons

**Top Resources:**
- **Lospec.com** — Premier pixel art community, 4,100+ palettes, daily challenges
- **Pixel Joint** — 262k+ members, strict quality standards, weekly challenges
- **Game-Icons.net** — 4,170+ SVG icons, consistent style, free
- **Kenney.nl** — Professional game assets, 16x16/32x32 packs
- **OpenGameArt.org** — CC-licensed game assets

**Best Practice:** Use limited palettes (≤16 colors), design at multiples of 8px, provide 2x assets for retina.

---

## 2. Dithered Gradients

**Tools:**
- **Dither Me This** — doodad.dev/dither-me-this (interactive real-time dithering)
- **DitherJS** — JavaScript library for image dithering
- **Aseprite** — Pixel art software with built-in dithering

**CSS Technique:**
```css
.dithered-gradient {
  background: linear-gradient(90deg,
    #000 0%, #000 12.5%,
    #333 12.5%, #333 25%,
    #666 25%, #666 37.5%,
    #999 37.5%, #999 50%,
    #ccc 50%, #ccc 62.5%,
    #fff 62.5%
  );
}
```

---

## 3. CRT Scanlines

**Best Tutorial:** aleclownes.com/2017/02/01/crt-display.html

**CSS Pattern:**
```css
.crt::before {
  content: " ";
  position: absolute;
  top: 0; left: 0; bottom: 0; right: 0;
  background: 
    linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), 
    linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
  z-index: 2;
  background-size: 100% 2px, 3px 100%;
  pointer-events: none;
}
```

**Enhancements:** Flicker animation (133fps opacity), moving scanline sweep, RGB color separation.

---

## 4. Retro System Fonts

**Google Fonts (free, easy):**
| Font | Style | Best For |
|------|-------|----------|
| **Press Start 2P** | Arcade/gaming | Headlines, logos |
| **VT323** | Terminal/CRT | Code, body text |
| **Space Mono** | Modern mono | Pairs with Press Start 2P |

**Sizing Rule:** Always use multiples of 8px for pixel fonts (8, 16, 24px).

**Self-hosting:** gwfh.mranftl.com/fonts/press-start-2p

---

## 5. Beveled Edges / 3D Buttons

**Best Resource:** 98.css (jdan.github.io/98.css)

**CSS Pattern:**
```css
.beveled-button {
  box-shadow: 
    inset -1px -1px #0a0a0a,
    inset 1px 1px #dfdfdf,
    inset -2px -2px grey,
    inset 2px 2px #fff;
  border: none;
  padding: 3px 8px;
  background: #c0c0c0;
}

.beveled-button:active {
  box-shadow: 
    inset 1px 1px #0a0a0a,
    inset -1px -1px #dfdfdf,
    inset 2px 2px grey,
    inset -2px -2px #fff;
}
```

**Other Frameworks:** Win95.CSS (Bootstrap theme), Themesberg W95 UI Kit.

---

## 6. Starfield Screensaver

**Best Implementations:**
- **startscreen.org/starfield** — Faithful W95 recreation with controls
- **excessivelyadequate.com/posts/starfield.html** — Technical tutorial + demo
- **Keith Clark CSS** — Pure CSS, no JavaScript

**Approaches:**
1. **Canvas + JS** — Most faithful, good performance
2. **WebGL/Three.js** — Best performance, most flexibility
3. **Pure CSS** — Lightweight, simple implementations
4. **CSS + Sass** — Complex effects with preprocessing

---

## Design Notes for Had's Site

### Confirmed Features:
- [ ] Hidden terminal easter egg (click to reveal CLI) — a "peel back" layer like ryo's ryOS
- [ ] Theme switcher (Solarized, Abyss, Dracula/Synthwave)
- [ ] Scholarly typography (serif primary, mono for accents)
- [ ] Subtle CRT scanlines on images (optional toggle?)
- [ ] Pixel art touches where appropriate

### Typography Plan:
**Mono (terminal layer, code, metadata):**
- **Space Mono** — https://fonts.google.com/specimen/Space+Mono ✓

**Serif (main reading layer):**
- **Source Serif 4** — gwern's choice, true small caps, open source
- **Newsreader** — Google Font, nice for long reads
- **Spectral** — Google Font, slightly more contemporary
- **Literata** — Google Font, designed for long-form reading
- *(Need to pick one — Had to review)*

**Site Architecture:**
- **Primary layer:** Clean, scholarly, serif typography — the "real" site
- **Hidden layer:** Terminal/retro easter egg, pixel touches — like ryOS on ryo.lu
- Not everything is terminal — that's a peel-back moment, not the default

### Terminal Easter Egg Details:
- **Reference:** aleclownes.com/2017/02/01/crt-display.html (Hyper terminal w/ CRT effect)
- **Effect idea:** Terminal normally sharp, but every ~60s a 2-second transition to blurry CRT mode and back
- **Like a degauss/refresh moment** — subtle, periodic, fun
- **Implementation:** CSS animation on a timer, toggle blur + scanline intensity + maybe slight flicker

### Vibe References:
- **gwern.net** — Scholarly, typography-forward, sidenotes
- **ryo.lu** — ryOS desktop recreation, nostalgic but modern
- **Instapaper** — Minimal chrome, pure reading focus
- **pi.website** — Clean, dark, tech minimalism

### Visual Inspiration (saved images):
- **Ghibli-style pixel landscapes** — Cumulus clouds over green fields, serene countryside
- **Coastal road scene** — Pixel art with muted earth tones, ocean horizon
- **Matterhorn/alpine** — Snow-capped peaks, limited blue-purple palette, atmospheric depth
- **PXLKIT** — React component library with pixel aesthetic (pxlkit.com)
- **CraftPix nature backgrounds** — https://craftpix.net/freebies/free-nature-backgrounds-pixel-art/
- **doodad.dev Dither Me This UI** — https://doodad.dev/dither-me-this/
  - Warm sunset palette (cream, peach, coral, soft yellow)
  - Blocky retro window/card design with outlined panels
  - Cozy vaporwave meets functional tool aesthetic
  - Good reference for a warmer color theme option
- **SoCal highway sunset pixel art** — Pink-purple sky, valley lights, highway sign
  - Reminds Had of driving to Ojai to visit his uncle
  - Personal resonance — could be meaningful for a hero/404/loading image
  - Palette: dusty pink, lavender, gold horizon, warm road tones
- **Jasmin Lai harbor scene** — Geometric minimalism / flat landscape illustration
  - Style: flat color planes, horizontal banding, simplified forms, muted harmonious palette
  - Influences: mid-century modern illustration, color field painting, Scandinavian design, Japanese woodblocks
  - Mood: still, contemplative, meditative calm
  - Palette: soft blues, lavender, pink, gray — nothing saturated
  - Could inform a "Serene" or "Harbor" theme
  - Saved: `inspo/jasmin-lai-harbor-geometric.png`

These suggest a potential direction: mix the scholarly/minimal UI with occasional pixel art flourishes or backgrounds. Could work as hero images, loading states, or easter eggs.

---

*Research compiled: 2026-03-17*
