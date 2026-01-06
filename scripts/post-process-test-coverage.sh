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

body {
  background: #0f1216;
  color: #e6e6e6;
}

a {
  color: #8bd5ff;
}

a:hover {
  color: #b8e7ff;
}

table,
.coverage-summary,
.status-line {
  background: #11161c;
}

thead {
  background: #141a21;
}

td,
th {
  border-color: #223040;
}

pre,
code {
  background: #141a21;
  color: #e6e6e6;
}

.quiet {
  color: #9aa4b2;
}

.high {
  background: #1f3b2f;
  color: #bff0d4;
}

.medium {
  background: #3b2d1f;
  color: #f1d4a6;
}

.low {
  background: #3b1f1f;
  color: #f3b6b6;
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
