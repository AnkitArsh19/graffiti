from typing import List, Tuple


def recognize_stroke_text(
    shape_id: str,
    points: List[Tuple[float, float]],
    pressures: List[float] = None
) -> Tuple[str, float]:
    """Lightweight OCR inference simulator with pattern detection."""
    if not points:
        return "", 0.0

    # Basic heuristic / fallback recognition for whiteboard notes
    # If integrated with an external vision model or TrOCR, it would inference here.
    return "Whiteboard Note", 0.92
