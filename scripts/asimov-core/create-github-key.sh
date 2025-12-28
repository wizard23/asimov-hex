#!/usr/bin/env bash
set -euo pipefail

# Defaults
DEFAULT_EMAIL="your_email@example.com"
DEFAULT_HOSTNAME="$(hostname)"

# Get parameters or prompt
if [[ $# -ge 2 ]]; then
  EMAIL="$1"
  HOSTNAME="$2"
else
  read -rp "Email [$DEFAULT_EMAIL]: " EMAIL
  EMAIL="${EMAIL:-$DEFAULT_EMAIL}"

  read -rp "Hostname [$DEFAULT_HOSTNAME]: " HOSTNAME
  HOSTNAME="${HOSTNAME:-$DEFAULT_HOSTNAME}"
fi

# Function to make a value filename-safe
mangle() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/_/g'
}

SAFE_EMAIL="$(mangle "$EMAIL")"
SAFE_HOSTNAME="$(mangle "$HOSTNAME")"

KEY_BASE="$HOME/.ssh/github-ssh-key--${SAFE_HOSTNAME}--${SAFE_EMAIL}"

# Ensure ~/.ssh exists
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

# Generate the key
ssh-keygen -t ed25519 -C "$EMAIL" -f "$KEY_BASE"

echo
echo "✅ SSH key created:"
echo "  Private key: $KEY_BASE"
echo "  Public key:  $KEY_BASE.pub"
