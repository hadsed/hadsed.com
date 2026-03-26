# Homepage Spec

## Overview

The homepage is the main landing experience — part portfolio, part interactive toy. A pixel sprite of Had lives at the top and can be moved with arrow keys. Below: a cover letter, work experiences, and project tiles that hint at explorable worlds.

---

## Layout (Top to Bottom)

### 1. Hero: Had Sprite

**Element:** Pixel art character sprite, centered or left-aligned at top.

**Behavior:**
- Idle animation by default (breathing, blinking, subtle movement)
- Arrow keys move the sprite left/right (and optionally up/down if we want 2D freedom)
- Walk cycle animation plays while moving
- Sprite stays within a bounded area (doesn't scroll off-screen)

**Implementation (CSS + JS):**
```
- Sprite sheet PNG with animation frames
- CSS background-position + steps() for animation
- JS keydown/keyup listeners for movement
- CSS transform: translateX/Y for position
- Collision bounds via JS (min/max X/Y)
```

**Future enhancement:** Sprite could "walk into" project tiles to enter those worlds.

---

### 2. Cover Letter

**Element:** Single paragraph introducing Had.

**Content direction:**
- Who you are
- What you're about
- Tone: personal, not corporate

**Style:**
- Clean, readable typography
- Could have subtle pixel-art decorative elements (border, icons)
- Maybe a small pixel portrait next to the text?

---

### 3. Experiences

**Element:** Vertical timeline or stacked list of roles.

**Structure per item:**
```
[Icon/Scene]  Company Name — Role Title
              Short description (1-2 sentences)
              [Click to read more →]
```

**Icon/Scene (left side):**
- Small pixel art icon OR
- Mini landscape/scene representing that workplace
- Examples: office building, lab, rocket, etc.

**Interaction:**
- Click anywhere on the row → navigates to `/experience/[company]`
- Hover: subtle highlight or animation

**Implementation:**
- Flexbox or grid layout
- Icon as `<div>` with background sprite or inline SVG
- Link wraps the whole row

---

### 4. Projects (Explorable Tiles)

**Element:** Grid of project tiles below experiences.

**Each tile:**
- Pixel art landscape/scene representing the project
- Project name overlaid or below
- Click → goes to `/project/[slug]` OR `/vibe-games/[game]` if it's a playable world

**Visual concept:**
- Tiles look like little windows into different worlds
- Could have subtle idle animations (clouds moving, lights blinking)
- Example: NASA Ames blimp hangars tile shows the massive hangars in pixel art

**Layout:**
- CSS Grid, 2-3 columns on desktop
- Stack to 1 column on mobile
- Consistent tile aspect ratio

**Interaction:**
- Hover: zoom slightly, border glow, or parallax shift
- Click: navigate to detail page

**Stretch goal:** Had sprite at top could walk down into this section and "enter" a tile.

---

## Sprite System (CSS + JS)

### Sprite Sheet Format

```
sprite-had.png
├── Row 0: Idle frames (4-8 frames)
├── Row 1: Walk right frames (4-8 frames)
├── Row 2: Walk left frames (or flip Row 1)
├── Row 3: Walk up (optional)
├── Row 4: Walk down (optional)
```

### CSS Animation

```css
.sprite {
  width: 32px;
  height: 32px;
  background: url('sprite-had.png') no-repeat;
  image-rendering: pixelated;
}

.sprite.idle {
  animation: idle 0.8s steps(4) infinite;
}

@keyframes idle {
  from { background-position: 0 0; }
  to { background-position: -128px 0; } /* 4 frames × 32px */
}

.sprite.walk-right {
  animation: walk-right 0.4s steps(4) infinite;
}

@keyframes walk-right {
  from { background-position: 0 -32px; }
  to { background-position: -128px -32px; }
}
```

### JS Movement

```js
const sprite = document.querySelector('.sprite');
const speed = 4; // pixels per frame
let x = 0, y = 0;
let keys = {};

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

function update() {
  if (keys['ArrowRight']) x += speed;
  if (keys['ArrowLeft']) x -= speed;
  if (keys['ArrowDown']) y += speed;
  if (keys['ArrowUp']) y -= speed;
  
  // Bounds checking
  x = Math.max(0, Math.min(x, maxX));
  y = Math.max(0, Math.min(y, maxY));
  
  sprite.style.transform = `translate(${x}px, ${y}px)`;
  
  // Update animation class based on movement
  // ...
  
  requestAnimationFrame(update);
}

update();
```

---

## Responsive Considerations

- **Mobile:** Arrow keys don't work. Options:
  - On-screen D-pad buttons
  - Swipe gestures
  - Or: sprite is static on mobile, just decorative
- **Tile grid:** Collapse to single column
- **Typography:** Scale down but stay readable

---

## File Structure (suggested)

```
/
├── index.html
├── css/
│   ├── main.css
│   ├── sprite.css
│   └── tiles.css
├── js/
│   ├── sprite.js
│   └── main.js
├── assets/
│   ├── sprite-had.png
│   ├── tiles/
│   │   ├── nasa-ames.png
│   │   ├── project-2.png
│   │   └── ...
│   └── icons/
│       ├── company-1.png
│       └── ...
└── experience/
    ├── company-1.html
    └── ...
```

---

## Open Design Questions

- [ ] Sprite size? 32×32? 64×64? Larger for hero area?
- [ ] Color palette? (Limited retro palette like NES/SNES?)
- [ ] How much of homepage is scrollable vs fixed viewport?
- [ ] Font choice? (Pixel font or clean sans-serif with pixel accents?)
- [ ] Background: solid color, subtle pattern, or scene?

---

## MVP Scope

For v1, focus on:
1. Static sprite with idle animation (movement can come later)
2. Cover letter text
3. 3-4 experience entries linking to placeholder pages
4. 3-4 project tiles linking to placeholder pages

Get the layout and vibe right first, then layer in interactivity.
