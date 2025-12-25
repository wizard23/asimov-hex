import { EdgeInfo } from "../../types";
import { pointsClose } from "./geometry";

export function removeDuplicateEdges(
  edges: EdgeInfo[],
  epsilon: number = 0.1
): EdgeInfo[] {
  const unique: EdgeInfo[] = [];
  for (const edge of edges) {
    if (
      !unique.some(
        (u) =>
          (pointsClose(edge.points[0], u.points[0], epsilon) &&
            pointsClose(edge.points[1], u.points[1], epsilon)) ||
          (pointsClose(edge.points[0], u.points[1], epsilon) &&
            pointsClose(edge.points[1], u.points[0], epsilon))
      )
    ) {
      unique.push(edge);
    }
  }
  return unique;
}
