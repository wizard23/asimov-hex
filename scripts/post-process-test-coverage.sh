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
/*
 * Coverage report post-processing
 * Colors are pseudo-inverted by flipping HSL lightness in-place in CSS files.
 */
:root {
  color-scheme: dark;
}
EOF

mapfile -t css_files < <(find "$COVERAGE_DIR" -type f -name '*.css')
for css_file in "${css_files[@]}"; do
  if [[ "$css_file" == "$CSS_FILE" ]]; then
    continue
  fi

  node - "$css_file" <<'NODE'
const fs = require('fs');
const filePath = process.argv[2];
const css = fs.readFileSync(filePath, 'utf8');

const namedColors = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  yellow: [255, 255, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
};

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function invertRgb(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);
  const inverted = hslToRgb(h, s, 1 - l);
  return inverted;
}

function toHex(r, g, b) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(hex) {
  const clean = hex.toLowerCase();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
      a: null,
    };
  }
  if (clean.length === 4) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
      a: clean[3] + clean[3],
    };
  }
  if (clean.length === 6 || clean.length === 8) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
      a: clean.length === 8 ? clean.slice(6, 8) : null,
    };
  }
  return null;
}

function replaceColors(value) {
  let output = value;

  output = output.replace(/#([0-9a-fA-F]{3,8})\b/g, (match, hex) => {
    const parsed = parseHex(hex);
    if (!parsed) return match;
    const inverted = invertRgb(parsed.r, parsed.g, parsed.b);
    const rgbHex = toHex(inverted.r, inverted.g, inverted.b);
    if (parsed.a) {
      return `${rgbHex}${parsed.a}`;
    }
    return rgbHex;
  });

  output = output.replace(/rgba?\(([^)]+)\)/gi, (match, inner) => {
    const parts = inner.split(',').map((part) => part.trim());
    if (parts.length < 3) return match;
    const toChannel = (value) => {
      if (value.endsWith('%')) {
        const pct = parseFloat(value);
        if (Number.isNaN(pct)) return null;
        return Math.round((pct / 100) * 255);
      }
      const num = parseFloat(value);
      if (Number.isNaN(num)) return null;
      return Math.round(num);
    };
    const r = toChannel(parts[0]);
    const g = toChannel(parts[1]);
    const b = toChannel(parts[2]);
    if (r === null || g === null || b === null) return match;
    const inverted = invertRgb(r, g, b);
    const alpha = parts[3] !== undefined ? parts[3].trim() : null;
    if (alpha !== null) {
      return `rgba(${inverted.r}, ${inverted.g}, ${inverted.b}, ${alpha})`;
    }
    return `rgb(${inverted.r}, ${inverted.g}, ${inverted.b})`;
  });

  output = output.replace(/\b(black|white|red|yellow|green|blue|gray|grey)\b/gi, (match) => {
    const key = match.toLowerCase();
    const rgb = namedColors[key];
    if (!rgb) return match;
    const inverted = invertRgb(rgb[0], rgb[1], rgb[2]);
    return toHex(inverted.r, inverted.g, inverted.b);
  });

  return output;
}

let out = '';
let inComment = false;
let inString = null;
let inValue = false;
let inValueString = null;
let valueBuffer = '';
let depth = 0;

for (let i = 0; i < css.length; i += 1) {
  const ch = css[i];
  const next = css[i + 1];

  if (inComment) {
    out += ch;
    if (ch === '*' && next === '/') {
      out += next;
      i += 1;
      inComment = false;
    }
    continue;
  }

  if (!inValue && inString) {
    out += ch;
    if (ch === '\\\\' && i + 1 < css.length) {
      out += css[i + 1];
      i += 1;
      continue;
    }
    if (ch === inString) {
      inString = null;
    }
    continue;
  }

  if (inValue && inValueString) {
    valueBuffer += ch;
    if (ch === '\\\\' && i + 1 < css.length) {
      valueBuffer += css[i + 1];
      i += 1;
      continue;
    }
    if (ch === inValueString) {
      inValueString = null;
    }
    continue;
  }

  if (!inValue && !inString) {
    if (ch === '/' && next === '*') {
      out += ch + next;
      i += 1;
      inComment = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      out += ch;
      inString = ch;
      continue;
    }
  }

  if (inValue) {
    if (ch === '"' || ch === "'") {
      valueBuffer += ch;
      inValueString = ch;
      continue;
    }
    if (ch === ';') {
      out += replaceColors(valueBuffer);
      out += ch;
      inValue = false;
      valueBuffer = '';
      continue;
    }
    if (ch === '}') {
      out += replaceColors(valueBuffer);
      out += ch;
      inValue = false;
      valueBuffer = '';
      if (depth > 0) {
        depth -= 1;
      }
      continue;
    }
    valueBuffer += ch;
    continue;
  }

  if (ch === '{') {
    depth += 1;
    out += ch;
    continue;
  }
  if (ch === '}') {
    if (depth > 0) {
      depth -= 1;
    }
    out += ch;
    continue;
  }
  if (depth > 0 && ch === ':') {
    inValue = true;
    out += ch;
    valueBuffer = '';
    continue;
  }

  out += ch;
}

if (inValue && valueBuffer) {
  out += replaceColors(valueBuffer);
}

fs.writeFileSync(filePath, out);
NODE
done

mapfile -t html_files < <(find "$COVERAGE_DIR" -type f -name '*.html')

for html_file in "${html_files[@]}"; do
  if rg -q "coverage-dark.css" "$html_file"; then
    continue
  fi

  html_dir="$(dirname "$html_file")"
  rel_path="$(node -e "const path=require('path'); console.log(path.relative(process.argv[1], process.argv[2]).replace(/\\\\/g, '/'));" "$html_dir" "$CSS_FILE")"

  perl -0pi -e "s#</head>#  <link rel=\"stylesheet\" href=\"$rel_path\">\\n</head>#i" "$html_file"
done
