#!/usr/bin/env bash
# Obsidian -> GitHub bridge for hadsed.com. Runs on the Hetzner box from a
# systemd timer (see scripts/systemd/). Installed copy: /usr/local/bin/hadsed-bridge.
#
# Forward: every 20 seconds, rebuild the `obsidian` branch as BASE_REF plus the
# vault's hadsed.com/ site folders and push it when something changed. The branch
# is a record of the vault, not a deploy: the workflow ignores it and no PR is
# opened. Copy goes live when Had asks and a session brings content/ from
# `obsidian` into a branch that deploys.
# Reverse: files under content/ that changed on main since the last run are
# copied back into the vault, so a fix merged through a shell PR is not undone.
set -euo pipefail

# Same settings whether run by systemd or by hand; the environment wins.
if [ -f /etc/hadsed-bridge.env ]; then set -a; . /etc/hadsed-bridge.env; set +a; fi

VAULT=${VAULT:-/root/obsidian/vaults/unstructured-space/hadsed.com}
REPO=${REPO:-/root/projects/hadsed.com}
STATE=${STATE:-/root/.local/state/hadsed-bridge}
BASE_REF=${BASE_REF:-origin/main}
BRANCH=obsidian
MIRROR=(about.md experience projects articles assets)
PUSH=${PUSH:-1}

mkdir -p "$STATE"
exec 9>"$STATE/lock"
flock -n 9 || exit 0
cd "$REPO"
git fetch -q origin
# A feature-branch base that has since merged into main is just main.
if [ "$BASE_REF" != origin/main ] && git merge-base --is-ancestor "$BASE_REF" origin/main 2>/dev/null; then
  BASE_REF=origin/main
fi

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

# Each run makes a fresh commit, so compare trees and push only when the
# content or the base actually changed.
if git rev-parse -q --verify "origin/$BRANCH" >/dev/null &&
   [ "$(git rev-parse "$BRANCH^{tree}")" = "$(git rev-parse "origin/$BRANCH^{tree}")" ]; then
  exit 0
fi

git --no-pager diff --stat origin/main "$BRANCH" -- content/ | tail -1
[ "$PUSH" = 1 ] || { echo "PUSH=0, not pushing"; exit 0; }
git push -q -f origin "$BRANCH"
