import json
import math
import random
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from app.config import settings


def _strip_emojis(text: str) -> str:
    """Removes emoji characters, unicode pictographs, and symbols from string."""
    if not text:
        return ""
    clean = re.sub(r'[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf\ufe0f\u200d]', '', str(text))
    return clean.strip()


def _extract_meaningful_labels(elements: List[Dict[str, Any]]) -> List[str]:
    """Extracts genuine text labels while filtering out single-char noise and OCR artifacts."""
    noise_tokens = {
        "0", "1", "-1", "-", "/", "\\", "dot", "stroke",
        "handwritten ink", "handwriting", "handwritten note", "s", "u", "v", "o"
    }
    meaningful: List[str] = []
    for el in elements:
        t = el.get("text")
        if t and str(t).strip():
            clean = str(t).strip()
            if clean.lower() not in noise_tokens:
                meaningful.append(clean)
        else:
            ocr = el.get("customData", {}).get("ocrText")
            if ocr and isinstance(ocr, str):
                clean = ocr.strip()
                if clean.lower() not in noise_tokens and len(clean) > 1 and not clean.replace("-", "").isdigit():
                    meaningful.append(clean)
    return meaningful


def _analyze_diagram_topology(
    elements: List[Dict[str, Any]],
    bounds: Dict[str, float]
) -> Tuple[List[Dict[str, Any]], Dict[int, List[Dict[str, Any]]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Spatially classifies whiteboard elements into:
    1. containers: outer boxes or circles enclosing concepts.
    2. inner_map: strokes/elements strictly inside a specific container (e.g. handwritten text).
    3. connectors: strokes connecting containers or located in the gaps between containers.
    4. standalone: other elements outside any container.
    """
    closed_shapes: List[Dict[str, Any]] = []
    other_elements: List[Dict[str, Any]] = []

    for el in elements:
        el_type = el.get("type", "pen")
        w = float(el.get("width", 0))
        h = float(el.get("height", 0))

        if el_type in ["rectangle", "ellipse", "diamond"]:
            closed_shapes.append(el)
            continue

        if el_type == "pen":
            pts = el.get("points", [])
            if len(pts) >= 4 and w >= 36.0 and h >= 24.0:
                p0, pEnd = pts[0], pts[-1]
                end_dist = math.hypot(pEnd.get("x", 0) - p0.get("x", 0), pEnd.get("y", 0) - p0.get("y", 0))
                diag = math.hypot(w, h)
                # Closed loop check
                if end_dist < max(45.0, diag * 0.38) or (len(pts) > 10 and end_dist < diag * 0.48):
                    closed_shapes.append(el)
                    continue

        other_elements.append(el)

    # Sort container shapes left-to-right
    containers = sorted(closed_shapes, key=lambda c: float(c.get("x", 0)))

    inner_map: Dict[int, List[Dict[str, Any]]] = {i: [] for i in range(len(containers))}
    connectors: List[Dict[str, Any]] = []
    standalone: List[Dict[str, Any]] = []

    for el in other_elements:
        cx = float(el.get("x", 0)) + float(el.get("width", 0)) / 2.0
        cy = float(el.get("y", 0)) + float(el.get("height", 0)) / 2.0

        matched_idx = -1
        for idx, cont in enumerate(containers):
            x1 = float(cont.get("x", 0))
            y1 = float(cont.get("y", 0))
            x2 = x1 + float(cont.get("width", 0))
            y2 = y1 + float(cont.get("height", 0))
            # Generous containment padding
            if (x1 - 10.0 <= cx <= x2 + 10.0) and (y1 - 10.0 <= cy <= y2 + 10.0):
                matched_idx = idx
                break

        if matched_idx >= 0:
            inner_map[matched_idx].append(el)
        else:
            # Check if this element sits between consecutive containers (connector)
            is_between = False
            for idx in range(len(containers) - 1):
                c_curr = containers[idx]
                c_next = containers[idx + 1]
                gap_start = float(c_curr.get("x", 0)) + float(c_curr.get("width", 0)) - 15.0
                gap_end = float(c_next.get("x", 0)) + 15.0
                if gap_start <= cx <= gap_end:
                    is_between = True
                    break
            if is_between or el.get("type") in ["arrow", "line"]:
                connectors.append(el)
            else:
                standalone.append(el)

    return containers, inner_map, connectors, standalone


async def process_circle_query(
    bounds: Dict[str, float],
    elements: List[Dict[str, Any]],
    prompt: str,
    action_type: Optional[str] = None,
    viewport: Optional[Dict[str, float]] = None
) -> Tuple[str, List[Dict[str, Any]], str]:
    """Processes user query on circled canvas region using Groq LLM with topological synthesis."""
    now = int(time.time() * 1000)
    prompt_str = (prompt or "").strip()
    prompt_lower = prompt_str.lower()

    # Extract meaningful text and element metadata
    element_types = [el.get("type", "shape") for el in elements]
    meaningful_labels = _extract_meaningful_labels(elements)
    extracted_text = " | ".join(meaningful_labels)

    # Determine intent / action
    resolved_action = action_type or "explain"
    if any(w in prompt_lower for w in ["restyle", "align", "clean", "color", "theme", "palette", "beautify"]):
        resolved_action = "restyle"
    elif any(w in prompt_lower for w in ["transform", "convert to card", "architecture card", "expand diagram", "boxes", "cards", "flowchart"]):
        resolved_action = "transform"
    elif any(w in prompt_lower for w in ["explain", "what is", "why", "how", "tell me", "summarize", "meaning", "?"]):
        resolved_action = "explain"

    # 1. Ask & Explain (Primary LLM Path - No Ghost Overlays)
    if resolved_action == "explain":
        groq_key = settings.get_groq_key()
        explanation = ""

        if groq_key:
            try:
                from groq import AsyncGroq
                client = AsyncGroq(api_key=groq_key)
                models_to_try = settings.get_groq_models()

                system_content = (
                    "You are an intelligent visual whiteboard assistant in Graffiti. "
                    "The user circled content on their canvas. Provide a clear, accurate, and insightful response. "
                    "Format concisely with plain text or compact bullet points (max 120 words). No preamble."
                )

                if extracted_text:
                    user_content = f"Circled content text: \"{extracted_text}\". Elements count: {len(elements)} ({', '.join(set(element_types))}).\n"
                elif elements:
                    user_content = f"Circled shapes: {len(elements)} items ({', '.join(set(element_types))}).\n"
                else:
                    user_content = "The user circled an open canvas region.\n"

                generic_prompts = [
                    "explain",
                    "explain this",
                    "explain this diagram and its flow",
                    "explain the circled content and key concepts"
                ]
                if prompt_str and prompt_lower not in generic_prompts:
                    user_content += f"User query: {prompt_str}"
                else:
                    user_content += "Explain the circled content, its concepts, and key details accurately and concisely."

                for m in models_to_try:
                    if not m:
                        continue
                    try:
                        completion = await client.chat.completions.create(
                            model=m,
                            messages=[
                                {"role": "system", "content": system_content},
                                {"role": "user", "content": user_content}
                            ],
                            temperature=0.3,
                            max_tokens=256,
                        )
                        if completion and completion.choices and completion.choices[0].message.content:
                            explanation = completion.choices[0].message.content.strip()
                            break
                    except Exception as err:
                        print(f"[CircleQuery] Model {m} failed: {err}")
                        continue
            except Exception as e:
                print(f"[CircleQuery] Groq invocation failed: {e}")

        if not explanation:
            if extracted_text:
                explanation = f"Circled notes: \"{extracted_text}\" ({len(elements)} element(s) selected)."
            elif elements:
                explanation = f"Circled region contains {len(elements)} element(s) ({', '.join(set(element_types))})."
            else:
                explanation = "Circled open canvas region. Ready to create notes or diagrams here."

        return "explain", [], explanation

    # 2. Modify & Restyle: True Diagram Beautification & Handwritten Text Replacement
    if resolved_action == "restyle":
        containers, inner_map, connectors, standalone = _analyze_diagram_topology(elements, bounds)
        reformed: List[Dict[str, Any]] = []
        theme_stroke = "#d4a359"
        theme_bg = "rgba(212, 163, 89, 0.12)"

        # Infer stage labels from text / inner strokes / prompt
        inferred_labels: List[str] = []
        for i, cont in enumerate(containers):
            lbl = ""
            if cont.get("text"):
                lbl = str(cont["text"]).strip()
            if not lbl and inner_map[i]:
                for inn in inner_map[i]:
                    if inn.get("text"):
                        lbl = str(inn["text"]).strip()
                        break
            if not lbl and meaningful_labels and i < len(meaningful_labels):
                lbl = meaningful_labels[i]
            if not lbl:
                # Contextual fallback based on diagram position
                default_names = ["Auth", "DB", "Save", "Service", "Store"] if len(containers) <= 3 else [f"Node {i+1}" for i in range(len(containers))]
                lbl = default_names[i] if i < len(default_names) else f"Step {i+1}"
            inferred_labels.append(lbl)

        # Re-build clean containers and digital text
        for i, cont in enumerate(containers):
            cx = float(cont.get("x", 0))
            cy = float(cont.get("y", 0))
            cw = max(float(cont.get("width", 100)), 80.0)
            ch = max(float(cont.get("height", 60)), 50.0)
            aspect = cw / max(ch, 1.0)
            is_circle = (0.75 <= aspect <= 1.35) and (cont.get("type") == "ellipse" or (cont.get("type") == "pen" and cw < ch * 1.3))
            shape_type = "ellipse" if is_circle else "rectangle"

            # Clean vector container shape
            card_id = cont.get("id") or f"restyle_box_{random.randint(10000, 99999)}"
            new_container = {
                "id": card_id,
                "pageId": cont.get("pageId", "page-1"),
                "type": shape_type,
                "x": cx,
                "y": cy,
                "width": cw,
                "height": ch,
                "strokeColor": theme_stroke,
                "backgroundColor": theme_bg,
                "fillStyle": "solid",
                "strokeWidth": 2,
                "strokeStyle": "solid",
                "roughness": 0,
                "opacity": 100,
                "roundness": {"type": 3},
                "seed": random.randint(100000, 999999),
                "version": cont.get("version", 1) + 1,
                "versionNonce": random.randint(100000, 999999),
                "updated": now,
                "boundElements": [],
                "customData": {"aiGenerated": True, "beautified": True}
            }
            reformed.append(new_container)

            # Clean digital text inside container in modern Inter font
            label_text = inferred_labels[i]
            custom_font_size = max(14, min(36, round(ch * 0.26)))
            font_cat = "large" if custom_font_size >= 24 else ("medium" if custom_font_size >= 16 else "small")

            text_elem = {
                "id": f"text_lbl_{random.randint(10000, 99999)}",
                "pageId": cont.get("pageId", "page-1"),
                "type": "text",
                "x": cx + 6,
                "y": cy + (ch - custom_font_size * 1.35) / 2.0,
                "width": cw - 12,
                "height": custom_font_size * 1.45,
                "text": label_text,
                "fontSize": font_cat,
                "customFontSize": custom_font_size,
                "fontFamily": "clean",
                "textAlign": "center",
                "strokeColor": "#ffffff",
                "backgroundColor": "transparent",
                "opacity": 100,
                "version": 1,
                "versionNonce": random.randint(100000, 999999),
                "updated": now,
                "customData": {"aiGenerated": True}
            }
            reformed.append(text_elem)

            # Mark all rough handwritten inner strokes as deleted
            for inn in inner_map[i]:
                if "id" in inn:
                    reformed.append({"id": inn["id"], "isDeleted": True})

        # Re-build clean connecting arrows between consecutive containers
        for i in range(len(containers) - 1):
            c_curr = containers[i]
            c_next = containers[i + 1]
            c1_x = float(c_curr.get("x", 0))
            c1_y = float(c_curr.get("y", 0))
            c1_w = float(c_curr.get("width", 100))
            c1_h = float(c_curr.get("height", 60))

            c2_x = float(c_next.get("x", 0))
            c2_y = float(c_next.get("y", 0))
            c2_h = float(c_next.get("height", 60))

            ax1 = c1_x + c1_w + 4.0
            ax2 = c2_x - 4.0
            ay1 = c1_y + c1_h / 2.0
            ay2 = c2_y + c2_h / 2.0
            arrow_w = max(ax2 - ax1, 12.0)
            arrow_h = ay2 - ay1

            arrow_id = f"arrow_restyle_{random.randint(10000, 99999)}"
            new_arrow = {
                "id": arrow_id,
                "pageId": c_curr.get("pageId", "page-1"),
                "type": "arrow",
                "x": ax1,
                "y": ay1,
                "width": arrow_w,
                "height": max(abs(arrow_h), 2.0),
                "points": [{"x": 0.0, "y": 0.0}, {"x": arrow_w, "y": arrow_h}],
                "endArrowhead": "arrow",
                "strokeColor": "#d4a359",
                "backgroundColor": "transparent",
                "strokeWidth": 2,
                "strokeStyle": "solid",
                "roughness": 0,
                "opacity": 100,
                "version": 1,
                "versionNonce": random.randint(100000, 999999),
                "updated": now,
                "customData": {"aiGenerated": True}
            }
            reformed.append(new_arrow)

        # Mark original connector strokes as deleted
        for conn in connectors:
            if "id" in conn:
                reformed.append({"id": conn["id"], "isDeleted": True})

        # Standalone elements (e.g. title notes outside containers)
        for st in standalone:
            if st.get("text"):
                new_st = dict(st)
                new_st["strokeColor"] = "#d4a359"
                new_st["fontFamily"] = "clean"
                new_st["version"] = new_st.get("version", 1) + 1
                reformed.append(new_st)
            else:
                new_st = dict(st)
                new_st["strokeColor"] = theme_stroke
                new_st["roughness"] = 0
                new_st["version"] = new_st.get("version", 1) + 1
                reformed.append(new_st)

        return "restyle", reformed, f"Restyled {len(containers)} components with Inter font and crisp connector arrows."

    # 3. Transform & Expand: Professional Architecture Cards with Dynamic Sizing & No Emojis
    transformed: List[Dict[str, Any]] = []
    bx = float(bounds.get("x", 100.0))
    by = float(bounds.get("y", 100.0))
    bw = max(float(bounds.get("w", bounds.get("width", 400.0))), 240.0)
    bh = max(float(bounds.get("h", bounds.get("height", 180.0))), 140.0)

    # Determine stage/card names from meaningful labels, user prompt, or topological analysis
    stages: List[str] = []
    if meaningful_labels and len(meaningful_labels) >= 2:
        stages = meaningful_labels[:4]
    elif meaningful_labels:
        single = meaningful_labels[0]
        if "osi" in single.lower():
            stages = ["Physical / Link", "Network / Transport", "Application"]
        else:
            stages = [single, "Processor", "Output"]
    else:
        # Check if containers were drawn
        containers, _, _, _ = _analyze_diagram_topology(elements, bounds)
        if len(containers) >= 2:
            stages = ["Auth Service", "Database", "Save Worker"] if len(containers) == 3 else [f"Component {i+1}" for i in range(len(containers))]
        else:
            stages = ["Client Ingress", "Core Service", "Storage Engine"]

    stages = [_strip_emojis(s) for s in stages if _strip_emojis(s)]
    if not stages:
        stages = ["Client Ingress", "Core Service", "Storage Engine"]

    K = len(stages)
    transform_group_id = f"grp_transform_{random.randint(10000, 99999)}"
    card_ids = [f"card_ai_{random.randint(10000, 99999)}" for _ in range(K)]

    # Proportional dynamic sizing adapting to user's zoom & bounds
    margin = max(16.0, bw * 0.03)
    gap = max(28.0, bw * 0.08)
    usable_w = bw - 2 * margin
    card_w = max(110.0, (usable_w - (K - 1) * gap) / K)
    card_h = max(56.0, min(bh * 0.72, card_w * 0.65))
    card_y = by + (bh - card_h) / 2.0
    custom_font_size = max(14, min(38, round(card_h * 0.24)))
    font_cat = "large" if custom_font_size >= 24 else ("medium" if custom_font_size >= 16 else "small")

    # Build structured digital cards (NO EMOJIS, SHARED GROUP ID)
    for i, name in enumerate(stages):
        card_id = card_ids[i]
        cx = bx + margin + i * (card_w + gap)

        card_elem = {
            "id": card_id,
            "type": "rectangle",
            "x": cx,
            "y": card_y,
            "width": card_w,
            "height": card_h,
            "angle": 0,
            "strokeColor": "#d4a359",
            "backgroundColor": "rgba(212, 163, 89, 0.12)",
            "fillStyle": "solid",
            "strokeWidth": 2,
            "strokeStyle": "solid",
            "roughness": 0,
            "opacity": 100,
            "roundness": {"type": 3},
            "seed": random.randint(100000, 999999),
            "version": 1,
            "versionNonce": random.randint(100000, 999999),
            "updated": now,
            "groupIds": [transform_group_id],
            "boundElements": [],
            "customData": {"aiGenerated": True, "groupId": transform_group_id}
        }
        transformed.append(card_elem)

        # Label element in clean Inter font
        text_id = f"label_ai_{random.randint(10000, 99999)}"
        text_elem = {
            "id": text_id,
            "type": "text",
            "x": cx + 8,
            "y": card_y + (card_h - custom_font_size * 1.35) / 2.0,
            "width": card_w - 16,
            "height": custom_font_size * 1.45,
            "text": _strip_emojis(name),
            "fontSize": font_cat,
            "customFontSize": custom_font_size,
            "fontFamily": "clean",
            "textAlign": "center",
            "strokeColor": "#ffffff",
            "backgroundColor": "transparent",
            "opacity": 100,
            "version": 1,
            "versionNonce": random.randint(100000, 999999),
            "updated": now,
            "groupIds": [transform_group_id],
            "customData": {"aiGenerated": True, "groupId": transform_group_id}
        }
        transformed.append(text_elem)

        # Directional connector arrow between cards with explicit points, bindings & arrowhead
        if i < K - 1:
            arrow_id = f"arrow_ai_{random.randint(10000, 99999)}"
            ax1 = cx + card_w + 3.0
            ax2 = cx + card_w + gap - 3.0
            arrow_len = max(ax2 - ax1, 14.0)
            ay = card_y + card_h / 2.0
            arrow_elem = {
                "id": arrow_id,
                "type": "arrow",
                "x": ax1,
                "y": ay,
                "width": arrow_len,
                "height": 2.0,
                "points": [{"x": 0.0, "y": 0.0}, {"x": arrow_len, "y": 0.0}],
                "endArrowhead": "arrow",
                "strokeColor": "#d4a359",
                "backgroundColor": "transparent",
                "strokeWidth": max(2, round(card_h / 45)),
                "strokeStyle": "solid",
                "roughness": 0,
                "opacity": 100,
                "version": 1,
                "versionNonce": random.randint(100000, 999999),
                "updated": now,
                "groupIds": [transform_group_id],
                "startBinding": {"elementId": card_id, "pointId": "right"},
                "endBinding": {"elementId": card_ids[i + 1], "pointId": "left"},
                "customData": {"aiGenerated": True, "groupId": transform_group_id}
            }
            transformed.append(arrow_elem)

    # Replace original messy sketch elements
    for orig_el in elements:
        if "id" in orig_el:
            transformed.append({
                "id": orig_el["id"],
                "isDeleted": True
            })

    return "transform", transformed, f"Transformed into {K} structured components: {' ➔ '.join(stages)}"
