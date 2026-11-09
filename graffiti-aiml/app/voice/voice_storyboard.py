import json
import random
import uuid
from typing import Dict, Any, List, Optional
import httpx

from app.config import settings
from app.schemas.voice_schema import (
    VoiceStoryboardRequest,
    VoiceStoryboardResponse,
)

ENTITY_PALETTE = {
    "gateway": {"stroke": "#3b82f6", "bg": "rgba(59, 130, 246, 0.15)", "type": "card"},
    "service": {"stroke": "#d4a359", "bg": "rgba(212, 163, 89, 0.15)", "type": "card"},
    "database": {"stroke": "#10b981", "bg": "rgba(16, 185, 129, 0.15)", "type": "rectangle"},
    "cache": {"stroke": "#f59e0b", "bg": "rgba(245, 158, 11, 0.15)", "type": "rectangle"},
    "queue": {"stroke": "#ec4899", "bg": "rgba(236, 72, 153, 0.15)", "type": "rectangle"},
    "client": {"stroke": "#06b6d4", "bg": "rgba(6, 182, 212, 0.15)", "type": "card"},
    "default": {"stroke": "#d4a359", "bg": "rgba(212, 163, 89, 0.15)", "type": "rectangle"},
}


def _detect_category(name: str) -> str:
    n = name.lower()
    if any(k in n for k in ["gateway", "proxy", "ingress"]):
        return "gateway"
    if any(k in n for k in ["db", "database", "postgres", "mysql", "mongo", "dynamo"]):
        return "database"
    if any(k in n for k in ["cache", "redis", "memcached"]):
        return "cache"
    if any(k in n for k in ["queue", "kafka", "rabbit", "sqs", "pubsub", "broker"]):
        return "queue"
    if any(k in n for k in ["client", "user", "browser", "mobile", "frontend", "ui"]):
        return "client"
    if any(k in n for k in ["service", "auth", "api", "worker", "backend"]):
        return "service"
    return "default"


def _heuristic_storyboard(transcript: str, anchor_x: float, anchor_y: float) -> Dict[str, Any]:
    """Offline heuristic extractor for live storyboarding."""
    words = transcript.lower()
    candidates = []
    
    keyword_map = [
        ("Web Client", ["client", "browser", "frontend", "user"]),
        ("API Gateway", ["gateway", "router", "ingress"]),
        ("Auth Service", ["auth", "login", "jwt", "token"]),
        ("Core API", ["api", "service", "backend"]),
        ("Postgres Database", ["database", "db", "postgres", "sql"]),
        ("Redis Cache", ["cache", "redis"]),
        ("Message Queue", ["queue", "kafka", "event", "pubsub"]),
    ]

    for label, triggers in keyword_map:
        if any(t in words for t in triggers):
            candidates.append(label)

    if not candidates:
        # Default starter system blocks
        candidates = ["Client Application", "Backend API Service", "Primary Database"]

    entities = [{"name": c, "category": _detect_category(c)} for c in candidates]
    relationships = []
    for i in range(len(entities) - 1):
        relationships.append({
            "source": entities[i]["name"],
            "target": entities[i + 1]["name"],
            "protocol": "HTTPS" if i == 0 else "TCP"
        })

    return {"entities": entities, "relationships": relationships}


def generate_storyboard_elements(
    data: Dict[str, Any],
    anchor_x: float = 300.0,
    anchor_y: float = 250.0,
    existing_elements: Optional[List[Dict[str, Any]]] = None
) -> List[Dict[str, Any]]:
    """Builds positioned Graffiti CanvasElement nodes and arrow connectors."""
    # Find bounding box of existing elements to avoid collisions
    if existing_elements:
        max_x = max([e.get("x", 0) + e.get("width", 150) for e in existing_elements] or [anchor_x])
        anchor_x = max(anchor_x, max_x + 100.0)

    entities = data.get("entities", [])
    relationships = data.get("relationships", [])

    elements = []
    name_to_id: Dict[str, str] = {}
    name_to_pos: Dict[str, Dict[str, float]] = {}

    card_w = 180.0
    card_h = 90.0
    gap_x = 220.0
    gap_y = 140.0

    cols = 3

    for idx, ent in enumerate(entities):
        name = ent.get("name", f"Block {idx+1}")
        cat = ent.get("category") or _detect_category(name)
        theme = ENTITY_PALETTE.get(cat, ENTITY_PALETTE["default"])
        node_id = f"block_{cat}_{uuid.uuid4().hex[:6]}"
        name_to_id[name] = node_id

        col = idx % cols
        row = idx // cols
        x_pos = anchor_x + col * (card_w + gap_x)
        y_pos = anchor_y + row * (card_h + gap_y)
        name_to_pos[name] = {"x": x_pos, "y": y_pos, "w": card_w, "h": card_h}

        # Create system block shape
        node_element = {
            "id": node_id,
            "type": "card",
            "x": x_pos,
            "y": y_pos,
            "width": card_w,
            "height": card_h,
            "title": name,
            "bodyText": f"{cat.capitalize()} Component",
            "strokeColor": theme["stroke"],
            "backgroundColor": theme["bg"],
            "strokeWidth": 2.0,
            "strokeStyle": "solid",
            "fillStyle": "semi",
            "roughness": 0.5,
            "fontFamily": "clean",
            "seed": random.randint(1000, 99999),
            "customData": {"isVoiceGenerated": True, "category": cat}
        }
        elements.append(node_element)

    # Generate connecting arrows
    for rel in relationships:
        src_name = rel.get("source")
        tgt_name = rel.get("target")
        proto = rel.get("protocol") or ""

        src_id = name_to_id.get(src_name)
        tgt_id = name_to_id.get(tgt_name)
        src_pos = name_to_pos.get(src_name)
        tgt_pos = name_to_pos.get(tgt_name)

        if src_id and tgt_id and src_pos and tgt_pos:
            arrow_id = f"arrow_{uuid.uuid4().hex[:6]}"
            start_x = src_pos["x"] + src_pos["w"]
            start_y = src_pos["y"] + src_pos["h"] / 2
            end_x = tgt_pos["x"]
            end_y = tgt_pos["y"] + tgt_pos["h"] / 2

            arrow_element = {
                "id": arrow_id,
                "type": "arrow",
                "x": start_x,
                "y": start_y,
                "width": abs(end_x - start_x),
                "height": abs(end_y - start_y),
                "points": [{"x": 0.0, "y": 0.0}, {"x": end_x - start_x, "y": end_y - start_y}],
                "startBinding": {"elementId": src_id, "pointId": "right"},
                "endBinding": {"elementId": tgt_id, "pointId": "left"},
                "arrowType": "curved",
                "strokeColor": "#38bdf8",
                "strokeWidth": 2.0,
                "endArrowhead": "arrow",
                "roughness": 0.5,
                "text": proto,
                "seed": random.randint(1000, 99999),
                "customData": {"isVoiceGenerated": True}
            }
            elements.append(arrow_element)

    return elements


async def generate_voice_storyboard(req: VoiceStoryboardRequest) -> VoiceStoryboardResponse:
    """Uses Gemini 1.5 Flash to dynamically extract architecture blocks from speech and instantiate whiteboard elements."""
    transcript = (req.transcript or "").strip()
    anchor = req.anchorPosition or {"x": 200.0, "y": 200.0}
    anchor_x = anchor.get("x", 200.0)
    anchor_y = anchor.get("y", 200.0)

    if not transcript:
        return VoiceStoryboardResponse(
            success=False,
            newElements=[],
            transcriptSnippet=""
        )

    gemini_key = settings.get_gemini_key()

    prompt = (
        "You are an expert systems storyboarder and technical whiteboard designer.\n"
        "A user is describing a software architecture or system out loud.\n"
        "Analyze the transcript and extract:\n"
        "1. Software entities: name (e.g. 'Payment Gateway', 'Order DB', 'Worker Service') and category ('gateway'|'service'|'database'|'cache'|'queue'|'client').\n"
        "2. Directional relationships: source, target, protocol (e.g. 'REST', 'gRPC', 'SQL', 'Kafka Pub/Sub').\n\n"
        "Return strictly valid JSON with no markdown wrapping:\n"
        "{\n"
        '  "entities": [\n'
        '    {"name": "...", "category": "..."}\n'
        "  ],\n"
        '  "relationships": [\n'
        '    {"source": "...", "target": "...", "protocol": "..."}\n'
        "  ]\n"
        "}\n\n"
        f"Spoken Transcript:\n\"{transcript}\""
    )

    groq_key = settings.get_groq_key()

    # 1. Primary: Groq for ultrafast JSON synthesis
    if groq_key:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=groq_key)
            models_to_try = settings.get_groq_models()
            for m in models_to_try:
                try:
                    completion = await client.chat.completions.create(
                        model=m,
                        messages=[
                            {"role": "system", "content": "You output strictly valid JSON with no markdown formatting."},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.2,
                        response_format={"type": "json_object"}
                    )
                    raw = completion.choices[0].message.content
                    data = json.loads(raw)

                    new_elements = generate_storyboard_elements(
                        data,
                        anchor_x=anchor_x,
                        anchor_y=anchor_y,
                        existing_elements=req.existingElements
                    )

                    entity_names = [e["name"] for e in data.get("entities", [])]
                    rel_names = [f"{r.get('source')} -> {r.get('target')} ({r.get('protocol', '')})" for r in data.get("relationships", [])]

                    entity_count = len(entity_names)
                    rel_count = len(rel_names)
                    summary = (
                        f"I placed {entity_count} component{'s' if entity_count != 1 else ''} on the canvas: "
                        + ", ".join(entity_names[:3])
                        + (f", and {entity_count - 3} more" if entity_count > 3 else "")
                        + f". With {rel_count} connection{'s' if rel_count != 1 else ''} between them."
                    )

                    return VoiceStoryboardResponse(
                        success=True,
                        newElements=new_elements,
                        entitiesDetected=entity_names,
                        relationshipsDetected=rel_names,
                        transcriptSnippet=transcript[:100],
                        summary=summary,
                        aiProvider=f"groq-{m}"
                    )
                except Exception:
                    continue
        except Exception:
            pass

    # 2. Secondary: Gemini Flash
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    resp_json = res.json()
                    parts = resp_json.get("candidates", [])[0].get("content", {}).get("parts", [])
                    raw_text = parts[0].get("text", "{}")
                    data = json.loads(raw_text)

                    new_elements = generate_storyboard_elements(
                        data,
                        anchor_x=anchor_x,
                        anchor_y=anchor_y,
                        existing_elements=req.existingElements
                    )

                    entity_names = [e["name"] for e in data.get("entities", [])]
                    rel_names = [f"{r.get('source')} -> {r.get('target')} ({r.get('protocol', '')})" for r in data.get("relationships", [])]

                    entity_count = len(entity_names)
                    rel_count = len(rel_names)
                    summary = (
                        f"I placed {entity_count} component{'s' if entity_count != 1 else ''} on the canvas: "
                        + ", ".join(entity_names[:3])
                        + (f", and {entity_count - 3} more" if entity_count > 3 else "")
                        + f". With {rel_count} connection{'s' if rel_count != 1 else ''} between them."
                    )

                    return VoiceStoryboardResponse(
                        success=True,
                        newElements=new_elements,
                        entitiesDetected=entity_names,
                        relationshipsDetected=rel_names,
                        transcriptSnippet=transcript[:100],
                        summary=summary,
                        aiProvider=f"gemini-{settings.gemini_model}"
                    )
        except Exception:
            pass

    # Heuristic fallback
    fallback_data = _heuristic_storyboard(transcript, anchor_x, anchor_y)
    new_elements = generate_storyboard_elements(
        fallback_data,
        anchor_x=anchor_x,
        anchor_y=anchor_y,
        existing_elements=req.existingElements
    )

    entity_names = [e["name"] for e in fallback_data.get("entities", [])]
    rel_names = [f"{r.get('source')} -> {r.get('target')} ({r.get('protocol', '')})" for r in fallback_data.get("relationships", [])]

    entity_count = len(entity_names)
    rel_count = len(rel_names)
    summary = (
        f"I placed {entity_count} component{'s' if entity_count != 1 else ''} on the canvas: "
        + ", ".join(entity_names[:3])
        + (f", and {entity_count - 3} more" if entity_count > 3 else "")
        + f". With {rel_count} connection{'s' if rel_count != 1 else ''} between them."
    )

    return VoiceStoryboardResponse(
        success=True,
        newElements=new_elements,
        entitiesDetected=entity_names,
        relationshipsDetected=rel_names,
        transcriptSnippet=transcript[:100],
        summary=summary,
        aiProvider=f"groq-{settings.groq_model}-offline"
    )
