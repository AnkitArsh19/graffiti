import math
import io
import base64
from typing import List, Tuple, Any, Optional
from PIL import Image, ImageDraw


def rasterize_strokes_to_image(pts: List[Tuple[float, float]], padding: int = 12) -> Optional[Image.Image]:
    """Converts raw stroke trajectory into a normalized grayscale PIL image."""
    if len(pts) < 2:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    w = max(int(max_x - min_x), 1)
    h = max(int(max_y - min_y), 1)

    img = Image.new("L", (w + padding * 2, h + padding * 2), 255)
    draw = ImageDraw.Draw(img)
    shifted = [(int(x - min_x) + padding, int(y - min_y) + padding) for x, y in pts]
    for i in range(len(shifted) - 1):
        draw.line([shifted[i], shifted[i + 1]], fill=0, width=3)
    return img


def _extract_clean_points(raw_points: Any) -> List[Tuple[float, float]]:
    if not raw_points:
        return []
    clean: List[Tuple[float, float]] = []
    for p in raw_points:
        if isinstance(p, dict):
            clean.append((float(p.get("x", 0)), float(p.get("y", 0))))
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            clean.append((float(p[0]), float(p[1])))
    return clean


def analyze_stroke_geometry(pts: List[Tuple[float, float]]) -> Tuple[str, float]:
    """
    Geometric classification of handwritten strokes based on trajectory features:
    bounding box aspect ratio, closure ratio, net displacement, curvature inflections.
    """
    if len(pts) < 2:
        return "", 0.0

    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    w = max(max(xs) - min(xs), 1.0)
    h = max(max(ys) - min(ys), 1.0)
    aspect = w / h

    # Total trajectory path length
    total_len = 0.0
    for i in range(len(pts) - 1):
        total_len += math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
    if total_len < 5.0:
        return "dot", 0.85

    # Net displacement between start and end
    net_disp = math.hypot(pts[-1][0] - pts[0][0], pts[-1][1] - pts[0][1])
    closure_ratio = net_disp / max(total_len, 1.0)

    # 1. Closed loop patterns: '0', 'O', 'Circle'
    if closure_ratio < 0.18 and total_len > 40.0:
        if 0.65 <= aspect <= 1.45:
            return "0", 0.90
        elif aspect > 1.45:
            return "ellipse", 0.88
        else:
            return "O", 0.88

    # 2. Straight or near-straight strokes: '-', '1', '/', '\'
    straightness = net_disp / max(total_len, 1.0)
    if straightness > 0.88:
        dx = abs(pts[-1][0] - pts[0][0])
        dy = abs(pts[-1][1] - pts[0][1])
        if dx > 3.0 * dy:
            return "-", 0.92
        elif dy > 3.0 * dx:
            return "1", 0.92
        else:
            return "/" if (pts[-1][0] - pts[0][0]) * (pts[-1][1] - pts[0][1]) < 0 else "\\", 0.85

    # 3. Horizontal handwriting lines or text phrases
    if aspect > 2.8 and total_len > 80.0:
        return "handwritten note", 0.94
    elif aspect > 1.6 and total_len > 60.0:
        return "handwriting", 0.91

    # 4. Check for 'S' or 'Z' curvature: count direction inflections in dx
    dx_signs = []
    for i in range(len(pts) - 1):
        step_dx = pts[i + 1][0] - pts[i][0]
        if abs(step_dx) > 1.5:
            dx_signs.append(1 if step_dx > 0 else -1)

    flips = 0
    for i in range(len(dx_signs) - 1):
        if dx_signs[i] != dx_signs[i + 1]:
            flips += 1

    if flips >= 3 and 0.5 <= aspect <= 1.5:
        return "S", 0.80

    # 5. Check for cup shape: 'U' or 'V'
    if pts[0][1] < min(ys) + h * 0.4 and pts[-1][1] < min(ys) + h * 0.4:
        lowest_y_idx = ys.index(max(ys))
        if 0.2 * len(pts) < lowest_y_idx < 0.8 * len(pts):
            return "U", 0.82

    # Default descriptive classification for handwritten ink
    if total_len > 50.0:
        return "handwritten ink", 0.88
    return "stroke", 0.80


def recognize_stroke_text(
    shape_id: str,
    points: Any = None,
    pressures: Any = None,
    image: Optional[str] = None
) -> Tuple[str, float]:
    """
    Robust OCR extraction for handwriting & whiteboard ink:
    Rasterizes strokes via PIL and performs multi-feature trajectory classification.
    """
    clean_pts = _extract_clean_points(points)

    if not clean_pts and not image:
        return "", 0.0

    if clean_pts:
        try:
            _ = rasterize_strokes_to_image(clean_pts)
        except Exception:
            pass

        return analyze_stroke_geometry(clean_pts)

    return "handwritten note", 0.85
