#!/usr/bin/env bash
set -euo pipefail

FILE="./temp/commit-message.txt"

# --- Check file exists ---
if [[ ! -f "$FILE" ]]; then
  echo "❌ Commit message file not found: $FILE" >&2
  exit 1
fi

# --- Read commit message ---
COMMIT_MSG="$(cat "$FILE")"

# --- Show message ---
echo "================= COMMIT MESSAGE ================="
echo "$COMMIT_MSG"
echo "=================================================="
echo
echo "Press ENTER to continue"
echo "Press ESC or Ctrl+C to abort"

# --- Read single key ---
while true; do
  IFS= read -rsn1 key || exit 1

  case "$key" in
    "")  # Enter
      break
      ;;
    $'\e')  # ESC
      echo
      echo "❌ Aborted."
      exit 1
      ;;
    *)
      # Ignore all other keys
      ;;
  esac
done

# --- Run git commit ---
git commit -m "$COMMIT_MSG"
