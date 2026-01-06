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
  background: #ffffff; /* global-invert base (light -> dark) */
  color: #000000; /* global-invert base (light -> dark) */
}

img,
video,
canvas,
svg {
  filter: invert(1) hue-rotate(180deg);
}

.low,
.medium,
.high,
.cline-no,
.cline-yes,
.cstat-no,
.fstat-no,
.cstat-yes,
.cbranch-no,
.status-line.low,
.status-line.medium,
.status-line.high,
.low .cover-fill,
.medium .cover-fill,
.high .cover-fill,
.low .chart,
.medium .chart,
.high .chart,
.red.solid,
.highlighted,
.highlighted .cstat-no,
.highlighted .fstat-no,
.highlighted .cbranch-no,
.missing-if-branch {
  filter: invert(1) hue-rotate(180deg);
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

.missing-if-branch {
  background: #cccccc; /* pseudo-invert (HSL L flip) of #333333 */
  color: #ffff00; /* pseudo-invert (HSL L flip) of #ffff00 */
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
