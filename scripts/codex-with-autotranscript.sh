#!/usr/bin/env bash
set -euo pipefail

# Directory where transcripts will be stored
TRANSCRIPT_DIR="${TRANSCRIPT_DIR:-docs/transcripts-buffer/codex}"

# Command to run inside `script`
CODEX_CMD="${CODEX_CMD:-codex}"

# Session label (required), Session ID (optional)
if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $(basename "$0") <session-label> [session-id]"
  exit 1
fi

RAW_LABEL="$1"
SESSION_ID="${2:-}"

if [ -n "$SESSION_ID" ]; then
  # Validate UUID format: 8-4-4-4-12 hex digits
  if ! [[ "$SESSION_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
    echo "Error: Invalid session ID format: $SESSION_ID"
    echo "Expected format (UUID): 00000000-0000-0000-0000-000000000000"
    exit 1
  fi
  CODEX_CMD="$CODEX_CMD resume $SESSION_ID"
fi
SANITIZED_LABEL="$(printf '%s' "$RAW_LABEL" | tr -cs 'A-Za-z0-9-_' '_' | sed 's/^_//;s/_$//')"

# Timestamped output file
TIMESTAMP="$(date +%F-%H%M)"
RESUME_SUFFIX=""
if [ -n "$SESSION_ID" ]; then
  RESUME_SUFFIX="--resumed-from-$SESSION_ID"
fi
OUT_FILE="$TRANSCRIPT_DIR/codex--$TIMESTAMP--$SANITIZED_LABEL$RESUME_SUFFIX.log"

# Ensure output directory exists
mkdir -p "$TRANSCRIPT_DIR"

# Let the user know where the transcript will be stored
echo "Transcript log:"
echo "$OUT_FILE"

# Record the session quietly (-q)
exec script -q "$OUT_FILE" -c "$CODEX_CMD"
