#!/usr/bin/env bash
# Must be sourced: it sets SSH_AUTH_SOCK / starts ssh-agent for *this* shell.

# --- detect whether we are being sourced ---
__IS_SOURCED=1
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  __IS_SOURCED=0
fi

# --- if sourced, preserve the caller's shell options and restore them on return ---
# This prevents "set -euo pipefail" from leaking into your interactive shell.
if [[ $__IS_SOURCED -eq 1 ]]; then
  __OLD_SET_OPTS="$(set +o)"    # prints commands that restore current set -o flags
  __restore_opts() { eval "$__OLD_SET_OPTS"; }
  # RETURN runs when a sourced script finishes (bash).
  trap '__restore_opts' RETURN
fi

# If executed, refuse politely (and do NOT use `return`).
if [[ $__IS_SOURCED -eq 0 ]]; then
  echo "❌ This script must be sourced, not executed."
  echo "Use:  source ${BASH_SOURCE[0]}"
  exit 1
fi

# From here on: safe to use strict mode because we restore it afterwards.
set -euo pipefail

usage() {
  echo "Usage:"
  echo "  source ${BASH_SOURCE[0]}"
  echo "  source ${BASH_SOURCE[0]} <email> <hostname>"
  echo "  source ${BASH_SOURCE[0]} <path-to-private-key>"
}

# ------------------------------------------------------------
# Identity defaults
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
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/_/g; s/^_+//; s/_+$//'
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ Missing required command: $1" >&2
    return 127
  }
}

require_cmd ssh-agent
require_cmd ssh-add

SSH_DIR="$HOME/.ssh"

# Resolve key path
KEY_PATH=""
if [[ $# -eq 1 ]]; then
  KEY_PATH="$1"
elif [[ $# -eq 2 ]]; then
  EMAIL="$1"
  HOSTNAME="$2"
  SAFE_EMAIL="$(mangle "$EMAIL")"
  SAFE_HOSTNAME="$(mangle "$HOSTNAME")"
  KEY_PATH="$SSH_DIR/github-ssh-key--${SAFE_HOSTNAME}--${SAFE_EMAIL}"
elif [[ $# -eq 0 ]]; then
  read -rp "Email [$EMAIL]: " TMP && EMAIL="${TMP:-$EMAIL}"
  read -rp "Hostname [$HOSTNAME]: " TMP && HOSTNAME="${TMP:-$HOSTNAME}"
  SAFE_EMAIL="$(mangle "$EMAIL")"
  SAFE_HOSTNAME="$(mangle "$HOSTNAME")"
  KEY_PATH="$SSH_DIR/github-ssh-key--${SAFE_HOSTNAME}--${SAFE_EMAIL}"
else
  usage
  return 2
fi

# Validate keypair
if [[ ! -f "$KEY_PATH" ]]; then
  echo "❌ Private key not found: $KEY_PATH" >&2
  echo "Available GitHub keys in $SSH_DIR:" >&2
  ls -1 "$SSH_DIR"/github-ssh-key--* 2>/dev/null || true
  return 1
fi
if [[ ! -f "${KEY_PATH}.pub" ]]; then
  echo "❌ Public key missing: ${KEY_PATH}.pub" >&2
  echo "Private key without a public key! Broken keypair detected!"
  return 1
fi

# ------------------------------------------------------------
# Start / attach ssh-agent
# ------------------------------------------------------------
if [[ -z "${SSH_AUTH_SOCK:-}" ]] || ! ssh-add -l >/dev/null 2>&1; then
  eval "$(ssh-agent -s)" >/dev/null
fi

ssh-add "$KEY_PATH"

echo "✅ Key loaded into ssh-agent:"
ssh-add -l || true
