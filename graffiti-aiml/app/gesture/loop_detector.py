import math
from typing import List, Tuple

Point = Tuple[float, float]


def is_closed_loop(points: List[Point], tolerance_ratio: float = 0.20) -> bool:
    """Verifies if a freedraw stroke starts and ends near each other forming a loop."""
    if len(points) < 8:
        return False

    start = points[0]
    end = points[-1]
    dist = math.hypot(start[0] - end[0], start[1] - end[1])

    # Calculate total stroke length
    total_length = 0.0
    for i in range(1, len(points)):
        total_length += math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])

    if total_length == 0:
        return False

    return (dist / total_length) < tolerance_ratio
