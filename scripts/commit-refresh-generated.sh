#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."

cd "$PROJECT_ROOT"

if ! git diff --cached --quiet; then
  echo "Abort: staged changes present. Please commit or stash them first."
  exit 1
fi

if [[ "${1:-}" == "--enforce-clean-repo" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Abort: working tree has changes. Use a clean repo or drop --enforce-clean-repo."
    exit 1
  fi
fi

dirty_generated_dirs="$(git status --porcelain -- ./public/project-statistics ./public/project-history ./public/coverage)"
if [[ -n "$dirty_generated_dirs" ]]; then
  echo "Abort: generated output directories already have changes."
  echo "Please commit, stash, or clean the following before running:"
  # echo "$dirty_generated_dirs"
  # better colors :)
  git status --short -- ./public/project-statistics ./public/project-history ./public/coverage
  exit 1
fi

npm run create-project-statistics
npm run re-create-git-timeline
npm run test-coverage

git add ./public/project-statistics ./public/project-history ./public/coverage
git status -sb
git commit -m "automated: refresh project statistics, timeline, and Vitest code coverage"
