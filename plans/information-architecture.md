# Information Architecture

## Site Structure

```
hadsed.com/
├── Home (/)
│   └── About Me + Portfolio (combined landing)
│       ├── Hero/intro section
│       ├── About section
│       └── Portfolio/projects section
│
├── Blog (/blog)
│   ├── Blog index (list of posts)
│   └── Individual posts (/blog/[slug])
│
└── Vibe Games (/vibe-games)
    ├── Games index/gallery
    └── Individual games (/vibe-games/[game])
```

## Page Breakdown

### Home / About / Portfolio (`/`)
Single-page experience combining:
- **Hero** — First impression, name, tagline
- **About** — Who you are, what you do
- **Portfolio** — Selected projects/work

### Blog (`/blog`)
- Index page with post previews
- Individual post pages
- Categories/tags (optional)
- RSS feed (optional)

### Vibe Games (`/vibe-games`)
- Gallery/index of games
- Individual game pages (playable embeds?)
- Could be interactive web toys, experiments, etc.

---

## Open Questions

- [ ] Tech stack? (Static site generator, framework, plain HTML?)
- [ ] Blog format? (Markdown files, CMS, something else?)
- [ ] What counts as "vibe games"? (Web toys, small games, interactive art?)
- [ ] Design direction? (Retro pixel? Minimal? Something else?)
