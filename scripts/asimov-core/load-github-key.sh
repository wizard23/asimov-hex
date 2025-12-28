#!/usr/bin/env bash
set -euo pipefail

DEFAULT_EMAIL="your_email@example.com"
DEFAULT_HOSTNAME="$(hostname)"

usage() {
  echo "Usage:"
  echo "  $0                         # prompt for email + hostname, then add matching key"
  echo "  $0 <email> <host>          # add matching key"
  echo "  $0 <path-to-private-key>   # add that key directly"
}

mangle() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/_/g; s/^_+//; s/_+$//'
}

SSH_DIR="$HOME/.ssh"

# Determine which key to load
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

if [[ ! -f "$KEY_PATH" ]]; then
  echo "❌ Private key not found: $KEY_PATH" >&2
  echo "Available GitHub keys in $SSH_DIR:" >&2
  ls -1 "$SSH_DIR"/github-ssh-key--* 2>/dev/null || true
  exit 1
fi

# Ensure ssh-agent is available and running in this shell
if ! command -v ssh-agent >/dev/null 2>&1; then
  echo "❌ ssh-agent not found on PATH" >&2
  exit 1
fi

if [[ -z "${SSH_AUTH_SOCK:-}" ]] || ! ssh-add -l >/dev/null 2>&1; then
  # Start a new agent for this shell session
  eval "$(ssh-agent -s)" >/dev/null
fi

# Add the key (prompts for passphrase if set)
ssh-add "$KEY_PATH"

echo "✅ Loaded key into ssh-agent: $KEY_PATH"
echo "Currently loaded keys:"
ssh-add -l || true
