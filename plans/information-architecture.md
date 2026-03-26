# Information Architecture

## Site Structure

```
hadsed.com/
│
├── Home (/)
│   ├── Had sprite (arrow-key navigable)
│   ├── Cover letter paragraph
│   ├── Experiences section
│   │   └── Each links to /experience/[company]
│   └── Projects section (explorable tiles)
│       └── Each links to /project/[slug] or /vibe-games/[game]
│
├── Experience Pages (/experience/[company])
│   └── Deep-dive on what you did at each role
│
├── Project Pages (/project/[slug])
│   └── Project write-ups, demos, links
│
├── Blog (/blog)
│   ├── Index (post list)
│   └── /blog/[slug] (individual posts)
│
├── Bookshelf (/bookshelf)
│   └── Books read, recommendations, notes
│
└── Vibe Games (/vibe-games)
    ├── Gallery/index of worlds
    └── /vibe-games/[game] (playable scenes)
        └── Examples: NASA Ames blimp hangars, etc.
```

## Tech Stack

**No game engine.** Pure CSS + vanilla JS.

- Static site (HTML/CSS/JS) or lightweight framework (Astro, 11ty, etc.)
- Sprite animation via CSS (`@keyframes`, `steps()`, sprite sheets)
- Arrow key movement via vanilla JS (`keydown` listeners, transform/translate)
- No canvas required for basic sprite movement — DOM elements work fine
- Canvas optional for more complex vibe game scenes later

---

## Page Summaries

| Page | Purpose |
|------|---------|
| `/` | Homepage: sprite, cover letter, experiences, project tiles |
| `/experience/[company]` | Detail page for each job/role |
| `/project/[slug]` | Detail page for each project |
| `/blog` | Blog index |
| `/blog/[slug]` | Individual blog post |
| `/bookshelf` | Books read, recommendations |
| `/vibe-games` | Gallery of explorable pixel worlds |
| `/vibe-games/[game]` | Individual playable scene |

---

## Open Questions

- [ ] Bookshelf format? (Grid of covers? List with notes?)
- [ ] Blog style? (Pixel aesthetic or more readable/minimal?)
- [ ] Experience detail pages — narrative? bullets? both?
- [ ] How many vibe games to start with?
