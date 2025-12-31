#!/usr/bin/env bash
set -euo pipefail

# Directory where transcripts will be stored
TRANSCRIPT_DIR="${TRANSCRIPT_DIR:-docs/transcripts-buffer/codex}"

# Command to run inside `script`
CODEX_CMD="${CODEX_CMD:-codex}"

# Session label (required)
if [ "$#" -ne 1 ]; then
  echo "Usage: $(basename "$0") <session-label>"
  exit 1
fi

RAW_LABEL="$1"
SANITIZED_LABEL="$(printf '%s' "$RAW_LABEL" | tr -cs 'A-Za-z0-9-_' '_' | sed 's/^_//;s/_$//')"

# Timestamped output file
TIMESTAMP="$(date +%F-%H%M)"
OUT_FILE="$TRANSCRIPT_DIR/codex-$SANITIZED_LABEL-$TIMESTAMP.log"

# Ensure output directory exists
mkdir -p "$TRANSCRIPT_DIR"

# Let the user know where the transcript will be stored
echo "Transcript log:"
echo "$OUT_FILE"

# Record the session quietly (-q)
exec script -q "$OUT_FILE" -c "$CODEX_CMD"
