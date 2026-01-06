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
  background: #000000; /* pseudo-invert (HSL L flip) of #ffffff */
  color: #cccccc; /* pseudo-invert (HSL L flip) of #333333 */
}

a {
  color: #269aff; /* pseudo-invert (HSL L flip) of #0074D9 */
}

a:hover {
  color: #269aff; /* pseudo-invert (HSL L flip) of #0074D9 */
}

.quiet {
  color: rgba(255, 255, 255, 0.5); /* pseudo-invert (HSL L flip) of rgba(0,0,0,0.5) */
}

.fraction {
  color: #aaaaaa; /* pseudo-invert (HSL L flip) of #555555 */
  background: #171717; /* pseudo-invert (HSL L flip) of #E8E8E8 */
}

div.path a:link,
div.path a:visited {
  color: #cccccc; /* pseudo-invert (HSL L flip) of #333333 */
}

table.coverage td {
  color: #cccccc; /* pseudo-invert (HSL L flip) of #333333 */
}

.coverage-summary tr {
  border-bottom: 1px solid #444444; /* pseudo-invert (HSL L flip) of #bbbbbb */
}

.coverage-summary td.empty {
  color: #777777; /* pseudo-invert (HSL L flip) of #888888 */
}

span.cline-neutral {
  background: #151515; /* pseudo-invert (HSL L flip) of #eaeaea */
}

.cstat-skip,
.fstat-skip,
.cbranch-skip {
  background: #222222; /* pseudo-invert (HSL L flip) of #dddddd */
  color: #eeeeee; /* pseudo-invert (HSL L flip) of #111111 */
}

.missing-if-branch {
  background: #cccccc; /* pseudo-invert (HSL L flip) of #333333 */
  color: #ffff00; /* pseudo-invert (HSL L flip) of #ffff00 */
}

.skip-if-branch {
  background: #333333; /* pseudo-invert (HSL L flip) of #cccccc */
  color: #000000; /* pseudo-invert (HSL L flip) of #ffffff */
}

.cover-empty {
  background: #000000; /* pseudo-invert (HSL L flip) of #ffffff */
}

.com,
.ignore-none {
  color: #666666; /* pseudo-invert (HSL L flip) of #999999 */
}

.cbranch-no {
  background: #ffff00; /* pseudo-invert (HSL L flip) of #ffff00 */
  color: #eeeeee; /* pseudo-invert (HSL L flip) of #111111 */
}

.red.solid,
.status-line.low,
.low .cover-fill,
.highlighted,
.highlighted .cstat-no,
.highlighted .fstat-no,
.highlighted .cbranch-no {
  background: #e03d57; /* pseudo-invert (HSL L flip) of #C21F39 */
}

.low .chart {
  border-color: #e03d57; /* pseudo-invert (HSL L flip) of #C21F39 */
}

.cstat-no,
.fstat-no {
  background: #390911; /* pseudo-invert (HSL L flip) of #F6C6CE */
  color: #eeeeee; /* pseudo-invert (HSL L flip) of #111111 */
}

.low,
.cline-no {
  background: #1e0307; /* pseudo-invert (HSL L flip) of #FCE1E5 */
  color: #eeeeee; /* pseudo-invert (HSL L flip) of #111111 */
}

.high,
.cline-yes {
  background: #202f0a; /* pseudo-invert (HSL L flip) of #E6F5D0 */
  color: #eeeeee; /* pseudo-invert (HSL L flip) of #111111 */
}

.cstat-yes {
  background: #5f9528; /* pseudo-invert (HSL L flip) of #A1D76A */
  color: #eeeeee; /* pseudo-invert (HSL L flip) of #111111 */
}

.status-line.high,
.high .cover-fill {
  background: #99de6d; /* pseudo-invert (HSL L flip) of #4D9221 */
}

.high .chart {
  border-color: #99de6d; /* pseudo-invert (HSL L flip) of #4D9221 */
}

.status-line.medium,
.medium .cover-fill {
  background: #f4c806; /* pseudo-invert (HSL L flip) of #F9CD0B */
}

.medium .chart {
  border-color: #f4c806; /* pseudo-invert (HSL L flip) of #F9CD0B */
}

.medium {
  background: #3d3200; /* pseudo-invert (HSL L flip) of #FFF4C2 */
  color: #eeeeee; /* pseudo-invert (HSL L flip) of #111111 */
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
