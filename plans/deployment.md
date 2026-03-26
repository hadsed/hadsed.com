# Deployment

## Platform: Cloudflare Pages

Free, fast, auto-deploys from GitHub.

---

## Setup Steps

### 1. Connect Repo

1. Cloudflare dashboard → Pages → **Create a project**
2. Connect GitHub → Select `hadsed/hadsed.com`
3. Build settings:
   - **Build command:** (leave blank for now)
   - **Build output directory:** `/` (or `/dist` if using a build step later)
4. Click **Save and Deploy**

### 2. Custom Domain

Once deployed, add custom domain:

1. Pages project → **Custom domains** → Add domain
2. Enter `hadsed.com`
3. If DNS is already on Cloudflare, it auto-configures
4. Add `www.hadsed.com` too and set up redirect if desired

### 3. Auto-Deploy

After setup, every push to `main` triggers a new deployment automatically.

---

## Preview Deployments

Cloudflare Pages creates preview URLs for every branch/PR:

- Push to `feature/sprite-animation` → get `feature-sprite-animation.hadsed-com.pages.dev`
- Useful for testing before merging to main

---

## Build Step (Future)

If we add a static site generator (Astro, 11ty, etc.), update build settings:

| Generator | Build Command | Output Dir |
|-----------|---------------|------------|
| Astro | `npm run build` | `dist` |
| 11ty | `npx eleventy` | `_site` |
| Vite | `npm run build` | `dist` |

For now, pure HTML/CSS/JS needs no build.

---

## Environment Variables

If needed later (API keys, feature flags), add in:

Pages project → Settings → Environment variables

---

## DNS Records (if not already on Cloudflare)

If hadsed.com DNS is elsewhere, you'll need:

```
Type: CNAME
Name: @
Target: hadsed-com.pages.dev

Type: CNAME  
Name: www
Target: hadsed-com.pages.dev
```

(Exact target URL shown in Cloudflare Pages after first deploy)

---

## Rollback

If a deploy breaks something:

Pages project → Deployments → Find previous working deploy → **Rollback to this deployment**

---

## Checklist

- [ ] Create Pages project in Cloudflare
- [ ] Connect hadsed/hadsed.com repo
- [ ] First deploy (even if just README)
- [ ] Add hadsed.com custom domain
- [ ] Verify SSL working
- [ ] Test preview deploy on a branch
