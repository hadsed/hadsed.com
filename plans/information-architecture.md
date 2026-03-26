# Information Architecture

## Site Structure

```
hadsed.com/
├── Home (/)
│   ├── Had sprite (navigable with arrow keys)
│   ├── Cover letter (intro paragraph)
│   ├── Experiences (timeline with icons)
│   │   └── /experience/[company] (detail pages)
│   └── Projects (explorable map tiles)
│       └── /project/[slug] (detail pages)
│
├── Blog (/blog)
│   ├── Blog index
│   └── /blog/[slug]
│
├── Bookshelf (/bookshelf)
│   └── Books read, recommendations, notes?
│
└── Vibe Games (/vibe-games)
    ├── Games index/gallery
    └── /vibe-games/[game] (playable worlds)
```

## Page Breakdown

### Home (`/`)

**Hero area:**
- Pixel sprite of Had at top
- Sprite is navigable (arrow keys) — could walk into the explorable worlds below

**Cover letter:**
- Single paragraph intro — who you are, what you're about

**Experiences:**
- Timeline/list of roles
- Each has an **icon on the left** (company logo? pixel art scene?)
- Short description inline
- Clicking expands or links to `/experience/[company]` with deeper write-ups of what you did there

**Projects:**
- Below experiences
- Displayed as **explorable map tiles** — little pixel worlds/landscapes
- Each tile links to a project detail page or is itself a mini vibe game
- Example vibe: NASA Ames blimp hangars as a navigable scene

**Interaction concept:**
- The Had sprite at top could potentially "walk into" these project worlds
- Or each tile is a standalone explorable that opens on click

### Blog (`/blog`)
- Index page with post previews
- Individual post pages
- Categories/tags (optional)
- RSS feed (optional)

### Bookshelf (`/bookshelf`)
- Books you've read
- Recommendations
- Maybe notes/highlights?

### Vibe Games (`/vibe-games`)
- Gallery of explorable pixel worlds
- Each is a small interactive scene (walk around, discover things)
- Examples: NASA Ames blimp hangars, others TBD

---

## Design Direction

**Aesthetic:** Pixel art / retro game feel
- Navigable sprite character
- Explorable tile-based worlds
- Landscapes representing experiences/projects

**Interaction:**
- Arrow key navigation for sprite
- Click to enter worlds/pages
- Seamless blend of portfolio and playful exploration

---

## Open Questions

- [ ] Tech stack? (Phaser? PixiJS? Plain canvas? Static + JS?)
- [ ] How deep does sprite navigation go? (Just homepage? Into each world?)
- [ ] Bookshelf format? (Grid of covers? List with notes? Goodreads-like?)
- [ ] Blog style? (Matches pixel aesthetic or more readable/minimal?)
- [ ] Experience detail pages — narrative? bullet points? mini-games?
