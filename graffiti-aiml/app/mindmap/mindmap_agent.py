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
    MindMapGenerateRequest,
    MindMapAutoLayoutResponse,
    MindMapRelationship,
)


PARENT_DOMAINS = [
    "artificial intelligence", "machine learning", "deep learning", "system design",
    "software architecture", "data science", "cloud computing", "computer science",
    "web development", "cyber security", "database management", "distributed systems",
    "operating systems", "microservices", "cloud architecture", "full stack development"
]

HUB_KEYWORDS = [
    "core", "root", "architecture", "system", "overview", "project", "app", "main", "hub",
    "central", "parent", "platform", "framework", "fundamentals", "foundations", "introduction",
    "domain", "concept", "principles", "infrastructure"
]

LEAF_ACRONYMS = {
    "nlp", "cv", "rl", "cnn", "rnn", "lstm", "gan", "svm", "knn", "bert", "gpt", "rag",
    "api", "db", "sdk", "cli", "css", "html", "dom", "jwt", "sql", "nosql", "etl", "k8s",
    "orm", "gui", "crud", "ci/cd", "ci", "cd", "rest", "graphql"
}

SUBTOPIC_KEYWORDS = [
    "subtopic", "component", "module", "detail", "step", "test", "leaf", "feature",
    "endpoint", "util", "helper", "cache", "worker", "algorithm", "technique", "method"
]


def _score_root_candidate(txt: str) -> float:
    """Calculates semantic priority score for a node being the central root of a mindmap."""
    t_clean = (txt or "").strip()
    t_lower = t_clean.lower()
    if not t_clean:
        return -999.0

    score = 0.0

    # 1. Exact or partial match with major parent umbrella domains
    for domain in PARENT_DOMAINS:
        if domain == t_lower:
            score += 300.0
        elif domain in t_lower:
            score += 200.0

    # 2. General hub / architecture keywords
    for k in HUB_KEYWORDS:
        if k in t_lower:
            score += 100.0

    # 3. Penalize subtopics / leaves
    for s in SUBTOPIC_KEYWORDS:
        if s in t_lower:
            score -= 100.0

    # 4. Strongly penalize abbreviations and leaf acronyms (e.g. NLP, CV, DB)
    words = t_clean.split()
    if t_lower in LEAF_ACRONYMS or (len(words) == 1 and t_clean.isupper() and len(t_clean) <= 5):
        score -= 250.0

    # 5. Semantic breadth: multi-word parent topics (e.g. "Artificial Intelligence")
    if 2 <= len(words) <= 5:
        score += 40.0
    elif len(words) == 1 and len(t_clean) > 3 and t_lower not in LEAF_ACRONYMS:
        score += 10.0

    # 6. Prefer standard title length over tiny acronyms (< 5 chars)
    if 10 <= len(t_clean) <= 45:
        score += 30.0
    elif len(t_clean) < 5:
        score -= 50.0

    return score


def _heuristic_hierarchy(nodes: List[MindMapNodeInput]) -> Dict[str, Any]:
    """Offline heuristic clustering for mind-map layout when API keys are absent."""
    if not nodes:
        return {"rootId": None, "hierarchy": [], "relationships": []}
    
    # 1. Identify central root node: give explicit semantic priority to parent umbrella topics
    scored = []
    for idx, n in enumerate(nodes):
        txt = (n.text or "").strip()
        score = _score_root_candidate(txt)
        scored.append((score, idx, n))
    scored.sort(key=lambda x: x[0], reverse=True)
    root_node = scored[0][2]
    root_id = root_node.id

    hierarchy = [{"id": root_id, "parentId": None, "depth": 0, "order": 0}]
    relationships: List[MindMapRelationship] = []

    remaining = [n for n in nodes if n.id != root_id]
    
    # Connect all remaining child nodes to the central root node
    for idx, n in enumerate(remaining):
        hierarchy.append({"id": n.id, "parentId": root_id, "depth": 1, "order": idx})
        relationships.append(MindMapRelationship(sourceId=root_id, targetId=n.id, label="branch"))

    return {
        "rootId": root_id,
        "hierarchy": hierarchy,
        "relationships": relationships
    }


async def _llm_hierarchy(nodes: List[MindMapNodeInput], preferred_model: str = "auto") -> Dict[str, Any]:
    """Uses Groq (openai/gpt-oss-120b) to evaluate semantic relationships."""
    node_summaries = [
        {"id": n.id, "text": n.text or "Untitled Note", "type": n.type}
        for n in nodes
    ]

    prompt = (
        "You are an expert cognitive mind-mapping and information layout agent.\n"
        "Analyze the following whiteboard nodes and determine their semantic relationship.\n"
        "1. Identify the single central theme or root node.\n"
        "   CRITICAL ROOT IDENTIFICATION RULE:\n"
        "   Give explicit semantic priority to parent topics and overarching umbrella domains (e.g. 'Artificial Intelligence', 'Cloud Architecture') as the central root node.\n"
        "   Never select shorter abbreviations, acronyms, or specific sub-topics (e.g. 'NLP', 'CV', 'API', 'DB') as the central root node when a broader parent topic exists.\n"
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

    # 1. Groq
    if (preferred_model in ["groq", "auto"] and groq_key) or (not gemini_key and groq_key):
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=groq_key)
            models_to_try = settings.get_groq_models()
            for m in models_to_try:
                try:
                    completion = await client.chat.completions.create(
                        model=m,
                        messages=[
                            {"role": "system", "content": "You output strictly valid JSON with no markdown backticks."},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.2,
                        response_format={"type": "json_object"}
                    )
                    raw = completion.choices[0].message.content
                    parsed = json.loads(raw)
                    parsed["aiProvider"] = f"groq-{m}"
                    return parsed
                except Exception:
                    continue
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
                    parsed["aiProvider"] = f"gemini-{settings.gemini_model}"
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
    """
    Calculates non-overlapping coordinates in a balanced bidirectional mind-map tree:
    1. Places central root node at anchor.
    2. Symmetrically distributes child nodes (half on the right, half on the left) with clean vertical spacing.
    3. Generates curved connector arrows from the central root node to each child node.
    """
    if not nodes:
        return MindMapAutoLayoutResponse(nodes=[], connectors=[], relationships=[])

    node_map: Dict[str, Dict[str, Any]] = {n.id: n.model_dump() for n in nodes}
    root_id = hierarchy_data.get("rootId")

    # Semantic guardrail: verify root node priority so acronyms/subtopics never override parent topics
    best_candidate_node = max(nodes, key=lambda n: _score_root_candidate(n.text or ""))
    best_candidate_id = best_candidate_node.id
    if not root_id or root_id not in node_map:
        root_id = best_candidate_id
    else:
        current_root_score = _score_root_candidate(node_map[root_id].get("text") or "")
        best_score = _score_root_candidate(node_map[best_candidate_id].get("text") or "")
        if best_score > current_root_score + 100.0:
            root_id = best_candidate_id

    # Compute origin anchor: centroid of selected nodes
    if anchor_x is None:
        anchor_x = sum(n.x for n in nodes) / len(nodes)
    if anchor_y is None:
        anchor_y = sum(n.y for n in nodes) / len(nodes)

    # 1. Position central root node at exact center
    root_node = node_map[root_id]
    root_w = float(root_node.get("width") or 180.0)
    root_h = float(root_node.get("height") or 80.0)
    root_x = anchor_x - (root_w / 2.0)
    root_y = anchor_y - (root_h / 2.0)

    root_node["x"] = root_x
    root_node["y"] = root_y
    root_node["strokeWidth"] = 3.0
    root_node["roughness"] = 1.0

    # 2. Build parent -> children map from hierarchy
    children_by_parent: Dict[str, List[str]] = {}
    for h in hierarchy_data.get("hierarchy", []):
        p_id = h.get("parentId")
        c_id = h.get("id")
        if p_id and c_id and c_id != root_id and c_id in node_map:
            children_by_parent.setdefault(p_id, []).append(c_id)

    # Collect direct children of root
    direct_children = list(children_by_parent.get(root_id, []))

    # Ensure every non-root node in node_map is accounted for
    all_assigned = {root_id}
    for p_id, c_list in children_by_parent.items():
        all_assigned.update(c_list)
    for n in nodes:
        if n.id not in all_assigned:
            direct_children.append(n.id)
            all_assigned.add(n.id)

    # 3. Distribute direct child nodes symmetrically: half on Right, half on Left
    right_branches: List[str] = []
    left_branches: List[str] = []
    for idx, c_id in enumerate(direct_children):
        if idx % 2 == 0:
            right_branches.append(c_id)
        else:
            left_branches.append(c_id)

    updated_nodes: List[Dict[str, Any]] = [root_node]
    connectors: List[Dict[str, Any]] = []
    generated_relationships: List[MindMapRelationship] = []

    horizontal_gap = 160.0

    def get_branch_height(node_id: str) -> float:
        subs = children_by_parent.get(node_id, [])
        node_h = float(node_map.get(node_id, {}).get("height") or 70.0)
        if not subs:
            return node_h
        # Symmetrically centered sub-children span
        sub_span_y = (len(subs) - 1) * 90.0 + 60.0
        return max(node_h, sub_span_y)

    def layout_side(side_ids: List[str], side: str):
        k = len(side_ids)
        if k == 0:
            return

        branch_heights = [get_branch_height(c_id) for c_id in side_ids]
        margin_y = 35.0
        total_span_y = sum(branch_heights) + max(0, k - 1) * margin_y
        current_y = (root_y + root_h / 2.0) - (total_span_y / 2.0)

        for i, c_id in enumerate(side_ids):
            c_node = node_map.get(c_id)
            if not c_node:
                continue
            c_w = float(c_node.get("width") or 160.0)
            c_h = float(c_node.get("height") or 70.0)
            b_height = branch_heights[i]

            branch_center_y = current_y + b_height / 2.0
            current_y += b_height + margin_y

            target_y = branch_center_y - (c_h / 2.0)

            if side == "right":
                target_x = root_x + root_w + horizontal_gap
                start_pt_id = "right"
                end_pt_id = "left"
                arrow_start_x = root_x + root_w
                arrow_end_x = target_x
            else:
                target_x = root_x - c_w - horizontal_gap
                start_pt_id = "left"
                end_pt_id = "right"
                arrow_start_x = root_x
                arrow_end_x = target_x + c_w

            arrow_start_y = root_y + root_h / 2.0
            arrow_end_y = branch_center_y

            c_node["x"] = target_x
            c_node["y"] = target_y
            updated_nodes.append(c_node)

            # Generate aesthetic curved connector arrow
            arrow_id = f"connector_{root_id}_{c_id}_{uuid.uuid4().hex[:6]}"
            dx = arrow_end_x - arrow_start_x
            dy = arrow_end_y - arrow_start_y
            mid_x = dx * 0.5
            mid_y = dy * 0.5

            connector = {
                "id": arrow_id,
                "type": "arrow",
                "x": arrow_start_x,
                "y": arrow_start_y,
                "width": max(1.0, abs(dx)),
                "height": max(1.0, abs(dy)),
                "points": [
                    {"x": 0.0, "y": 0.0},
                    {"x": mid_x, "y": mid_y},
                    {"x": dx, "y": dy}
                ],
                "startBinding": {"elementId": root_id, "pointId": start_pt_id},
                "endBinding": {"elementId": c_id, "pointId": end_pt_id},
                "arrowType": "curved",
                "strokeColor": "#d4a359",
                "strokeWidth": 2.5,
                "strokeStyle": "solid",
                "endArrowhead": "arrow",
                "roughness": 0.6,
                "opacity": 100,
                "seed": random.randint(1000, 99999)
            }
            connectors.append(connector)
            generated_relationships.append(
                MindMapRelationship(sourceId=root_id, targetId=c_id, label="branch")
            )

            # Symmetrically position any depth-2 sub-children of this branch
            sub_children = children_by_parent.get(c_id, [])
            sub_k = len(sub_children)
            if sub_k > 0:
                sub_span_y = (sub_k - 1) * 90.0
                sub_start_y = branch_center_y - (sub_span_y / 2.0)

                for j, sub_id in enumerate(sub_children):
                    sub_node = node_map.get(sub_id)
                    if not sub_node:
                        continue
                    sub_w = float(sub_node.get("width") or 150.0)
                    sub_h = float(sub_node.get("height") or 60.0)
                    sub_center_y = sub_start_y + j * 90.0
                    sub_target_y = sub_center_y - (sub_h / 2.0)

                    if side == "right":
                        sub_target_x = target_x + c_w + (horizontal_gap * 0.85)
                        sub_arrow_start_x = target_x + c_w
                        sub_arrow_end_x = sub_target_x
                        sub_start_pt = "right"
                        sub_end_pt = "left"
                    else:
                        sub_target_x = target_x - sub_w - (horizontal_gap * 0.85)
                        sub_arrow_start_x = target_x
                        sub_arrow_end_x = sub_target_x + sub_w
                        sub_start_pt = "left"
                        sub_end_pt = "right"

                    sub_node["x"] = sub_target_x
                    sub_node["y"] = sub_target_y
                    updated_nodes.append(sub_node)

                    sub_dx = sub_arrow_end_x - sub_arrow_start_x
                    sub_dy = sub_center_y - branch_center_y
                    sub_connector = {
                        "id": f"connector_{c_id}_{sub_id}_{uuid.uuid4().hex[:6]}",
                        "type": "arrow",
                        "x": sub_arrow_start_x,
                        "y": branch_center_y,
                        "width": max(1.0, abs(sub_dx)),
                        "height": max(1.0, abs(sub_dy)),
                        "points": [
                            {"x": 0.0, "y": 0.0},
                            {"x": sub_dx * 0.5, "y": sub_dy * 0.5},
                            {"x": sub_dx, "y": sub_dy}
                        ],
                        "startBinding": {"elementId": c_id, "pointId": sub_start_pt},
                        "endBinding": {"elementId": sub_id, "pointId": sub_end_pt},
                        "arrowType": "curved",
                        "strokeColor": "#d4a359",
                        "strokeWidth": 2.0,
                        "strokeStyle": "solid",
                        "endArrowhead": "arrow",
                        "roughness": 0.6,
                        "opacity": 100,
                        "seed": random.randint(1000, 99999)
                    }
                    connectors.append(sub_connector)
                    generated_relationships.append(
                        MindMapRelationship(sourceId=c_id, targetId=sub_id, label="detail")
                    )

    # Execute symmetrical layout on both Right and Left sides
    layout_side(right_branches, "right")
    layout_side(left_branches, "left")

    return MindMapAutoLayoutResponse(
        success=True,
        rootNodeId=root_id,
        nodes=updated_nodes,
        connectors=connectors,
        relationships=generated_relationships,
        aiProvider=hierarchy_data.get("aiProvider", f"groq-{settings.groq_model}"),
        summary=f"Organized {len(updated_nodes)} nodes into symmetrical balanced bidirectional mind-map around '{root_node.get('text', 'Central Theme')}'."
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


def _parse_markdown_tree(markdown_text: str) -> Dict[str, Any]:
    """Parses markmap-style markdown (# Root, ## Branch, - Subtopic) into structured tree."""
    lines = [ln.rstrip() for ln in (markdown_text or "").splitlines() if ln.strip()]
    root_title = "Central Theme"
    branches: List[Dict[str, Any]] = []
    current_branch: Optional[Dict[str, Any]] = None

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("# ") and not stripped.startswith("## "):
            root_title = stripped[2:].strip()
        elif stripped.startswith("## ") and not stripped.startswith("### "):
            current_branch = {"title": stripped[3:].strip(), "children": []}
            branches.append(current_branch)
        elif stripped.startswith("### "):
            if current_branch is None:
                current_branch = {"title": "Main Topic", "children": []}
                branches.append(current_branch)
            current_branch["children"].append(stripped[4:].strip())
        elif stripped.startswith("- ") or stripped.startswith("* "):
            item = stripped[2:].strip()
            indent = len(line) - len(line.lstrip())
            if indent >= 4 and current_branch is not None:
                current_branch["children"].append(item)
            else:
                if current_branch is None or indent == 0:
                    current_branch = {"title": item, "children": []}
                    branches.append(current_branch)
                else:
                    current_branch["children"].append(item)

    if not branches and root_title:
        branches = [{"title": "Overview", "children": []}]

    return {"root": root_title, "branches": branches}


def _fallback_topic_tree(prompt_text: str) -> Dict[str, Any]:
    """Deterministic topic decomposition fallback when no LLM key is reachable."""
    clean = (prompt_text or "System Architecture").strip().title()
    return {
        "root": clean,
        "branches": [
            {"title": "Core Architecture", "children": ["Data Models", "State Flow", "API Gateway"]},
            {"title": "Services & Logic", "children": ["Authentication", "Business Logic", "Event Pipeline"]},
            {"title": "Infrastructure", "children": ["Database", "Cache / Redis", "Deployment"]},
            {"title": "Observability", "children": ["Metrics & Logs", "E2E Testing", "Health Checks"]}
        ]
    }


async def _generate_hierarchy_llm(prompt_text: str, preferred_model: str = "auto") -> Dict[str, Any]:
    """Generates structured mind-map hierarchy from topic prompt using Groq or Gemini."""
    prompt = (
        "You are an expert cognitive mind-mapping and information architecture agent.\n"
        f"Create a structured mind-map hierarchy for the topic: '{prompt_text}'.\n"
        "Return ONLY a strictly valid JSON object with this exact structure:\n"
        "{\n"
        '  "root": "<Impactful short title for the central node (1-3 words)>",\n'
        '  "branches": [\n'
        '    {\n'
        '      "title": "<Main branch 1 name (1-3 words)>",\n'
        '      "children": ["<Subtopic 1a>", "<Subtopic 1b>"]\n'
        '    },\n'
        '    {\n'
        '      "title": "<Main branch 2 name (1-3 words)>",\n'
        '      "children": ["<Subtopic 2a>", "<Subtopic 2b>"]\n'
        '    }\n'
        '  ]\n'
        "}\n"
        "Generate 4 to 6 main branches with 2 to 3 subtopics each. Keep every title concise, clear, and impactful."
    )

    groq_key = settings.get_groq_key()
    gemini_key = settings.get_gemini_key()

    if (preferred_model in ["groq", "auto"] and groq_key) or (not gemini_key and groq_key):
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
                        temperature=0.3,
                        response_format={"type": "json_object"}
                    )
                    raw = completion.choices[0].message.content
                    tree = json.loads(raw)
                    if "root" in tree and "branches" in tree:
                        tree["aiProvider"] = f"groq-{m}"
                        return tree
                except Exception:
                    continue
        except Exception:
            pass

    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0.3}
            }
            async with httpx.AsyncClient(timeout=15.0) as http_client:
                res = await http_client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    text_out = data["candidates"][0]["content"]["parts"][0]["text"]
                    tree = json.loads(text_out)
                    if "root" in tree and "branches" in tree:
                        tree["aiProvider"] = f"gemini-{settings.gemini_model}"
                        return tree
        except Exception:
            pass

    fallback = _fallback_topic_tree(prompt_text)
    fallback["aiProvider"] = "offline-heuristic"
    return fallback


async def generate_mindmap(request: MindMapGenerateRequest) -> MindMapAutoLayoutResponse:
    """Generates a complete mind-map (nodes + arrows) from a topic prompt or markdown outline."""
    ai_provider = "offline-heuristic"
    if request.markdown and request.markdown.strip():
        tree = _parse_markdown_tree(request.markdown)
        ai_provider = "markdown-parser"
    elif request.prompt and request.prompt.strip():
        tree = await _generate_hierarchy_llm(request.prompt, preferred_model=request.preferredModel or "auto")
        ai_provider = tree.get("aiProvider", "groq-llm")
    else:
        tree = _fallback_topic_tree("Mind Map")

    root_title = tree.get("root") or "Central Theme"
    branches = tree.get("branches", [])

    root_id = f"mm_root_{uuid.uuid4().hex[:6]}"
    anchor_x = request.anchorX or 400.0
    anchor_y = request.anchorY or 300.0

    root_node_input = MindMapNodeInput(
        id=root_id,
        text=root_title,
        type="rectangle",
        x=anchor_x - 90.0,
        y=anchor_y - 40.0,
        width=180.0,
        height=80.0,
        strokeColor="#d4a359",
        backgroundColor="rgba(212, 163, 89, 0.18)"
    )

    all_node_inputs: List[MindMapNodeInput] = [root_node_input]
    hierarchy: List[Dict[str, Any]] = [{"id": root_id, "parentId": None, "depth": 0, "order": 0}]
    relationships: List[MindMapRelationship] = []

    for b_idx, b in enumerate(branches):
        b_title = b.get("title") or f"Branch {b_idx + 1}"
        b_id = f"mm_branch_{uuid.uuid4().hex[:6]}"
        b_node = MindMapNodeInput(
            id=b_id,
            text=b_title,
            type="rectangle",
            x=anchor_x,
            y=anchor_y,
            width=160.0,
            height=65.0,
            strokeColor="#d4a359",
            backgroundColor="rgba(212, 163, 89, 0.12)"
        )
        all_node_inputs.append(b_node)
        hierarchy.append({"id": b_id, "parentId": root_id, "depth": 1, "order": b_idx})
        relationships.append(MindMapRelationship(sourceId=root_id, targetId=b_id, label="branch"))

        for s_idx, s_title in enumerate(b.get("children", [])):
            s_id = f"mm_sub_{uuid.uuid4().hex[:6]}"
            s_node = MindMapNodeInput(
                id=s_id,
                text=str(s_title),
                type="rectangle",
                x=anchor_x,
                y=anchor_y,
                width=140.0,
                height=55.0,
                strokeColor="#b47b18",
                backgroundColor="rgba(212, 163, 89, 0.08)"
            )
            all_node_inputs.append(s_node)
            hierarchy.append({"id": s_id, "parentId": b_id, "depth": 2, "order": s_idx})
            relationships.append(MindMapRelationship(sourceId=b_id, targetId=s_id, label="detail"))

    hierarchy_data = {
        "rootId": root_id,
        "hierarchy": hierarchy,
        "relationships": relationships,
        "aiProvider": ai_provider
    }

    result = compute_mindmap_layout(
        all_node_inputs,
        hierarchy_data,
        anchor_x=anchor_x,
        anchor_y=anchor_y
    )
    result.summary = f"Generated mind-map for '{root_title}' with {len(branches)} branches ({len(all_node_inputs)} nodes total)."
    return result
