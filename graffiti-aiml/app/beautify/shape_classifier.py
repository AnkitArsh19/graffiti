import math
import random
import time
from typing import Any, Dict, List, Tuple
from app.beautify.douglas_peucker import ramer_douglas_peucker

Point = Tuple[float, float]


def _norm_pt(p: Any) -> Point:
    if isinstance(p, dict):
        return (float(p.get("x", 0.0)), float(p.get("y", 0.0)))
    if isinstance(p, (list, tuple)) and len(p) >= 2:
        return (float(p[0]), float(p[1]))
    return (0.0, 0.0)


def classify_and_clean_stroke(
    shape_id: str,
    raw_points: List[Any]
) -> Tuple[str, Dict[str, Any]]:
    points: List[Point] = [_norm_pt(p) for p in raw_points] if raw_points else []
    if not points:
        return "freedraw", {"id": shape_id, "type": "freedraw", "points": []}

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    width = max(max_x - min_x, 10.0)
    height = max(max_y - min_y, 10.0)

    start_pt = points[0]
    end_pt = points[-1]
    closure_distance = math.hypot(start_pt[0] - end_pt[0], start_pt[1] - end_pt[1])
    perimeter_est = 2 * (width + height)
    is_closed = (closure_distance / perimeter_est) < 0.20

    simplified = ramer_douglas_peucker(points, epsilon=max(width, height) * 0.05)
    num_vertices = len(simplified) - 1 if is_closed else len(simplified)

    now = int(time.time() * 1000)

    detected_type = "rectangle"
    payload: Dict[str, Any] = {
        "id": shape_id,
        "x": min_x,
        "y": min_y,
        "width": width,
        "height": height,
        "angle": 0,
        "strokeColor": "#1e1e1e",
        "backgroundColor": "transparent",
        "fillStyle": "hachure",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 1,
        "opacity": 100,
        "roundness": {"type": 3},
        "seed": random.randint(100000, 999999),
        "version": 2,
        "versionNonce": random.randint(100000, 999999),
        "index": "a0",
        "isDeleted": False,
        "groupIds": [],
        "frameId": None,
        "boundElements": [],
        "updated": now,
        "customData": {
            "aiGenerated": True,
            "smoothedFromStroke": True
        }
    }

    if is_closed:
        # Check circularity: ratio of area to perimeter squared
        # Ellipse vs Rectangle vs Diamond
        aspect = width / height if height > 0 else 1.0

        if 3 <= num_vertices <= 5:
            # Diamond check: vertices near midpoints of bounding box
            if 0.7 <= aspect <= 1.3:
                detected_type = "diamond"
            else:
                detected_type = "rectangle"
        elif num_vertices > 6 or (0.8 <= aspect <= 1.25):
            detected_type = "ellipse"
        else:
            detected_type = "rectangle"

        payload["type"] = detected_type
    else:
        # Open curve: Line or Arrow
        line_length = math.hypot(end_pt[0] - start_pt[0], end_pt[1] - start_pt[1])
        if line_length > 20:
            detected_type = "arrow"
            payload["type"] = "arrow"
            payload["x"] = start_pt[0]
            payload["y"] = start_pt[1]
            payload["points"] = [[0.0, 0.0], [end_pt[0] - start_pt[0], end_pt[1] - start_pt[1]]]
            payload.pop("width", None)
            payload.pop("height", None)
            payload.pop("roundness", None)
        else:
            detected_type = "rectangle"
            payload["type"] = "rectangle"

    return detected_type, payload
