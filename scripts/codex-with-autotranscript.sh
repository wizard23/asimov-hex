#!/usr/bin/env bash
set -euo pipefail

# Directory where transcripts will be stored
TRANSCRIPT_DIR="${TRANSCRIPT_DIR:-docs/transcripts-buffer/codex}"

# Command to run inside `script`
CODEX_CMD="${CODEX_CMD:-codex}"

# Timestamped output file
TIMESTAMP="$(date +%F-%H%M)"
OUT_FILE="$TRANSCRIPT_DIR/codex-$TIMESTAMP.log"

# Ensure output directory exists
mkdir -p "$TRANSCRIPT_DIR"

# Record the session quietly (-q)
exec script -q "$OUT_FILE" -c "$CODEX_CMD"
