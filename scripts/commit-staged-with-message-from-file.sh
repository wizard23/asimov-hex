#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Defaults
# -----------------------------
DEFAULT_MSG_FILE="./temp/commit-message.txt"
DRY_RUN=false
MSG_FILE=""

# -----------------------------
# Parse arguments
# -----------------------------
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      if [[ -z "${MSG_FILE}" ]]; then
        MSG_FILE="$arg"
      else
        echo "❌ Unexpected argument: $arg" >&2
        exit 1
      fi
      ;;
  esac
done

MSG_FILE="${MSG_FILE:-$DEFAULT_MSG_FILE}"

# -----------------------------
# Validation
# -----------------------------
if [[ ! -f "$MSG_FILE" ]]; then
  echo "❌ Commit message file not found: $MSG_FILE" >&2
  exit 1
fi

if [[ ! -s "$MSG_FILE" ]]; then
  echo "❌ Commit message file is empty: $MSG_FILE" >&2
  exit 1
fi

if git diff --cached --quiet; then
  echo "❌ No staged changes to commit." >&2
  exit 1
fi

# -----------------------------
# Dry run
# -----------------------------
if [[ "$DRY_RUN" == "true" ]]; then
  echo "🧪 Dry run mode"
  echo "----------------------------------------"
  echo "Commit message file: $MSG_FILE"
  echo
  echo "Commit message:"
  echo "----------------------------------------"
  cat "$MSG_FILE"
  echo "----------------------------------------"
  echo
  echo "Files that would be committed:"
  git diff --cached --name-only
  echo
  echo "Command that would run:"
  echo "  git commit -F \"$MSG_FILE\""
  exit 0
fi

# -----------------------------
# Commit
# -----------------------------
git commit -F "$MSG_FILE"
