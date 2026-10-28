#!/usr/bin/env bash
# Obsidian -> GitHub bridge for hadsed.com. Runs on the Hetzner box from a
# systemd timer (see scripts/systemd/). Installed copy: /usr/local/bin/hadsed-bridge.
#
# Forward: rebuild the `obsidian` branch as BASE_REF plus the vault's hadsed.com/
# site folders, push it, and keep one open PR to main.
# Reverse: files under content/ that changed on main since the last run are
# copied back into the vault, so a fix merged through a shell PR is not undone.
set -euo pipefail

VAULT=${VAULT:-/root/obsidian/vaults/unstructured-space/hadsed.com}
REPO=${REPO:-/root/projects/hadsed.com}
STATE=${STATE:-/root/.local/state/hadsed-bridge}
BASE_REF=${BASE_REF:-origin/main}
BRANCH=obsidian
PREVIEW=https://obsidian.hadsed-com.pages.dev
MIRROR=(about.md experience projects articles assets)
PUSH=${PUSH:-1}

mkdir -p "$STATE"
exec 9>"$STATE/lock"
flock -n 9 || exit 0
cd "$REPO"
git fetch -q origin

# Reverse sync: main -> vault, only for files that changed since the last run.
MAIN=$(git rev-parse origin/main)
LAST=$(cat "$STATE/last-main" 2>/dev/null || true)
if [ -n "$LAST" ] && [ "$LAST" != "$MAIN" ]; then
  git diff --name-only "$LAST" "$MAIN" -- content/ | while read -r f; do
    rel=${f#content/}
    case "$rel" in *.json) continue;; esac
    if git cat-file -e "$MAIN:$f" 2>/dev/null; then
      mkdir -p "$VAULT/$(dirname "$rel")"
      git show "$MAIN:$f" > "$VAULT/$rel"
      echo "vault <- main: $rel"
    else
      rm -f "$VAULT/$rel"
      echo "vault -x main: $rel"
    fi
  done
fi
echo "$MAIN" > "$STATE/last-main"

# Forward sync: vault -> obsidian branch.
git checkout -q -B "$BRANCH" "$BASE_REF"
for item in "${MIRROR[@]}"; do
  [ -e "$VAULT/$item" ] || continue
  # *.json are Eleventy directory data files (shell, not content); excluded
  # files are also protected from --delete.
  rsync -a --delete --exclude '*.json' --exclude '.*' "$VAULT/$item" content/
done
git add -A content
if ! git diff --cached --quiet; then
  git -c user.name="Obsidian bridge" -c user.email="bridge@hadsed.com" \
    commit -q -m "Content from Obsidian, $(date -u +'%Y-%m-%d %H:%M UTC')"
fi

if git diff --quiet origin/main "$BRANCH"; then
  echo "nothing to publish"
  if [ "$PUSH" = 1 ] && git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
    git push -q origin --delete "$BRANCH"   # closes the PR
  fi
  exit 0
fi

git --no-pager diff --stat origin/main "$BRANCH" -- content/ | tail -1
[ "$PUSH" = 1 ] || { echo "PUSH=0, not pushing"; exit 0; }
git push -q -f origin "$BRANCH"
if [ -z "$(gh pr list --head "$BRANCH" --state open --json number -q '.[0].number')" ]; then
  gh pr create --base main --head "$BRANCH" --title "Content from Obsidian" \
    --body "Edits from the Obsidian vault folder \`hadsed.com/\`, mirrored by the bridge on the Hetzner box.

Preview (after the deploy check passes): $PREVIEW

This branch is rebuilt from the vault every two minutes; fix content in Obsidian, not here."
fi
