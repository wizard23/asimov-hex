### must be sourced not executed since this is meant to enable npm autocompletion

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



###-begin-npm-run-for-workspaces-hack-###
# use npm's stock completion
source <(npm completion)


# remember npm's original completion binding (function + options)
__NPM_ORIG_COMPLETE_SPEC="$(complete -p npm 2>/dev/null || true)"
__NPM_ORIG_FUNC="$(printf '%s\n' "$__NPM_ORIG_COMPLETE_SPEC" | sed -n 's/.* -F \([^ ]*\).*/\1/p')"
__NPM_ORIG_OPTS="$(printf '%s\n' "$__NPM_ORIG_COMPLETE_SPEC" | sed -n 's/^complete \(.*\) -F .*/\1/p')"
[[ -n "$__NPM_ORIG_OPTS" ]] || __NPM_ORIG_OPTS='-o default -o nospace'


# npm run completion workaround for workspace packages (use nearest package.json instead of root package.json)
# this is a known bug in npm completion in older versions of npm
# it is fixed in v11.3.0 see here: https://github.com/npm/cli/pull/8135
__npm_run_ws_complete() {
  # Only handle `npm run` / `npm run-script`
  [[ ${COMP_WORDS[1]} == "run" || ${COMP_WORDS[1]} == "run-script" ]] || return 0

  local cur pkg_dir scripts
  cur=${COMP_WORDS[COMP_CWORD]}

  # find nearest package.json (ignore workspaces root)
  pkg_dir=$(npm prefix --workspaces=false 2>/dev/null) || return 0
  [[ -f "$pkg_dir/package.json" ]] || return 0

  # Collect script names (jq preferred; Node fallback)
  if command -v jq >/dev/null 2>&1; then
    scripts=$(jq -r '.scripts // {} | keys[]' "$pkg_dir/package.json" 2>/dev/null)
  else
    scripts=$(node -e 'try{const fs=require("fs"),p=process.argv[1];const s=(JSON.parse(fs.readFileSync(p,"utf8")).scripts)||{};console.log(Object.keys(s).join("\n"))}catch{}' "$pkg_dir/package.json")
  fi

  # Generate matches for the current word
  COMPREPLY=( $(compgen -W "$scripts" -- "$cur") )
  return 0
}

# mux: only handle run/run-script; otherwise call npm's original completer
__npm_mux_npm_complete() {

  # If the cursor is on the word "run" or "run-script", first TAB will append a space
  if (( COMP_CWORD == 1 )); then
    case "${COMP_WORDS[1]}" in
      run|run-script)
        # Allow Bash to insert a space after completion
        COMPREPLY=( "${COMP_WORDS[1]}" )
        return 0
        ;;
    esac
  fi

  # inject our completer for "run" and "run-script" only
  if [[ ${COMP_WORDS[1]} == "run" || ${COMP_WORDS[1]} == "run-script" ]]; then
    __npm_run_ws_complete
  elif [[ -n "$__NPM_ORIG_FUNC" ]] && declare -F "$__NPM_ORIG_FUNC" >/dev/null; then
    "$__NPM_ORIG_FUNC"
  fi
}


# rebind using the SAME options npm set originally (e.g., -o default -o nospace)
eval "complete $__NPM_ORIG_OPTS -F __npm_mux_npm_complete npm"
###-end-npm-run-for-workspaces-hack-###