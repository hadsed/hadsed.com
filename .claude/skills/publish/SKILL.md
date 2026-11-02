---
name: publish
description: Bring Had's latest Obsidian copy from the obsidian branch into a deployable branch, check it, and hand Had the preview link. Use when Had says "publish", "push the site", or asks what is waiting to go live.
---

# Publish

Content is edited in Obsidian, in the vault folder `hadsed.com/`. A bridge on the
Hetzner box mirrors that folder into `content/` on the `obsidian` branch every 20
seconds. That branch deploys nothing and has no PR: it is the latest copy, waiting.
Had says when copy should go live. Everything below is plain git, so any session
with access to the repository can do it; nobody needs the box.

## Steps

1. `git fetch origin obsidian` and see what changed:
   `git diff <deploy-branch> origin/obsidian -- content/`. If nothing changed,
   say so.
2. Read that diff. Look for:
   - front matter the templates need (roles: `org`, `start`, `order`; projects
     and articles: `title`, `date` or `year`, `summary`), dates kept as quoted
     `"YYYY-MM"` strings;
   - a phone number anywhere (never ship one);
   - wikilinks that do not resolve, images referenced but missing from `assets/`.
3. On a feature branch: `git checkout origin/obsidian -- content`, commit, and run
   `npm test`. A broken wikilink or bad front matter fails here.
4. **Fixes go in the vault, never on the branch.** Tell Had exactly what to change
   in Obsidian; the bridge picks it up within 20 seconds.
5. Push the branch. The deploy check gives a preview at
   `https://<branch-slug>.hadsed-com.pages.dev`. Report that link and a one-line
   summary of what changed. Shipping is a merge to `main`; do it only when Had
   says to.

## Shell changes

Anything under `src/`, `eleventy.config.js`, tests, or workflows is shell, not
content. Those go on a normal feature branch and PR, never through the bridge.
When a shell change also edits `content/` (a new front matter field, say), the
bridge copies main's version of those files back into the vault after the merge.
