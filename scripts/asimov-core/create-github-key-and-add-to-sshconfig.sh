#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage:"
  echo "  $0"
  echo "  $0 <email> <hostname> <github-host-alias>"
}

# ------------------------------------------------------------
# Defaults (exactly as requested)
# ------------------------------------------------------------
DEFAULT_EMAIL="wizards23+github@gmail.com"
DEFAULT_HOSTNAME="$(hostname)"
DEFAULT_GITHUB_HOST_ALIAS="github-<SAFE_HOSTNAME>--<SAFE_EMAIL>"

IDENTITY_FILE="./secrets/identity.sh"

EMAIL=""
HOSTNAME=""
GITHUB_HOST_ALIAS=""

# ------------------------------------------------------------
# Load identity file if present
# ------------------------------------------------------------
if [[ -f "$IDENTITY_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$IDENTITY_FILE"
fi

EMAIL="${EMAIL:-$DEFAULT_EMAIL}"
HOSTNAME="${HOSTNAME:-$DEFAULT_HOSTNAME}"
GITHUB_HOST_ALIAS="${GITHUB_HOST_ALIAS:-$DEFAULT_GITHUB_HOST_ALIAS}"

# ------------------------------------------------------------
# CLI args override identity defaults
# ------------------------------------------------------------
if [[ $# -eq 3 ]]; then
  EMAIL="$1"
  HOSTNAME="$2"
  GITHUB_HOST_ALIAS="$3"
elif [[ $# -ne 0 ]]; then
  usage >&2
  exit 2
fi

# ------------------------------------------------------------
# Prompt user (final chance)
# ------------------------------------------------------------
read -rp "Email [$EMAIL]: " TMP && EMAIL="${TMP:-$EMAIL}"
read -rp "Hostname [$HOSTNAME]: " TMP && HOSTNAME="${TMP:-$HOSTNAME}"
read -rp "GitHub host alias [$GITHUB_HOST_ALIAS]: " TMP && GITHUB_HOST_ALIAS="${TMP:-$GITHUB_HOST_ALIAS}"

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
mangle() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/_/g; s/^_+//; s/_+$//'
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ Missing required command: $1" >&2
    exit 127
  }
}

# ------------------------------------------------------------
# Preflight
# ------------------------------------------------------------
require_cmd ssh-keygen
require_cmd grep
require_cmd sed
require_cmd mkdir
require_cmd chmod

SAFE_EMAIL="$(mangle "$EMAIL")"
SAFE_HOSTNAME="$(mangle "$HOSTNAME")"

HOST_ALIAS_RENDERED="${GITHUB_HOST_ALIAS//<SAFE_HOSTNAME>/${SAFE_HOSTNAME}}"
HOST_ALIAS_RENDERED="${HOST_ALIAS_RENDERED//<SAFE_EMAIL>/${SAFE_EMAIL}}"

SSH_DIR="$HOME/.ssh"
KEY_BASE="$SSH_DIR/github-ssh-key--${SAFE_HOSTNAME}--${SAFE_EMAIL}"
PUB_KEY="$KEY_BASE.pub"
CONFIG_FILE="$SSH_DIR/config"

# ---- Filesystem sanity
if [[ -e "$SSH_DIR" && ! -d "$SSH_DIR" ]]; then
  echo "❌ $SSH_DIR exists but is not a directory" >&2
  exit 1
fi

[[ -w "$HOME" ]] || { echo "❌ HOME not writable"; exit 1; }

# ---- Broken keypair detection
PRIVATE_EXISTS=0
PUBLIC_EXISTS=0
[[ -f "$KEY_BASE" ]] && PRIVATE_EXISTS=1
[[ -f "$PUB_KEY" ]] && PUBLIC_EXISTS=1

if [[ $PRIVATE_EXISTS -ne $PUBLIC_EXISTS ]]; then
  echo "❌ Broken keypair detected:" >&2
  echo "  Private exists: $PRIVATE_EXISTS" >&2
  echo "  Public  exists: $PUBLIC_EXISTS" >&2
  exit 4
fi

# ---- Host alias collision check
if [[ -f "$CONFIG_FILE" ]]; then
  if grep -qE "^[[:space:]]*Host[[:space:]]+${HOST_ALIAS_RENDERED}([[:space:]]|\$)" "$CONFIG_FILE"; then
    echo "❌ SSH config already contains Host '${HOST_ALIAS_RENDERED}'" >&2
    echo "   Refusing to modify existing config." >&2
    exit 3
  fi
fi

# ------------------------------------------------------------
# MODIFICATIONS BEGIN
# ------------------------------------------------------------
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [[ $PRIVATE_EXISTS -eq 0 ]]; then
  ssh-keygen -t ed25519 -C "$EMAIL" -f "$KEY_BASE"
else
  echo "Key already exists:"
  echo "  $KEY_BASE"
  echo "  $PUB_KEY"
fi

touch "$CONFIG_FILE"
chmod 600 "$CONFIG_FILE"

{
  echo ""
  echo "# GitHub key for ${EMAIL} on ${HOSTNAME}"
  echo "Host ${HOST_ALIAS_RENDERED}"
  echo "  HostName github.com"
  echo "  User git"
  echo "  IdentityFile ${KEY_BASE}"
  echo "  IdentitiesOnly yes"
} >>"$CONFIG_FILE"

echo
echo "✅ Key + SSH config created"
echo "  Host alias : $HOST_ALIAS_RENDERED"
echo "  Private key: $KEY_BASE"
echo "  Public key : $PUB_KEY"
echo
echo "Test with:"
echo "  ssh -T git@${HOST_ALIAS_RENDERED}"
