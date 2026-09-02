import random
import time
from typing import Any, Dict, List, Tuple
from app.config import settings


def process_circle_query(
    bounds: Dict[str, float],
    elements: List[Dict[str, Any]],
    prompt: str
) -> Tuple[str, List[Dict[str, Any]], str]:
    """Processes user query on circled canvas region."""
    prompt_lower = prompt.lower()
    now = int(time.time() * 1000)

    # 1. Ask & Explain
    if any(w in prompt_lower for w in ["explain", "what is", "why", "how", "tell me"]):
        element_types = [el.get("type", "shape") for el in elements]
        text_labels = [
            el.get("text") or el.get("customData", {}).get("ocrText")
            for el in elements
            if el.get("text") or el.get("customData", {}).get("ocrText")
        ]
        label_summary = f" containing '{', '.join(text_labels)}'" if text_labels else ""
        explanation = (
            f"The circled region contains {len(elements)} elements ({', '.join(set(element_types))}){label_summary}. "
            f"Based on your query '{prompt}', this structure appears to represent an architectural component flow."
        )
        return "explain", [], explanation

    # 2. Modify & Restyle
    if any(w in prompt_lower for w in ["restyle", "align", "clean", "color", "theme"]):
        reformed = []
        cur_y = bounds["y"] + 20.0
        row_h = 60.0
        for i, el in enumerate(elements):
            new_el = dict(el)
            new_el["version"] = new_el.get("version", 1) + 1
            new_el["versionNonce"] = random.randint(100000, 999999)
            new_el["updated"] = now
            # Standardize styling
            new_el["backgroundColor"] = "#e7f5ff"
            new_el["strokeColor"] = "#1971c2"
            new_el["roughness"] = 1
            if "customData" not in new_el or not isinstance(new_el["customData"], dict):
                new_el["customData"] = {}
            new_el["customData"]["aiGenerated"] = True
            reformed.append(new_el)
        return "restyle", reformed, "Standardized styles and palette for enclosed elements."

    # 3. Transform & Expand (Default)
    transformed = []
    card_uuid = f"el_card_{random.randint(10000, 99999)}"
    card_elem = {
        "id": card_uuid,
        "type": "rectangle",
        "x": bounds["x"] + 10.0,
        "y": bounds["y"] + 10.0,
        "width": max(bounds["w"] - 20.0, 200.0),
        "height": max(bounds["h"] - 20.0, 140.0),
        "angle": 0,
        "strokeColor": "#5c7cfa",
        "backgroundColor": "#f8f9fa",
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "roundness": {"type": 3},
        "seed": random.randint(100000, 999999),
        "version": 1,
        "versionNonce": random.randint(100000, 999999),
        "index": "a_transform",
        "isDeleted": False,
        "groupIds": [],
        "frameId": None,
        "boundElements": [],
        "updated": now,
        "customData": {
            "aiGenerated": True,
            "transformedFrom": [el.get("id") for el in elements if "id" in el]
        }
    }
    transformed.append(card_elem)

    return "transform", transformed, f"Transformed circled items based on '{prompt}'."
