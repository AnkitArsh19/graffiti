import random
import time
from typing import Any, Dict, List
from app.diagram.layout_engine import NodeLayout
from app.diagram.mermaid_parser import ParsedDiagram


def build_graffiti_elements(
    diagram: ParsedDiagram,
    layouts: Dict[str, NodeLayout]
) -> List[Dict[str, Any]]:
    elements: List[Dict[str, Any]] = []
    now = int(time.time() * 1000)

    # Color palettes for auto-generated diagrams
    node_bg_colors = ["#e7f5ff", "#e6fcf5", "#fff4e6", "#f3f0ff", "#fff0f6"]
    node_stroke_colors = ["#1971c2", "#099268", "#f76707", "#7048e8", "#d6336c"]

    # Keep map of shapeId -> element for arrow bindings
    node_shape_ids: Dict[str, str] = {}

    for idx, (node_id, layout) in enumerate(layouts.items()):
        shape_uuid = f"el_ai_{node_id}_{random.randint(10000, 99999)}"
        text_uuid = f"el_text_{node_id}_{random.randint(10000, 99999)}"
        node_shape_ids[node_id] = shape_uuid

        color_idx = idx % len(node_bg_colors)
        bg = node_bg_colors[color_idx]
        stroke = node_stroke_colors[color_idx]

        # Shape element (rectangle, ellipse, or diamond) with direct text binding
        shape_elem = {
            "id": shape_uuid,
            "type": layout.shape,
            "x": layout.x,
            "y": layout.y,
            "width": layout.width,
            "height": layout.height,
            "angle": 0,
            "text": layout.label,
            "fontSize": "medium",
            "fontFamily": "clean",
            "textAlign": "center",
            "strokeColor": stroke,
            "backgroundColor": bg,
            "fillStyle": "semi",
            "strokeWidth": 2,
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 100,
            "roundness": "round",
            "seed": random.randint(100000, 999999),
            "version": 1,
            "versionNonce": random.randint(100000, 999999),
            "index": f"a{idx:02d}",
            "isDeleted": False,
            "groupIds": [],
            "frameId": None,
            "boundElements": [],
            "updated": now,
            "link": None,
            "locked": False,
            "customData": {
                "aiGenerated": True,
                "nodeId": node_id,
                "label": layout.label
            }
        }
        elements.append(shape_elem)

    # Build Arrows / Connectors
    for edge_idx, edge in enumerate(diagram.edges):
        src_layout = layouts.get(edge.source)
        tgt_layout = layouts.get(edge.target)
        if not src_layout or not tgt_layout:
            continue

        src_shape_id = node_shape_ids.get(edge.source)
        tgt_shape_id = node_shape_ids.get(edge.target)

        arrow_uuid = f"el_arrow_{edge_idx}_{random.randint(10000, 99999)}"

        # Compute connection points based on diagram direction
        if diagram.direction in ["LR", "RL"]:
            # Connect right edge of source to left edge of target
            src_cx = src_layout.x + src_layout.width
            src_cy = src_layout.y + (src_layout.height / 2.0)
            tgt_cx = tgt_layout.x
            tgt_cy = tgt_layout.y + (tgt_layout.height / 2.0)
            start_point_id = "right"
            end_point_id = "left"
        else:
            # Vertical (TD/TB): bottom of source to top of target
            src_cx = src_layout.x + (src_layout.width / 2.0)
            src_cy = src_layout.y + src_layout.height
            tgt_cx = tgt_layout.x + (tgt_layout.width / 2.0)
            tgt_cy = tgt_layout.y
            start_point_id = "bottom"
            end_point_id = "top"

        dx = tgt_cx - src_cx
        dy = tgt_cy - src_cy

        arrow_bound_elements = []

        # Bound label element at arrow midpoint if edge has a label
        if edge.label:
            label_uuid = f"el_text_lbl_{edge_idx}_{random.randint(10000, 99999)}"
            label_elem = {
                "id": label_uuid,
                "type": "text",
                "x": (src_cx + tgt_cx) / 2.0 - 20.0,
                "y": (src_cy + tgt_cy) / 2.0 - 10.0,
                "width": max(len(edge.label) * 8.0, 30.0),
                "height": 20.0,
                "text": edge.label,
                "fontSize": "small",
                "fontFamily": "clean",
                "textAlign": "center",
                "verticalAlign": "middle",
                "containerId": arrow_uuid,  # Binds text to arrow container
                "strokeColor": "#f4f4f5",
                "backgroundColor": "transparent",
                "customData": {"aiGenerated": True}
            }
            elements.append(label_elem)
            arrow_bound_elements.append({"id": label_uuid, "type": "text"})

        arrow_elem = {
            "id": arrow_uuid,
            "type": "arrow",
            "x": src_cx,
            "y": src_cy,
            "width": max(abs(dx), 2.0),
            "height": max(abs(dy), 2.0),
            "points": [{"x": 0.0, "y": 0.0}, {"x": dx, "y": dy}],
            "angle": 0,
            "strokeColor": "#a1a1aa",
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 2,
            "strokeStyle": edge.style,
            "roughness": 0,
            "opacity": 100,
            "seed": random.randint(100000, 999999),
            "version": 1,
            "versionNonce": random.randint(100000, 999999),
            "index": f"b{edge_idx:02d}",
            "isDeleted": False,
            "groupIds": [],
            "frameId": None,
            "boundElements": arrow_bound_elements,
            "startBinding": {
                "elementId": src_shape_id,
                "pointId": start_point_id,
                "focus": 0.0,
                "gap": 4.0
            } if src_shape_id else None,
            "endBinding": {
                "elementId": tgt_shape_id,
                "pointId": end_point_id,
                "focus": 0.0,
                "gap": 4.0
            } if tgt_shape_id else None,
            "updated": now,
            "customData": {
                "aiGenerated": True,
                "label": edge.label
            }
        }
        elements.append(arrow_elem)

        # Update source and target boundElements with arrow reference
        for elem in elements:
            if elem["id"] in [src_shape_id, tgt_shape_id]:
                elem["boundElements"].append({"id": arrow_uuid, "type": "arrow"})

    return elements
