#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
COVERAGE_DIR="$PROJECT_ROOT/public/coverage"
CSS_FILE="$COVERAGE_DIR/coverage-dark.css"

if [[ ! -d "$COVERAGE_DIR" ]]; then
  echo "ERROR: coverage directory not found at: $COVERAGE_DIR"
  echo "Run: npm run test-coverage"
  exit 1
fi

cat > "$CSS_FILE" <<'EOF'
:root {
  color-scheme: dark;
}

html {
  filter: invert(1) hue-rotate(180deg);
}

body {
  background: #ffffff;
  color: #000000;
}

img,
video,
canvas,
svg {
  filter: invert(1) hue-rotate(180deg);
}

.high,
.medium,
.low,
.cline-no,
.fstat-no,
.cstat-no,
.stmt-no,
.branch-no,
.cline-yes,
.fstat-yes,
.cstat-yes,
.stmt-yes,
.branch-yes,
.missing-if-branch {
  filter: invert(1) hue-rotate(180deg);
}
EOF

mapfile -t html_files < <(find "$COVERAGE_DIR" -type f -name '*.html')

for html_file in "${html_files[@]}"; do
  if rg -q "coverage-dark.css" "$html_file"; then
    continue
  fi

  html_dir="$(dirname "$html_file")"
  rel_path="$(node -e "const path=require('path'); console.log(path.relative(process.argv[1], process.argv[2]).replace(/\\\\/g, '/'));" "$html_dir" "$CSS_FILE")"

  perl -0pi -e "s#</head>#  <link rel=\"stylesheet\" href=\"$rel_path\">\\n</head>#i" "$html_file"
done
