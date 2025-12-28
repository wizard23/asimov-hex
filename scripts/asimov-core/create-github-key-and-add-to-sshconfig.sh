#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage:"
  echo "  $0                 # prompt for email + hostname"
  echo "  $0 <email> <host>  # use provided email + host"
}

# -----------------------------
# Load optional identity file
# -----------------------------
IDENTITY_FILE="./secrets/identity.sh"

# Defaults if identity file not present
DEFAULT_EMAIL="your_email@example.com"
DEFAULT_HOSTNAME="$(hostname)"
HOST_ALIAS=""  # may be set by identity.sh; if empty we'll derive

if [[ -f "$IDENTITY_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$IDENTITY_FILE"
fi

# -----------------------------
# Parse args / prompt
# -----------------------------
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

# -----------------------------
# Helpers
# -----------------------------
mangle() {
  # filename-safe: lowercase, replace runs of unsafe chars with _
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
require_cmd grep
require_cmd ssh-keygen
require_cmd mkdir
require_cmd chmod
require_cmd touch

# -----------------------------
# Compute safe names / paths
# -----------------------------
SAFE_EMAIL="$(mangle "$EMAIL")"
SAFE_HOSTNAME="$(mangle "$HOSTNAME")"

SSH_DIR="${HOME:?}/.ssh"
KEY_BASE="$SSH_DIR/github-ssh-key--${SAFE_HOSTNAME}--${SAFE_EMAIL}"
PUB_KEY="${KEY_BASE}.pub"
CONFIG_FILE="$SSH_DIR/config"

# Host alias rules:
# - If HOST_ALIAS is set in identity.sh, use it
#   and substitute <SAFE_HOSTNAME> / <SAFE_EMAIL> if present
# - Else default to a unique alias (safe multi-key approach)
if [[ -n "${HOST_ALIAS:-}" ]]; then
  HOST_ALIAS_RENDERED="${HOST_ALIAS//<SAFE_HOSTNAME>/${SAFE_HOSTNAME}}"
  HOST_ALIAS_RENDERED="${HOST_ALIAS_RENDERED//<SAFE_EMAIL>/${SAFE_EMAIL}}"
else
  HOST_ALIAS_RENDERED="github-${SAFE_HOSTNAME}--${SAFE_EMAIL}"
fi

# -----------------------------
# Preflight: filesystem checks (NO modifications yet)
# -----------------------------
# Can we create ~/.ssh if needed?
if [[ -e "$SSH_DIR" && ! -d "$SSH_DIR" ]]; then
  echo "❌ $SSH_DIR exists but is not a directory." >&2
  exit 1
fi
if [[ ! -e "$SSH_DIR" ]]; then
  # check we can write to $HOME
  if [[ ! -w "$HOME" ]]; then
    echo "❌ Cannot create $SSH_DIR (HOME is not writable): $HOME" >&2
    exit 1
  fi
else
  if [[ ! -w "$SSH_DIR" ]]; then
    echo "❌ $SSH_DIR is not writable: $SSH_DIR" >&2
    exit 1
  fi
fi

# Determine what actions are needed
NEED_KEYGEN=0
if [[ -f "$KEY_BASE" || -f "$PUB_KEY" ]]; then
  NEED_KEYGEN=0
else
  NEED_KEYGEN=1
fi

CONFIG_EXISTS=0
if [[ -f "$CONFIG_FILE" ]]; then
  CONFIG_EXISTS=1
fi

HOST_BLOCK_EXISTS=0
if [[ $CONFIG_EXISTS -eq 1 ]]; then
  if grep -qE "^[[:space:]]*Host[[:space:]]+${HOST_ALIAS_RENDERED}([[:space:]]|\$)" "$CONFIG_FILE"; then
    HOST_BLOCK_EXISTS=1
  fi
fi

NEED_CONFIG_UPDATE=0
if [[ $HOST_BLOCK_EXISTS -eq 1 ]]; then
  NEED_CONFIG_UPDATE=0
else
  NEED_CONFIG_UPDATE=1
fi

# If we need to update config but it doesn't exist yet, verify we can create it
if [[ $NEED_CONFIG_UPDATE -eq 1 && $CONFIG_EXISTS -eq 0 ]]; then
  # If ~/.ssh doesn't exist yet, we already checked HOME is writable.
  # If ~/.ssh exists, we already checked it's writable.
  :
fi

# -----------------------------
# Now perform actions (modifications start here)
# -----------------------------
# Ensure ~/.ssh exists (only now)
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

# Create key if needed
if [[ $NEED_KEYGEN -eq 1 ]]; then
  ssh-keygen -t ed25519 -C "$EMAIL" -f "$KEY_BASE"
else
  echo "Key already exists:"
  echo "  $KEY_BASE"
  echo "  $PUB_KEY"
fi

# Update config if needed
if [[ $NEED_CONFIG_UPDATE -eq 0 ]]; then
  echo "SSH config already contains Host block: $HOST_ALIAS_RENDERED"
else
  # Create config file if missing (only now)
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
  } >> "$CONFIG_FILE"

  echo "Added SSH config Host block: $HOST_ALIAS_RENDERED"
fi

echo
echo "✅ Done."
echo "Private key: $KEY_BASE"
echo "Public key : $PUB_KEY"
echo "SSH config : $CONFIG_FILE"
echo "Host alias : $HOST_ALIAS_RENDERED"
echo
echo "To test:"
echo "  ssh -T git@${HOST_ALIAS_RENDERED}"
echo
echo "To clone using this key:"
echo "  git clone git@${HOST_ALIAS_RENDERED}:OWNER/REPO.git"
