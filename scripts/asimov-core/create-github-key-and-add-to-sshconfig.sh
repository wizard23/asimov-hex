#!/usr/bin/env bash
set -euo pipefail

DEFAULT_EMAIL="your_email@example.com"
DEFAULT_HOSTNAME="$(hostname)"

usage() {
  echo "Usage:"
  echo "  $0                 # prompt for email + hostname"
  echo "  $0 <email> <host>  # use provided email + host"
}

if [[ $# -eq 0 ]]; then
  read -rp "Email [$DEFAULT_EMAIL]: " EMAIL
  EMAIL="${EMAIL:-$DEFAULT_EMAIL}"

  read -rp "Hostname [$DEFAULT_HOSTNAME]: " HOSTNAME
  HOSTNAME="${HOSTNAME:-$DEFAULT_HOSTNAME}"
elif [[ $# -eq 2 ]]; then
  EMAIL="$1"
  HOSTNAME="$2"
else
  usage >&2
  exit 2
fi

mangle() {
  # filename-safe: lowercase, replace runs of unsafe chars with _
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/_/g; s/^_+//; s/_+$//'
}

SAFE_EMAIL="$(mangle "$EMAIL")"
SAFE_HOSTNAME="$(mangle "$HOSTNAME")"

SSH_DIR="$HOME/.ssh"
KEY_BASE="$SSH_DIR/github-ssh-key--${SAFE_HOSTNAME}--${SAFE_EMAIL}"
PUB_KEY="${KEY_BASE}.pub"
CONFIG_FILE="$SSH_DIR/config"

# Unique host alias so we don't clobber an existing "Host github.com" setup
HOST_ALIAS="github-${SAFE_HOSTNAME}--${SAFE_EMAIL}"

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

# Create key if it doesn't exist
if [[ -f "$KEY_BASE" || -f "$PUB_KEY" ]]; then
  echo "Key already exists:"
  echo "  $KEY_BASE"
  echo "  $PUB_KEY"
else
  ssh-keygen -t ed25519 -C "$EMAIL" -f "$KEY_BASE"
fi

# Ensure config exists with safe permissions
touch "$CONFIG_FILE"
chmod 600 "$CONFIG_FILE"

# Add config block if missing
if grep -qE "^[[:space:]]*Host[[:space:]]+${HOST_ALIAS}([[:space:]]|\$)" "$CONFIG_FILE"; then
  echo "SSH config already contains Host block: $HOST_ALIAS"
else
  {
    echo ""
    echo "# GitHub key for ${EMAIL} on ${HOSTNAME}"
    echo "Host ${HOST_ALIAS}"
    echo "  HostName github.com"
    echo "  User git"
    echo "  IdentityFile ${KEY_BASE}"
    echo "  IdentitiesOnly yes"
  } >> "$CONFIG_FILE"
  echo "Added SSH config Host block: $HOST_ALIAS"
fi

echo
echo "✅ Done."
echo "Private key: $KEY_BASE"
echo "Public key : $PUB_KEY"
echo "SSH config : $CONFIG_FILE"
echo
echo "To use this key with git, use the host alias in the remote:"
echo "  git clone git@${HOST_ALIAS}:OWNER/REPO.git"
echo
echo "To test:"
echo "  ssh -T git@${HOST_ALIAS}"
