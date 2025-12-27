#!/usr/bin/env bash
set -euo pipefail

# Format version — increment if structure or semantics change
FORMAT_VERSION=1

DELIM="###"

echo "$DELIM META"
echo "version=$FORMAT_VERSION"
date -u +"timestamp=%Y-%m-%dT%H:%M:%SZ"
echo "headCommit=$(git rev-parse HEAD)"
echo "headBranch=$(git symbolic-ref --quiet --short HEAD || echo DETACHED)"

# ------------------------------------------------------------------------------
echo "$DELIM INTRINSIC"

# Commit counts
echo "commitCount=$(git rev-list --count HEAD)"
echo "totalCommitCount=$(git rev-list --count --all)"

# Tracked files
echo "trackedFileCount=$(git ls-files -z | tr -cd '\0' | wc -c)"

# Tracked directories
git ls-files -z \
  | xargs -0 -n1 dirname \
  | sort -u \
  | wc -l \
  | awk '{print "trackedDirCount="$1}'

# Total tracked content size (tree-based, not working directory)
git ls-tree -r -l --full-tree HEAD \
  | awk '{sum+=$4} END {print "trackedContentBytes="sum}'

# ------------------------------------------------------------------------------
echo "$DELIM GIT_OBJECTS"

git count-objects -v

# ------------------------------------------------------------------------------
echo "$DELIM LARGEST_BLOBS"

git rev-list --objects --all \
| git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
| awk '$1=="blob"{print $3 "\t" $4}' \
| sort -n \
| tail -n 20

# ------------------------------------------------------------------------------
echo "$DELIM DISK_USAGE"

# Total working directory size
du -s -B1 . | awk '{print "worktreeBytes="$1}'

# Excluding .git
du -s -B1 --exclude=.git . | awk '{print "worktreeExcludingGitBytes="$1}'

# Git directory size
du -s -B1 "$(git rev-parse --git-dir)" | awk '{print "gitDirBytes="$1}'

# ------------------------------------------------------------------------------
echo "$DELIM TOP_LEVEL_DIRS"

# Top-level directory size breakdown
du -B1 -d1 . | sort -nr
