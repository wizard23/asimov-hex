/**
 * Converts a color value from Tweakpane (which can be string or object) to a numeric color value for PixiJS
 */
export function colorToHex(color: string | { r: number; g: number; b: number; a?: number }): number {
  if (typeof color === 'string') {
    // Convert hex string to number (remove # if present)
    const hex = color.replace('#', '');
    return parseInt(hex, 16);
  }
  
  // Convert from { r, g, b, a } format (0-1 range) to numeric color
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return (r << 16) | (g << 8) | b;
}
