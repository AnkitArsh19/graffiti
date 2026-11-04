import json
import math
import random
import uuid
from typing import List, Dict, Any, Optional
import httpx

from app.config import settings
from app.schemas.mindmap_schema import (
    MindMapNodeInput,
    MindMapAutoLayoutRequest,
    MindMapAutoLayoutResponse,
    MindMapRelationship,
)


def _heuristic_hierarchy(nodes: List[MindMapNodeInput]) -> Dict[str, Any]:
    """Offline heuristic clustering for mind-map layout when API keys are absent."""
    if not nodes:
        return {"rootId": None, "hierarchy": [], "relationships": []}
    
    # Pick root: prefer node with shortest text or broadest term, or first node
    scored = []
    for idx, n in enumerate(nodes):
        txt = (n.text or "").strip()
        # Common root keywords get highest priority
        is_hub = any(k in txt.lower() for k in ["core", "root", "architecture", "system", "overview", "project", "app"])
        score = (100 if is_hub else 0) - len(txt)
        scored.append((score, idx, n))
    scored.sort(key=lambda x: x[0], reverse=True)
    root_node = scored[0][2]
    root_id = root_node.id

    hierarchy = [{"id": root_id, "parentId": None, "depth": 0, "order": 0}]
    relationships = []

    remaining = [n for n in nodes if n.id != root_id]
    
    # Divide into branches (level 1) and leaves (level 2) if more than 4 nodes
    if len(remaining) <= 4:
        for idx, n in enumerate(remaining):
            hierarchy.append({"id": n.id, "parentId": root_id, "depth": 1, "order": idx})
            relationships.append(MindMapRelationship(sourceId=root_id, targetId=n.id, label="includes"))
    else:
        # First 3-4 are main branches, rest are attached to them
        num_branches = min(4, max(2, int(math.ceil(len(remaining) / 3))))
        branches = remaining[:num_branches]
        leaves = remaining[num_branches:]

        for b_idx, b in enumerate(branches):
            hierarchy.append({"id": b.id, "parentId": root_id, "depth": 1, "order": b_idx})
            relationships.append(MindMapRelationship(sourceId=root_id, targetId=b.id, label="category"))

        for l_idx, leaf in enumerate(leaves):
            parent_branch = branches[l_idx % len(branches)]
            hierarchy.append({"id": leaf.id, "parentId": parent_branch.id, "depth": 2, "order": l_idx})
            relationships.append(MindMapRelationship(sourceId=parent_branch.id, targetId=leaf.id, label="detail"))

    return {
        "rootId": root_id,
        "hierarchy": hierarchy,
        "relationships": relationships
    }


async def _llm_hierarchy(nodes: List[MindMapNodeInput], preferred_model: str = "auto") -> Dict[str, Any]:
    """Uses Groq (llama-3.1-70b-versatile) or Gemini 1.5 Flash to evaluate semantic relationships."""
    node_summaries = [
        {"id": n.id, "text": n.text or "Untitled Note", "type": n.type}
        for n in nodes
    ]

    prompt = (
        "You are an expert cognitive mind-mapping and information layout agent.\n"
        "Analyze the following whiteboard nodes and determine their semantic relationship.\n"
        "1. Identify the single central theme or root node.\n"
        "2. Form hierarchical relationships: root -> main branches (depth 1) -> child concepts/leaves (depth 2).\n"
        "Return ONLY a valid JSON object with the following structure:\n"
        "{\n"
        '  "rootId": "<id of central node>",\n'
        '  "hierarchy": [\n'
        '    {"id": "<nodeId>", "parentId": "<parentNodeId or null for root>", "depth": <integer>, "order": <integer>}\n'
        "  ],\n"
        '  "relationships": [\n'
        '    {"sourceId": "<parentId>", "targetId": "<childId>", "label": "<short relationship verb>"}\n'
        "  ]\n"
        "}\n\n"
        f"Nodes:\n{json.dumps(node_summaries, indent=2)}"
    )

    groq_key = settings.get_groq_key()
    gemini_key = settings.get_gemini_key()

    # 1. Groq (llama-3.1-70b-versatile)
    if (preferred_model in ["groq", "auto"] and groq_key) or (not gemini_key and groq_key):
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=groq_key)
            completion = await client.chat.completions.create(
                model=settings.groq_model,
                messages=[
                    {"role": "system", "content": "You output strictly valid JSON with no markdown backticks."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            raw = completion.choices[0].message.content
            parsed = json.loads(raw)
            parsed["aiProvider"] = "groq-llama-3.1-70b-versatile"
            return parsed
        except Exception:
            pass

    # 2. Gemini 1.5 Flash
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            async with httpx.AsyncClient(timeout=15.0) as http_client:
                res = await http_client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    text_out = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(text_out)
                    parsed["aiProvider"] = "gemini-1.5-flash"
                    return parsed
        except Exception:
            pass

    # Fallback to semantic heuristic
    fallback = _heuristic_hierarchy(nodes)
    fallback["aiProvider"] = "heuristic-offline"
    return fallback


def compute_mindmap_layout(
    nodes: List[MindMapNodeInput],
    hierarchy_data: Dict[str, Any],
    anchor_x: Optional[float] = None,
    anchor_y: Optional[float] = None
) -> MindMapAutoLayoutResponse:
    """Calculates non-overlapping coordinates in a balanced two-sided horizontal mind-map tree."""
    if not nodes:
        return MindMapAutoLayoutResponse(nodes=[], connectors=[], relationships=[])

    node_map = {n.id: n.model_dump() for n in nodes}
    root_id = hierarchy_data.get("rootId") or nodes[0].id

    # Compute origin anchor: default to centroid of selected nodes
    if anchor_x is None:
        anchor_x = sum(n.x for n in nodes) / len(nodes)
    if anchor_y is None:
        anchor_y = sum(n.y for n in nodes) / len(nodes)

    # Position Root Node at center
    root_node = node_map.get(root_id, nodes[0].model_dump())
    root_w = root_node.get("width") or 180.0
    root_h = root_node.get("height") or 80.0
    root_x = anchor_x - (root_w / 2)
    root_y = anchor_y - (root_h / 2)

    root_node["x"] = root_x
    root_node["y"] = root_y
    root_node["strokeWidth"] = 3
    root_node["roughness"] = 1.0

    # Build parent -> children tree
    children_by_parent: Dict[str, List[str]] = {}
    for h in hierarchy_data.get("hierarchy", []):
        p_id = h.get("parentId")
        c_id = h.get("id")
        if p_id and c_id and c_id != root_id:
            children_by_parent.setdefault(p_id, []).append(c_id)

    # If root has no children registered, make all other nodes direct children
    if root_id not in children_by_parent:
        children_by_parent[root_id] = [n.id for n in nodes if n.id != root_id]

    # Partition direct branches into Right (50%) and Left (50%) sides
    main_branches = children_by_parent.get(root_id, [])
    half = int(math.ceil(len(main_branches) / 2))
    right_branches = main_branches[:half]
    left_branches = main_branches[half:]

    updated_nodes: List[Dict[str, Any]] = [root_node]
    connectors: List[Dict[str, Any]] = []

    def layout_branch(child_ids: List[str], side: str, depth: int, parent_x: float, parent_y: float, parent_w: float, parent_h: float, parent_id: str):
        total = len(child_ids)
        spacing_y = 120.0
        horizontal_gap = 140.0

        for i, c_id in enumerate(child_ids):
            c_node = node_map.get(c_id)
            if not c_node:
                continue
            c_w = c_node.get("width") or 160.0
            c_h = c_node.get("height") or 70.0

            # Vertical offset centered on parent
            y_offset = (i - (total - 1) / 2) * spacing_y
            target_y = parent_y + (parent_h / 2) - (c_h / 2) + y_offset

            if side == "right":
                target_x = parent_x + parent_w + horizontal_gap
                start_pt_id = "right"
                end_pt_id = "left"
                arrow_start_x = parent_x + parent_w
                arrow_end_x = target_x
            else:
                target_x = parent_x - c_w - horizontal_gap
                start_pt_id = "left"
                end_pt_id = "right"
                arrow_start_x = parent_x
                arrow_end_x = target_x + c_w

            arrow_start_y = parent_y + parent_h / 2
            arrow_end_y = target_y + c_h / 2

            c_node["x"] = target_x
            c_node["y"] = target_y
            updated_nodes.append(c_node)

            # Generate aesthetic curved connector arrow
            arrow_id = f"connector_{parent_id}_{c_id}_{uuid.uuid4().hex[:6]}"
            connector = {
                "id": arrow_id,
                "type": "arrow",
                "x": arrow_start_x,
                "y": arrow_start_y,
                "width": abs(arrow_end_x - arrow_start_x),
                "height": abs(arrow_end_y - arrow_start_y),
                "points": [
                    {"x": 0.0, "y": 0.0},
                    {"x": arrow_end_x - arrow_start_x, "y": arrow_end_y - arrow_start_y}
                ],
                "startBinding": {"elementId": parent_id, "pointId": start_pt_id},
                "endBinding": {"elementId": c_id, "pointId": end_pt_id},
                "arrowType": "curved",
                "strokeColor": "#6366f1" if depth == 1 else "#a855f7",
                "strokeWidth": 2.0 if depth == 1 else 1.5,
                "strokeStyle": "solid",
                "endArrowhead": "arrow",
                "roughness": 0.8,
                "opacity": 0.9,
                "seed": random.randint(1000, 99999)
            }
            connectors.append(connector)

            # Layout sub-children (depth 2)
            sub_children = children_by_parent.get(c_id, [])
            if sub_children:
                layout_branch(sub_children, side, depth + 1, target_x, target_y, c_w, c_h, c_id)

    # Layout right and left sides
    layout_branch(right_branches, "right", 1, root_x, root_y, root_w, root_h, root_id)
    layout_branch(left_branches, "left", 1, root_x, root_y, root_w, root_h, root_id)

    # Deduplicate in case any node wasn't in hierarchy
    placed_ids = {n["id"] for n in updated_nodes}
    unplaced = [node_map[nid] for nid in node_map if nid not in placed_ids]
    for idx, un in enumerate(unplaced):
        un["x"] = root_x + (idx + 1) * 200.0
        un["y"] = root_y + root_h + 150.0
        updated_nodes.append(un)

    relationships = [
        MindMapRelationship(**r) if isinstance(r, dict) else r
        for r in hierarchy_data.get("relationships", [])
    ]

    return MindMapAutoLayoutResponse(
        success=True,
        rootNodeId=root_id,
        nodes=updated_nodes,
        connectors=connectors,
        relationships=relationships,
        aiProvider=hierarchy_data.get("aiProvider", "groq-llama-3.1-70b-versatile"),
        summary=f"Organized {len(updated_nodes)} nodes into clean hierarchical mind-map around '{root_node.get('text', 'Root')}'."
    )


async def auto_layout_mindmap(request: MindMapAutoLayoutRequest) -> MindMapAutoLayoutResponse:
    """Entry point for Mind-Map Auto-Layout agent."""
    if not request.elements:
        return MindMapAutoLayoutResponse(
            success=False,
            nodes=[],
            connectors=[],
            summary="No nodes provided for layout."
        )

    hierarchy = await _llm_hierarchy(request.elements, preferred_model=request.preferredModel or "auto")
    return compute_mindmap_layout(
        request.elements,
        hierarchy,
        anchor_x=request.anchorX,
        anchor_y=request.anchorY
    )
