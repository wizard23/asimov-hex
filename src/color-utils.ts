/**
 * Converts a color value from Tweakpane (which can be string or object) to a numeric color value for PixiJS
 */
import { ColorValue } from './types';

export function colorToHex(color: ColorValue): number {
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

export function colorToRgb(color: ColorValue): { r: number; g: number; b: number } {
  if (typeof color === 'string') {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }
  return {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255),
  };
}

export function getBrightness(color: ColorValue): number {
  const rgb = colorToRgb(color);
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}
