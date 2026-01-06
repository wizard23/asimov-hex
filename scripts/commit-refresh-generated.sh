#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."

cd "$PROJECT_ROOT"

if ! git diff --cached --quiet; then
  echo "Abort: staged changes present. Please commit or stash them first."
  exit 1
fi

npm run create-project-statistics
npm run re-create-git-timeline
npm run test-coverage

git add ./public/project-statistics ./public/project-history ./public/coverage
git status -sb
git commit -m "automated: refresh project statistics, timeline, and Vitest code coverage"
