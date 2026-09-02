import math
from typing import List, Tuple

Point = Tuple[float, float]


def perpendicular_distance(pt: Point, line_start: Point, line_end: Point) -> float:
    x0, y0 = pt
    x1, y1 = line_start
    x2, y2 = line_end

    dx = x2 - x1
    dy = y2 - y1
    mag = math.hypot(dx, dy)
    if mag == 0:
        return math.hypot(x0 - x1, y0 - y1)

    return abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / mag


def ramer_douglas_peucker(points: List[Point], epsilon: float = 4.0) -> List[Point]:
    """Simplifies a 2D polyline by removing points within epsilon tolerance."""
    if len(points) < 3:
        return points

    dmax = 0.0
    index = 0
    end = len(points) - 1

    for i in range(1, end):
        d = perpendicular_distance(points[i], points[0], points[end])
        if d > dmax:
            index = i
            dmax = d

    if dmax > epsilon:
        rec1 = ramer_douglas_peucker(points[: index + 1], epsilon)
        rec2 = ramer_douglas_peucker(points[index:], epsilon)
        return rec1[:-1] + rec2
    else:
        return [points[0], points[end]]
