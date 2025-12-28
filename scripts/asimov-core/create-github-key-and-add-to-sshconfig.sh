#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage:"
  echo "  $0                 # prompt for email + hostname (with defaults)"
  echo "  $0 <email> <host>  # use provided email + host"
}

# ------------------------------------------------------------
# Identity defaults (must match your example exactly)
# ------------------------------------------------------------
DEFAULT_EMAIL='wizards23+github@gmail.com'
DEFAULT_HOSTNAME=''"$(hostname)"''
DEFAULT_GITHUB_HOST_ALIAS='github-<SAFE_HOSTNAME>--<SAFE_EMAIL>'

IDENTITY_FILE="./secrets/identity.sh"

# Values that may be overridden by identity.sh or args/prompts
EMAIL=""
HOSTNAME=""
GITHUB_HOST_ALIAS=""

# ------------------------------------------------------------
# Optional identity file
# ------------------------------------------------------------
if [[ -f "$IDENTITY_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$IDENTITY_FILE"
fi

# Fill missing identity values with exact defaults
EMAIL="${EMAIL:-$DEFAULT_EMAIL}"
HOSTNAME="${HOSTNAME:-$DEFAULT_HOSTNAME}"
GITHUB_HOST_ALIAS="${GITHUB_HOST_ALIAS:-$DEFAULT_GITHUB_HOST_ALIAS}"

# ------------------------------------------------------------
# Parse args / prompt
# ------------------------------------------------------------
if [[ $# -eq 0 ]]; then
  read -rp "Email [$EMAIL]: " _EMAIL
  EMAIL="${_EMAIL:-$EMAIL}"

  read -rp "Hostname [$HOSTNAME]: " _HOST
  HOSTNAME="${_HOST:-$HOSTNAME}"
elif [[ $# -eq 2 ]]; then
  EMAIL="$1"
  HOSTNAME="$2"
else
  usage >&2
  exit 2
fi

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
mangle() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/_/g; s/^_+//; s/_+$//'
}

require_cmd() {
  local c="$1"
  command -v "$c" >/dev/null 2>&1 || { echo "❌ Missing required command: $c" >&2; exit 127; }
}

# ------------------------------------------------------------
# Preflight: commands
# ------------------------------------------------------------
require_cmd hostname
require_cmd tr
require_cmd sed
require_cmd grep
require_cmd ssh-keygen
require_cmd mkdir
require_cmd chmod
require_cmd touch

# ------------------------------------------------------------
# Compute safe names / paths
# ------------------------------------------------------------
SAFE_EMAIL="$(mangle "$EMAIL")"
SAFE_HOSTNAME="$(mangle "$HOSTNAME")"

SSH_DIR="${HOME:?}/.ssh"
KEY_BASE="$SSH_DIR/github-ssh-key--${SAFE_HOSTNAME}--${SAFE_EMAIL}"
PUB_KEY="${KEY_BASE}.pub"
CONFIG_FILE="$SSH_DIR/config"

HOST_ALIAS_RENDERED="${GITHUB_HOST_ALIAS//<SAFE_HOSTNAME>/${SAFE_HOSTNAME}}"
HOST_ALIAS_RENDERED="${HOST_ALIAS_RENDERED//<SAFE_EMAIL>/${SAFE_EMAIL}}"

# ------------------------------------------------------------
# Preflight: filesystem checks (NO modifications yet)
# ------------------------------------------------------------
if [[ -e "$SSH_DIR" && ! -d "$SSH_DIR" ]]; then
  echo "❌ $SSH_DIR exists but is not a directory." >&2
  exit 1
fi

if [[ ! -e "$SSH_DIR" ]]; then
  [[ -w "$HOME" ]] || { echo "❌ Cannot create $SSH_DIR; HOME not writable: $HOME" >&2; exit 1; }
else
  [[ -w "$SSH_DIR" ]] || { echo "❌ $SSH_DIR not writable: $SSH_DIR" >&2; exit 1; }
fi

NEED_KEYGEN=1
if [[ -f "$KEY_BASE" || -f "$PUB_KEY" ]]; then
  NEED_KEYGEN=0
fi

CONFIG_EXISTS=0
if [[ -f "$CONFIG_FILE" ]]; then
  CONFIG_EXISTS=1
fi

# Refuse if host alias already exists (because we'd append it)
if [[ $CONFIG_EXISTS -eq 1 ]]; then
  if grep -qE "^[[:space:]]*Host[[:space:]]+${HOST_ALIAS_RENDERED}([[:space:]]|\$)" "$CONFIG_FILE"; then
    echo "❌ Refusing to proceed: SSH config already contains a Host block for: $HOST_ALIAS_RENDERED" >&2
    echo "   File: $CONFIG_FILE" >&2
    echo "   Choose a different GITHUB_HOST_ALIAS (or email/hostname), or remove/rename the existing block." >&2
    exit 3
  fi
fi

# If config doesn't exist, ensure we can create it (once ~/.ssh exists)
# (we already checked write permissions)
: # no-op

# ------------------------------------------------------------
# Modifications start here
# ------------------------------------------------------------
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [[ $NEED_KEYGEN -eq 1 ]]; then
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
} >> "$CONFIG_FILE"

echo "✅ Added SSH config Host block: $HOST_ALIAS_RENDERED"
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
