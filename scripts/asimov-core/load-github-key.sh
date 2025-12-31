#!/usr/bin/env bash
# shellcheck shell=bash
# loads a selected GitHub SSH key into the current shell’s ssh-agent
# Must be sourced: it needs to set SSH_AUTH_SOCK / start ssh-agent in this shell.


# --------------------------------------------------------------------
# Guard 1: ensure we are running in bash
# --------------------------------------------------------------------
if [ -z "${BASH_VERSION:-}" ]; then
  echo "❌ This script must be sourced from a bash shell." >&2
  
  # If the script was sourced, `return` cleanly stops execution of the sourced file
  # without killing the user's shell.
  # If the script was executed, `return` is invalid and fails, so we fall back to
  # `exit 1` to terminate the process. stderr is silenced to avoid a confusing
  # "return: can only return from a function or sourced script" message.
  #
  # TLDNR: `return` stops a sourced script; if executed, it fails and we fall back to `exit`
  return 1 2>/dev/null || exit 1
fi

# --------------------------------------------------------------------
# Guard 2: ensure the script is sourced, not executed
# --------------------------------------------------------------------
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "❌ This script must be sourced, not executed." >&2
  echo "   Use: source '${BASH_SOURCE[0]}'" >&2
  
  return 1 2>/dev/null || exit 1
fi


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
#DEFAULT_GITHUB_HOST_ALIAS="github-<SAFE_HOSTNAME>-<SAFE_EMAIL>"

IDENTITY_FILE="./secrets/identity.env"

EMAIL=""
HOSTNAME=""
#GITHUB_HOST_ALIAS=""

if [[ -f "$IDENTITY_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$IDENTITY_FILE"
fi

EMAIL="${EMAIL:-$DEFAULT_EMAIL}"
HOSTNAME="${HOSTNAME:-$DEFAULT_HOSTNAME}"
#GITHUB_HOST_ALIAS="${GITHUB_HOST_ALIAS:-$DEFAULT_GITHUB_HOST_ALIAS}"

mangle() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/_/g; s/^_+//; s/_+$//'
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ Missing required command: $1" >&2
    return 127
  }
}

require_cmd ssh-agent || return $?
require_cmd ssh-add   || return $?
require_cmd tr        || return $?
require_cmd sed       || return $?

SSH_DIR="$HOME/.ssh"
KEY_PATH=""

# Resolve key path
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

# Validate keypair completeness
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

# Start / attach ssh-agent (in THIS shell)
if [[ -z "${SSH_AUTH_SOCK:-}" ]]; then
  eval "$(ssh-agent -s)" >/dev/null || {
    echo "❌ Failed to start ssh-agent" >&2
    return 1
  }
else
  # If SSH_AUTH_SOCK is set but unusable, start a fresh agent
  ssh-add -l >/dev/null 2>&1 || {
    eval "$(ssh-agent -s)" >/dev/null || {
      echo "❌ Failed to start ssh-agent" >&2
      return 1
    }
  }
fi

# Add key
ssh-add "$KEY_PATH" || return $?

echo "✅ Key loaded into ssh-agent:"
ssh-add -l || true
