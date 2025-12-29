#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage:"
  echo "  $0"
  echo "  $0 <email> <hostname>"
  echo "  $0 <path-to-private-key>"
}

# ------------------------------------------------------------
# Defaults
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

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
mangle() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/_/g; s/^_+//; s/_+$//'
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing required command: $1" >&2; exit 127; }
}

require_cmd ssh-agent
require_cmd ssh-add

SSH_DIR="$HOME/.ssh"

# ------------------------------------------------------------
# Resolve key path
# ------------------------------------------------------------
if [[ $# -eq 1 ]]; then
  KEY_PATH="$1"
elif [[ $# -eq 2 ]]; then
  EMAIL="$1"
  HOSTNAME="$2"
  SAFE_EMAIL="$(mangle "$EMAIL")"
  SAFE_HOSTNAME="$(mangle "$HOSTNAME")"
  KEY_PATH="$SSH_DIR/github-ssh-key--${SAFE_HOSTNAME}--${SAFE_EMAIL}"
else
  read -rp "Email [$EMAIL]: " TMP && EMAIL="${TMP:-$EMAIL}"
  read -rp "Hostname [$HOSTNAME]: " TMP && HOSTNAME="${TMP:-$HOSTNAME}"
  SAFE_EMAIL="$(mangle "$EMAIL")"
  SAFE_HOSTNAME="$(mangle "$HOSTNAME")"
  KEY_PATH="$SSH_DIR/github-ssh-key--${SAFE_HOSTNAME}--${SAFE_EMAIL}"
fi

# ------------------------------------------------------------
# Validate keypair
# ------------------------------------------------------------
if [[ ! -f "$KEY_PATH" ]]; then
  echo "❌ Private key not found: $KEY_PATH" >&2
  echo "Available GitHub keys in $SSH_DIR:" >&2
  ls -1 "$SSH_DIR"/github-ssh-key--* 2>/dev/null || true
  exit 1
fi

if [[ ! -f "${KEY_PATH}.pub" ]]; then
  echo "❌ Public key missing: ${KEY_PATH}.pub" >&2
  exit 1
fi

# ------------------------------------------------------------
# Load key
# ------------------------------------------------------------
if [[ -z "${SSH_AUTH_SOCK:-}" ]] || ! ssh-add -l >/dev/null 2>&1; then
  eval "$(ssh-agent -s)" >/dev/null
fi

ssh-add "$KEY_PATH"

echo "✅ Loaded key into ssh-agent:"
ssh-add -l
