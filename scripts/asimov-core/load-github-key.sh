#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage:"
  echo "  $0                         # prompt for email + hostname, then add matching key"
  echo "  $0 <email> <host>          # add matching key"
  echo "  $0 <path-to-private-key>   # add that key directly"
}

# -----------------------------
# Load optional identity file
# -----------------------------
IDENTITY_FILE="./secrets/identity.sh"

DEFAULT_EMAIL="wizards23+github@gmail.com"
DEFAULT_HOSTNAME="$(hostname)"

if [[ -f "$IDENTITY_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$IDENTITY_FILE"
fi

mangle() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/_/g; s/^_+//; s/_+$//'
}

require_cmd() {
  local c="$1"
  command -v "$c" >/dev/null 2>&1 || { echo "❌ Missing required command: $c" >&2; exit 127; }
}

# -----------------------------
# Preflight: commands
# -----------------------------
require_cmd hostname
require_cmd tr
require_cmd sed
require_cmd ssh-agent
require_cmd ssh-add

SSH_DIR="${HOME:?}/.ssh"

# -----------------------------
# Determine which key to load (no modifications yet)
# -----------------------------
KEY_PATH=""

if [[ $# -eq 1 ]]; then
  KEY_PATH="$1"
elif [[ $# -eq 0 ]]; then
  read -rp "Email [$DEFAULT_EMAIL]: " EMAIL
  EMAIL="${EMAIL:-$DEFAULT_EMAIL}"

  read -rp "Hostname [$DEFAULT_HOSTNAME]: " HOSTNAME
  HOSTNAME="${HOSTNAME:-$DEFAULT_HOSTNAME}"

  SAFE_EMAIL="$(mangle "$EMAIL")"
  SAFE_HOSTNAME="$(mangle "$HOSTNAME")"
  KEY_PATH="$SSH_DIR/github-ssh-key--${SAFE_HOSTNAME}--${SAFE_EMAIL}"
elif [[ $# -eq 2 ]]; then
  EMAIL="$1"
  HOSTNAME="$2"

  SAFE_EMAIL="$(mangle "$EMAIL")"
  SAFE_HOSTNAME="$(mangle "$HOSTNAME")"
  KEY_PATH="$SSH_DIR/github-ssh-key--${SAFE_HOSTNAME}--${SAFE_EMAIL}"
else
  usage >&2
  exit 2
fi

# Preflight: key exists
if [[ ! -f "$KEY_PATH" ]]; then
  echo "❌ Private key not found: $KEY_PATH" >&2
  echo "Available GitHub keys in $SSH_DIR:" >&2
  ls -1 "$SSH_DIR"/github-ssh-key--* 2>/dev/null || true
  exit 1
fi

# -----------------------------
# Modifications start here
# -----------------------------
# Ensure ssh-agent is usable in this shell session
if [[ -z "${SSH_AUTH_SOCK:-}" ]] || ! ssh-add -l >/dev/null 2>&1; then
  eval "$(ssh-agent -s)" >/dev/null
fi

ssh-add "$KEY_PATH"

echo "✅ Loaded key into ssh-agent: $KEY_PATH"
echo "Currently loaded keys:"
ssh-add -l || true
