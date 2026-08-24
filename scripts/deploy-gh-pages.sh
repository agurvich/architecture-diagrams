#!/usr/bin/env bash
# Builds the app and publishes dist/ to the gh-pages branch via a temporary
# git worktree, leaving the current branch/working tree untouched.
set -euo pipefail

cd "$(dirname "$0")/.."

BRANCH="gh-pages"
WORKTREE_DIR=".gh-pages-worktree"
REMOTE="${1:-origin}"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree has uncommitted changes — commit or stash before deploying." >&2
  exit 1
fi

echo "Building production bundle..."
npm run build

rm -rf "$WORKTREE_DIR"
trap 'git worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true; rm -rf "$WORKTREE_DIR"' EXIT

if git show-ref --verify --quiet "refs/remotes/$REMOTE/$BRANCH"; then
  git worktree add "$WORKTREE_DIR" -B "$BRANCH" "$REMOTE/$BRANCH"
else
  git worktree add --orphan -b "$BRANCH" "$WORKTREE_DIR"
fi

# Clear everything except .git, then copy in the fresh build.
find "$WORKTREE_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -r dist/. "$WORKTREE_DIR/"
touch "$WORKTREE_DIR/.nojekyll"

pushd "$WORKTREE_DIR" >/dev/null
git add -A
if git diff --cached --quiet; then
  echo "Nothing changed — gh-pages is already up to date."
else
  git commit -m "Deploy $(git -C .. rev-parse --short HEAD)"
  git push "$REMOTE" "$BRANCH"
  echo "Pushed to $REMOTE/$BRANCH."
fi
popd >/dev/null
