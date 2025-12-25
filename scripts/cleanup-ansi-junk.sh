#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path/to/file>" >&2
  exit 1
fi

command -v ansifilter >/dev/null 2>&1 || {
  echo "Error: ansifilter not found (install it first)." >&2
  exit 1
}

input="$1"

dir="$(dirname -- "$input")"
base="$(basename -- "$input")"

if [[ "$base" == *.* ]]; then
  name="${base%.*}"
  ext="${base##*.}"
  output="$dir/$name.cleaned.$ext"
else
  output="$dir/$base.cleaned"
fi

# Strip ANSI/control sequences
ansifilter --text -- "$input" > "$output"

echo "Written: $output"
