export const DRAW_CONFIG = {
  backgroundColor: '#1a1a1a',
  defaultScale: 100,
  scaleBounds: { min: 1, max: 200 },
  defaultEdgeWidth: 2,
  defaultAxesColor: '#444444',
  defaultAxesLineWidth: 1,
  defaultClosedPolygonEpsilon: 1e-4,
  polygonFillAlpha: 0.8,
  polygonFillColors: {
    hover: 0x4a9eff,
    error: 0x661111,
    normal: 0x444444,
  },
  polygonStrokeColors: {
    error: 0xff4d4d,
    closed: 0xffffff,
    hover: 0xffd24d,
  },
  selectionStrokeColors: {
    primary: 0x000000,
    secondary: 0xffffff,
  },
  labelColor: 0xffd24d,
  labelFontSizePx: 12,
  labelStrokeMinPx: 1,
  labelStrokeScale: 0.12,
  axisLabelOffsets: {
    x: { dx: 0.2, dy: -0.6 },
    y: { dx: -0.6, dy: -1.2 },
  },
  vertexLabelCenterOffset: 0.5,
  dottedDash: {
    widthFactor: 2,
    minPx: 4,
  },
  dashedDash: {
    widthFactor: 3,
    minPx: 6,
  },
};
