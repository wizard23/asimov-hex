#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage:"
  echo "  $0                         # prompt for email + hostname (with defaults) and load matching key"
  echo "  $0 <email> <host>          # load matching key"
  echo "  $0 <path-to-private-key>   # load that key directly"
}

# ------------------------------------------------------------
# Identity defaults (match your example values/intent)
# ------------------------------------------------------------
DEFAULT_EMAIL="wizards23+github@gmail.com"
DEFAULT_HOSTNAME="$(hostname)"
DEFAULT_GITHUB_HOST_ALIAS="github-<SAFE_HOSTNAME>--<SAFE_EMAIL>"

IDENTITY_FILE="./secrets/identity.sh"

EMAIL=""
HOSTNAME=""
GITHUB_HOST_ALIAS=""

if [[ -f "$IDENTITY_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$IDENTITY_FILE"
fi

EMAIL="${EMAIL:-$DEFAULT_EMAIL}"
HOSTNAME="${HOSTNAME:-$DEFAULT_HOSTNAME}"
GITHUB_HOST_ALIAS="${GITHUB_HOST_ALIAS:-$DEFAULT_GITHUB_HOST_ALIAS}"

mangle() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/_/g; s/^_+//; s/_+$//'
}

require_cmd() {
  local c="$1"
  command -v "$c" >/dev/null 2>&1 || { echo "❌ Missing required command: $c" >&2; exit 127; }
}

# Preflight: commands
require_cmd hostname
require_cmd tr
require_cmd sed
require_cmd ssh-agent
require_cmd ssh-add
require_cmd ls

SSH_DIR="${HOME:?}/.ssh"

KEY_PATH=""

# Determine key to load (no modifications yet)
if [[ $# -eq 1 ]]; then
  KEY_PATH="$1"
elif [[ $# -eq 0 ]]; then
  read -rp "Email [$EMAIL]: " _EMAIL
  EMAIL="${_EMAIL:-$EMAIL}"

  read -rp "Hostname [$HOSTNAME]: " _HOST
  HOSTNAME="${_HOST:-$HOSTNAME}"

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

# Preflight: key exists and pair is complete
PUB_PATH="${KEY_PATH}.pub"

if [[ ! -f "$KEY_PATH" ]]; then
  echo "❌ Private key not found: $KEY_PATH" >&2
  echo "Available GitHub keys in $SSH_DIR:" >&2
  ls -1 "$SSH_DIR"/github-ssh-key--* 2>/dev/null || true
  exit 1
fi

if [[ ! -f "$PUB_PATH" ]]; then
  echo "❌ Refusing to proceed: public key is missing for: $KEY_PATH" >&2
  echo "   Expected: $PUB_PATH" >&2
  exit 4
fi

# Modifications start here
if [[ -z "${SSH_AUTH_SOCK:-}" ]] || ! ssh-add -l >/dev/null 2>&1; then
  eval "$(ssh-agent -s)" >/dev/null
fi

ssh-add "$KEY_PATH"

echo "✅ Loaded key into ssh-agent: $KEY_PATH"
echo "Currently loaded keys:"
ssh-add -l || true
