// IMPORTANT: This config is render-focused only (colors, widths, padding, spacing).
// Keep layout/state logic out of this file to preserve consistent scale styling.
export const scaleStyle = {
  panel: {
    fillColor: 0x141414,
    fillAlpha: 0.92,
    borderColor: 0x2f2f2f,
    borderAlpha: 0.8,
    borderWidth: 1,
    separatorColor: 0x7a7a7a,
    separatorAlpha: 0.9,
    separatorWidth: 1,
  },
  topScale: {
    overlayExtraHeight: 3,
    labelInset: 5,
    labelMajor: {
      color: 0xf0f0f0,
      fontSize: 15,
    },
    labelMinor: {
      color: 0xb0b0b0,
      fontSize: 13,
    },
    milestoneLabel: {
      color: 0xe6e6e6,
      fontSize: 14,
    },
  },
  ticks: {
    major: {
      color: 0x777777,
      alpha: 0.9,
      width: 1,
    },
    minor: {
      color: 0x4b4b4b,
      alpha: 0.7,
      width: 1,
    },
    extended: {
      major: {
        color: 0x4a4a4a,
        alpha: 0.35,
        width: 1,
      },
      minor: {
        color: 0x333333,
        alpha: 0.22,
        width: 1,
      },
    },
  },
  changeScale: {
    overlayExtraWidth: 3,
    rightPaddingBase: 12,
    axisInset: 12,
    tickPadding: 22,
    axisColor: 0x777777,
    axisAlpha: 0.9,
    axisWidth: 1,
    labelColor: 0xcfcfcf,
    labelFontSize: 12,
    labelPad: 8,
    tickSize: 6,
  },
} as const;
