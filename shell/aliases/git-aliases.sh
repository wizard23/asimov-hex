### must be sourced not executed since this is meant to modify aliases

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


alias ga='git add '
alias gb='git branch '
alias gca='git commit -a -v '
alias gc='git commit'
alias gcl='git clone '
alias gco='git checkout '
alias gd='git diff'
alias gh='git log --pretty=format:"%h %ad | %s%d [%an]" --graph --date=short'
alias gl2="git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit -p"
alias gl3="git log --graph --abbrev-commit --decorate --format=format:'%C(bold blue)%h%C(reset) - %C(bold green)(%ar)%C(reset) %C(white)%s%C(reset) %C(dim white)- %an%C(reset)%C(bold yellow)%d%C(reset)' --all"
alias gl4="git log --graph --abbrev-commit --decorate --format=format:'%C(bold blue)%h%C(reset) - %C(bold cyan)%aD%C(reset) %C(bold green)(%ar)%C(reset)%C(bold yellow)%d%C(reset)%n''          %C(white)%s%C(reset) %C(dim white)- %an%C(reset)' --all"
alias gl5="git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
#alias gl='git log '
alias gl="git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
alias gll="git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit -p"

## all branches colored
alias gla="git log --all --graph --decorate --date=format:'%Y-%m-%d %H:%M' --pretty=format:'%C(yellow)%h%Creset %C(cyan)%ad%Creset %C(auto)%d %s'"
alias gla2="git log --all --graph --decorate --date=format:'%Y-%m-%d %H:%M' --pretty=format:'%C(auto)%h %ad %d %s'"

alias gp='git push'
alias gpl='git pull'
alias gps='git push'
alias gpu='git pull'
alias gs='git status '
alias gss='git for-each-ref --sort=-committerdate'


gwww() {
  if [[ -z "$1" ]]; then
    echo "Usage: gwww <branch-name>" >&2
    return 1
  fi

  local branch="$1"
  local dir="../wt/${branch//\//-}"

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git worktree add "$dir" "$branch"
  else
    git worktree add -b "$branch" "$dir"
  fi
}

