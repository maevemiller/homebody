#!/bin/sh
# Saves a snapshot of the whole working tree to refs/homebody/checkpoints without
# touching your branch, your staged changes, or your files. Each snapshot is a
# commit on that ref, so `git diff <old> <new>` shows what changed between steps.
#   scripts/checkpoint.sh "what was just done"
#   git log --oneline refs/homebody/checkpoints          # list snapshots
#   git checkout <sha> -- path/to/file                   # restore a file from one
set -e
cd "$(git rev-parse --show-toplevel)"
REF=refs/homebody/checkpoints
TMP_INDEX="$(git rev-parse --git-dir)/checkpoint-index"
rm -f "$TMP_INDEX"
GIT_INDEX_FILE="$TMP_INDEX" git add -A          # respects .gitignore (no node_modules, data/, assets)
TREE=$(GIT_INDEX_FILE="$TMP_INDEX" git write-tree)
rm -f "$TMP_INDEX"
PARENT=$(git rev-parse -q --verify "$REF" || git rev-parse HEAD)
if [ "$(git rev-parse "$PARENT^{tree}")" = "$TREE" ]; then
  echo "no changes since $(git rev-parse --short "$PARENT")"
  exit 0
fi
SHA=$(git commit-tree "$TREE" -p "$PARENT" -m "${1:-checkpoint} ($(date '+%Y-%m-%d %H:%M'))")
git update-ref "$REF" "$SHA"
echo "checkpoint $(git rev-parse --short "$SHA") (previous $(git rev-parse --short "$PARENT"))"
