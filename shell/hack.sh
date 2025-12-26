### must be sourced not executed since this is meant to setup the shell

# This script modifies the current shell and must be sourced.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Error: this script must be sourced, not executed." >&2
  echo "Usage: source ${BASH_SOURCE[0]}" >&2

  # If the script was sourced, `return` cleanly stops execution of the sourced file
  # without killing the user's shell.
  # If the script was executed, `return` is invalid and fails, so we fall back to
  # `exit 1` to terminate the process. stderr is silenced to avoid a confusing
  # "return: can only return from a function or sourced script" message.
  #
  # TLDNR: `return` stops a sourced script; if executed, it fails and we fall back to `exit`
  return 1 2>/dev/null || exit 1
fi

. ./shell/completions/npm-workspaces.sh 
. ~/hack.sh
