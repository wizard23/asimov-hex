import { describe, it, expect } from "vitest";
import { pointInPolygon, pointNearPolyline, translatePoints } from "./geometry-helpers";

describe("geometry-helpers", () => {
  it("translatePoints offsets all points", () => {
    const points = [{ x: 1, y: 2 }, { x: -1, y: 0 }];
    const offset = { x: 3, y: -2 };
    expect(translatePoints(points, offset)).toEqual([
      { x: 4, y: 0 },
      { x: 2, y: -2 },
    ]);
  });

  it("pointInPolygon detects inside vs outside", () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 2 },
    ];
    expect(pointInPolygon({ x: 1, y: 1 }, triangle)).toBe(true);
    expect(pointInPolygon({ x: -1, y: 0 }, triangle)).toBe(false);
  });

  it("pointNearPolyline detects proximity to segment", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(pointNearPolyline({ x: 5, y: 0.4 }, line, 0.5, false)).toBe(true);
    expect(pointNearPolyline({ x: 5, y: 2 }, line, 0.5, false)).toBe(false);
  });
});
