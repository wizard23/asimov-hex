import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { dirname, join, relative } from "node:path";

const COVERAGE_DIR = join(process.cwd(), "public/coverage");
const COVERAGE_DARK_CSS = join(COVERAGE_DIR, "coverage-dark.css");

const namedColors: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  yellow: [255, 255, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
};

const parseHexColor = (hex: string) => {
  const clean = hex.toLowerCase();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
      a: null as string | null,
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
};

const rgbToHsl = (r: number, g: number, b: number) => {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rr:
        h = (gg - bb) / d + (gg < bb ? 6 : 0);
        break;
      case gg:
        h = (bb - rr) / d + 2;
        break;
      case bb:
        h = (rr - gg) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
};

const hslToRgb = (h: number, s: number, l: number) => {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
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
};

const invertRgb = (r: number, g: number, b: number) => {
  const { h, s, l } = rgbToHsl(r, g, b);
  return hslToRgb(h, s, 1 - l);
};

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

const replaceColors = (value: string) => {
  let output = value;

  output = output.replace(/#([0-9a-fA-F]{3,8})\b/g, (match, hex) => {
    const parsed = parseHexColor(hex);
    if (!parsed) return match;
    const inverted = invertRgb(parsed.r, parsed.g, parsed.b);
    const rgbHex = toHex(inverted.r, inverted.g, inverted.b);
    return parsed.a ? `${rgbHex}${parsed.a}` : rgbHex;
  });

  output = output.replace(/rgba?\(([^)]+)\)/gi, (match, inner) => {
    const parts = inner.split(",").map((part: string) => part.trim());
    if (parts.length < 3) return match;
    const toChannel = (raw: string) => {
      if (raw.endsWith("%")) {
        const pct = Number.parseFloat(raw);
        if (Number.isNaN(pct)) return null;
        return Math.round((pct / 100) * 255);
      }
      const num = Number.parseFloat(raw);
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

  output = output.replace(
    /\b(black|white|red|yellow|green|blue|gray|grey)\b/gi,
    (match) => {
      const key = match.toLowerCase();
      const rgb = namedColors[key];
      if (!rgb) return match;
      const inverted = invertRgb(rgb[0], rgb[1], rgb[2]);
      return toHex(inverted.r, inverted.g, inverted.b);
    },
  );

  return output;
};

const transformCss = (css: string) => {
  let out = "";
  let inComment = false;
  let inString: string | null = null;
  let inValue = false;
  let inValueString: string | null = null;
  let valueBuffer = "";
  let depth = 0;

  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    const next = css[i + 1];

    if (inComment) {
      out += ch;
      if (ch === "*" && next === "/") {
        out += next;
        i += 1;
        inComment = false;
      }
      continue;
    }

    if (!inValue && inString) {
      out += ch;
      if (ch === "\\" && i + 1 < css.length) {
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
      if (ch === "\\" && i + 1 < css.length) {
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
      if (ch === "/" && next === "*") {
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
      if (ch === ";") {
        out += replaceColors(valueBuffer);
        out += ch;
        inValue = false;
        valueBuffer = "";
        continue;
      }
      if (ch === "}") {
        out += replaceColors(valueBuffer);
        out += ch;
        inValue = false;
        valueBuffer = "";
        if (depth > 0) depth -= 1;
        continue;
      }
      valueBuffer += ch;
      continue;
    }

    if (ch === "{") {
      depth += 1;
      out += ch;
      continue;
    }
    if (ch === "}") {
      if (depth > 0) depth -= 1;
      out += ch;
      continue;
    }
    if (depth > 0 && ch === ":") {
      inValue = true;
      out += ch;
      valueBuffer = "";
      continue;
    }

    out += ch;
  }

  if (inValue && valueBuffer) {
    out += replaceColors(valueBuffer);
  }

  return out;
};

const listCssFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listCssFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      files.push(fullPath);
    }
  }
  return files;
};

const listHtmlFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listHtmlFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
};

const relativeTo = (fromFile: string, toFile: string) =>
  relative(dirname(fromFile), toFile).replace(/\\/g, "/");

const run = async () => {
  try {
    await fs.stat(COVERAGE_DIR);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: coverage directory not found at: ${COVERAGE_DIR}`);
    console.error("Run: npm run test-coverage");
    console.error(message);
    process.exit(1);
  }

  await fs.writeFile(COVERAGE_DARK_CSS, ":root { color-scheme: dark; }\n", "utf8");

  const cssFiles = await listCssFiles(COVERAGE_DIR);
  for (const cssFile of cssFiles) {
    if (cssFile === COVERAGE_DARK_CSS) continue;
    const css = await fs.readFile(cssFile, "utf8");
    const transformed = transformCss(css);
    await fs.writeFile(cssFile, transformed, "utf8");
  }

  const htmlFiles = await listHtmlFiles(COVERAGE_DIR);
  for (const htmlFile of htmlFiles) {
    const html = await fs.readFile(htmlFile, "utf8");
    if (html.includes("coverage-dark.css")) {
      continue;
    }
    const relPath = relativeTo(htmlFile, COVERAGE_DARK_CSS);
    const updated = html.replace(
      /<\/head>/i,
      `  <link rel="stylesheet" href="${relPath}">\n</head>`,
    );
    await fs.writeFile(htmlFile, updated, "utf8");
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
