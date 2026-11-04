---
name: publish
description: Check the content PR that the Obsidian bridge opened, fix what blocks it, and hand Had the preview link so he can merge. Use when Had says "publish", "push the site", or asks what is waiting to go live.
---

# Publish

Content is edited in Obsidian, in the vault folder `hadsed.com/`. A bridge on the
Hetzner box (`ssh hetzner`) mirrors that folder into `content/` on the `obsidian`
branch every two minutes and keeps one open PR from `obsidian` to `main`. Merging
the PR deploys hadsed.com. This skill is the review step in between.

## Steps

1. `git fetch origin` and find the PR: `gh pr list --head obsidian --state open`.
   If there is none, say so: either nothing changed in the vault, or the bridge
   has not run yet (`ssh hetzner systemctl status hadsed-bridge.timer`). Start one
   run with `ssh hetzner systemctl start hadsed-bridge.service` if needed.
2. Read the diff of `content/` on the PR (`gh pr diff <n>`). Look for:
   - front matter the templates need (roles: `org`, `start`, `order`; projects
     and articles: `title`, `date` or `year`, `summary`), dates kept as quoted
     `"YYYY-MM"` strings;
   - a phone number anywhere (never ship one);
   - wikilinks that do not resolve, images referenced but missing from `assets/`.
3. Build it: check out the branch and run `npm run build`. A broken wikilink or
   bad front matter fails here. The CI run on the PR does the same.
4. **Fixes go in the vault, never on the branch.** The bridge rebuilds the
   `obsidian` branch from the vault every run, so a commit on the branch is
   overwritten within minutes. Edit the file under
   `/root/obsidian/vaults/unstructured-space/hadsed.com/` on the Hetzner box
   (`ssh hetzner`); Obsidian Sync carries it everywhere and the bridge picks it up.
   Without access to the box, tell Had exactly what to change in Obsidian instead.
5. Report: the PR link, the preview at https://obsidian.hadsed-com.pages.dev
   (ready once the PR's deploy check is green), and a one-line summary of what
   changed. Had merges. Never merge for him unless he says to.

## Shell changes

Anything under `src/`, `eleventy.config.js`, tests, or workflows is shell, not
content. Those go on a normal feature branch and PR, never through the bridge.
When a shell change also edits `content/` (a new front matter field, say), the
bridge copies main's version of those files back into the vault after the merge.
