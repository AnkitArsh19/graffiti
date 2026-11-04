import json
import math
from typing import Dict, Any, List, Optional
import httpx

from app.config import settings
from app.schemas.simulation_schema import (
    FlowSimulateRequest,
    FlowSimulateResponse,
    SimulationStep,
    StateGraphNode,
    StateGraphEdge,
)


def _extract_graph_heuristics(elements: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Extracts nodes and directional connections from raw Graffiti canvas elements with spatial proximity parsing."""
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    node_id_set = set()

    shape_elements = [
        el for el in elements
        if (el.get("type") or "").lower() in ["rectangle", "ellipse", "diamond", "sticky", "card"]
    ]
    arrow_elements = [
        el for el in elements
        if (el.get("type") or "").lower() in ["arrow", "line"]
    ]
    text_elements = [
        el for el in elements
        if (el.get("type") or "").lower() == "text"
    ]

    consumed_text_ids = set()

    # 1. Explicit container / boundElement resolution
    for t_el in text_elements:
        cid = t_el.get("containerId")
        if cid:
            matching_shape = next((s for s in shape_elements if s.get("id") == cid), None)
            if matching_shape:
                if not (matching_shape.get("text") or "").strip():
                    matching_shape["text"] = (t_el.get("text") or "").strip()
                consumed_text_ids.add(t_el.get("id"))
                continue
            matching_arrow = next((a for a in arrow_elements if a.get("id") == cid), None)
            if matching_arrow:
                if not (matching_arrow.get("text") or "").strip():
                    matching_arrow["text"] = (t_el.get("text") or "").strip()
                consumed_text_ids.add(t_el.get("id"))
                continue

    # 2. Spatial proximity parsing: associate floating text labels inside or near shape borders.
    #    Uses AABB (axis-aligned bounding box) intersection with a 100px expansion threshold.
    SHAPE_PROXIMITY_PX = 100.0
    for shape in shape_elements:
        sx = float(shape.get("x", 0))
        sy = float(shape.get("y", 0))
        sw = float(shape.get("width") or 100)
        sh = float(shape.get("height") or 60)

        # Expand shape bounds by SHAPE_PROXIMITY_PX in all directions for AABB check
        exp_x0 = sx - SHAPE_PROXIMITY_PX
        exp_y0 = sy - SHAPE_PROXIMITY_PX
        exp_x1 = sx + sw + SHAPE_PROXIMITY_PX
        exp_y1 = sy + sh + SHAPE_PROXIMITY_PX

        # Check unconsumed text elements
        nearby_texts = []
        for t_el in text_elements:
            if t_el.get("id") in consumed_text_ids:
                continue
            txt = (t_el.get("text") or "").strip()
            if not txt:
                continue

            tx = float(t_el.get("x", 0))
            ty = float(t_el.get("y", 0))
            tw = float(t_el.get("width") or 60)
            th = float(t_el.get("height") or 30)

            # AABB intersection check: does text bbox overlap the expanded shape bbox?
            if tx < exp_x1 and tx + tw > exp_x0 and ty < exp_y1 and ty + th > exp_y0:
                # Use centroid distance to rank candidates
                tcx = tx + tw / 2.0
                tcy = ty + th / 2.0
                dx = max(sx - tcx, 0.0, tcx - (sx + sw))
                dy = max(sy - tcy, 0.0, tcy - (sy + sh))
                border_dist = math.hypot(dx, dy)
                nearby_texts.append((border_dist, t_el))

        if nearby_texts:
            nearby_texts.sort(key=lambda x: x[0])
            # If shape text is empty or generic, associate the closest floating label
            current_shape_text = (shape.get("text") or shape.get("title") or "").strip()
            if not current_shape_text:
                best_text_el = nearby_texts[0][1]
                shape["text"] = (best_text_el.get("text") or "").strip()
                consumed_text_ids.add(best_text_el.get("id"))

    # 3. Spatial proximity parsing: associate floating text near arrow midpoints (e.g. Yes/No branch labels)
    for arrow in arrow_elements:
        if (arrow.get("text") or "").strip():
            continue
        pts = arrow.get("points") or []
        ax = float(arrow.get("x", 0))
        ay = float(arrow.get("y", 0))
        mid_pt = None

        if len(pts) >= 2:
            p_start = (ax + pts[0].get("x", 0), ay + pts[0].get("y", 0))
            p_end = (ax + pts[-1].get("x", 0), ay + pts[-1].get("y", 0))
            mid_pt = ((p_start[0] + p_end[0]) / 2.0, (p_start[1] + p_end[1]) / 2.0)
        else:
            sb = arrow.get("startBinding") or {}
            eb = arrow.get("endBinding") or {}
            src_s = next((s for s in shape_elements if s.get("id") == sb.get("elementId")), None)
            tgt_s = next((s for s in shape_elements if s.get("id") == eb.get("elementId")), None)
            if src_s and tgt_s:
                scx = float(src_s.get("x", 0)) + float(src_s.get("width") or 100) / 2.0
                scy = float(src_s.get("y", 0)) + float(src_s.get("height") or 60) / 2.0
                tcx = float(tgt_s.get("x", 0)) + float(tgt_s.get("width") or 100) / 2.0
                tcy = float(tgt_s.get("y", 0)) + float(tgt_s.get("height") or 60) / 2.0
                mid_pt = ((scx + tcx) / 2.0, (scy + tcy) / 2.0)
            else:
                mid_pt = (ax + float(arrow.get("width") or 0) / 2.0, ay + float(arrow.get("height") or 0) / 2.0)

        if mid_pt:
            best_t = None
            best_d = 999999
            for t_el in text_elements:
                if t_el.get("id") in consumed_text_ids:
                    continue
                txt = (t_el.get("text") or "").strip()
                if not txt:
                    continue
                tx = float(t_el.get("x", 0)) + float(t_el.get("width") or 40) / 2.0
                ty = float(t_el.get("y", 0)) + float(t_el.get("height") or 20) / 2.0
                d = math.hypot(tx - mid_pt[0], ty - mid_pt[1])
                if d < best_d and d <= 90.0:
                    best_d = d
                    best_t = t_el

            if best_t:
                arrow["text"] = (best_t.get("text") or "").strip()
                consumed_text_ids.add(best_t.get("id"))

    # 4. Build nodes: shapes + unconsumed standalone text elements
    step_counter = 1
    for shape in shape_elements:
        t = (shape.get("type") or "").lower()
        eid = shape.get("id") or ""
        txt = (shape.get("text") or shape.get("title") or "").strip()

        node_type = "process"
        if t == "diamond" or "?" in txt or any(k in txt.lower() for k in ["if", "valid", "check", "verify", "is"]):
            node_type = "decision"
        elif any(k in txt.lower() for k in ["start", "begin", "init", "launch"]):
            node_type = "start"
        elif any(k in txt.lower() for k in ["end", "stop", "finish", "complete", "done"]):
            node_type = "end"
        elif t == "ellipse" and (not txt or "start" in txt.lower()):
            node_type = "start"

        if txt:
            label = txt
        else:
            label = f"Step {step_counter}"
            step_counter += 1
        nodes.append({"id": eid, "label": label, "nodeType": node_type, "raw": shape})
        node_id_set.add(eid)

    for t_el in text_elements:
        if t_el.get("id") not in consumed_text_ids:
            txt = (t_el.get("text") or "").strip()
            if txt:
                eid = t_el.get("id") or ""
                nodes.append({"id": eid, "label": txt, "nodeType": "process", "raw": t_el})
                node_id_set.add(eid)

    # 5. Build edges: arrows and lines
    for el in arrow_elements:
        eid = el.get("id") or ""
        sb = el.get("startBinding") or {}
        eb = el.get("endBinding") or {}
        src = sb.get("elementId")
        tgt = eb.get("elementId")

        # If not explicitly bound by startBinding/endBinding, use spatial proximity
        if not src or not tgt or src not in node_id_set or tgt not in node_id_set:
            pts = el.get("points") or []
            el_x = el.get("x", 0)
            el_y = el.get("y", 0)
            if len(pts) >= 2:
                p_start = (el_x + pts[0].get("x", 0), el_y + pts[0].get("y", 0))
                p_end = (el_x + pts[-1].get("x", 0), el_y + pts[-1].get("y", 0))

                def find_closest_node(pt):
                    best_n = None
                    best_dist = 999999
                    for n in nodes:
                        nel = n["raw"]
                        cx = nel.get("x", 0) + nel.get("width", 100) / 2
                        cy = nel.get("y", 0) + nel.get("height", 60) / 2
                        d = math.hypot(pt[0] - cx, pt[1] - cy)
                        if d < best_dist and d < 350:
                            best_dist = d
                            best_n = n["id"]
                    return best_n

                src = src if (src and src in node_id_set) else find_closest_node(p_start)
                tgt = tgt if (tgt and tgt in node_id_set) else find_closest_node(p_end)

        if src and tgt and src != tgt:
            label = (el.get("text") or "").strip()
            edges.append({
                "id": eid,
                "sourceId": src,
                "targetId": tgt,
                "label": label,
                "condition": label if label else None
            })

    return {"nodes": nodes, "edges": edges}


def _simulate_graph_locally(graph_data: Dict[str, Any], initial_inputs: Dict[str, Any]) -> FlowSimulateResponse:
    """Deterministic step-by-step state simulation through the extracted graph."""
    nodes = graph_data["nodes"]
    edges = graph_data["edges"]

    if not nodes:
        return FlowSimulateResponse(
            success=False,
            graphNodes=[],
            graphEdges=[],
            executionSteps=[],
            flowSummary="No flowchart nodes found on canvas."
        )

    # Pick start node
    start_node = next((n for n in nodes if n["nodeType"] == "start"), nodes[0])
    curr_id = start_node["id"]

    steps: List[SimulationStep] = []
    visited = set()
    state_vars = dict(initial_inputs) if initial_inputs else {"transactionId": "tx_9812", "retries": 0, "status": "START"}
    
    step_idx = 0
    max_steps = 15

    while curr_id and step_idx < max_steps:
        curr_node = next((n for n in nodes if n["id"] == curr_id), None)
        if not curr_node:
            break

        is_term = curr_node["nodeType"] == "end" or step_idx == max_steps - 1
        out_edges = [e for e in edges if e["sourceId"] == curr_id]

        active_edge = out_edges[0] if out_edges else None
        next_id = active_edge["targetId"] if active_edge else None

        # Handle decisions with branching
        if curr_node["nodeType"] == "decision" and len(out_edges) > 1:
            # Prefer 'yes' or 'true' or 'success' edge
            yes_edge = next((e for e in out_edges if any(k in (e.get("label") or "").lower() for k in ["yes", "true", "ok", "valid", "pass"])), out_edges[0])
            active_edge = yes_edge
            next_id = active_edge["targetId"]
            state_vars["decisionResult"] = active_edge.get("label") or "Passed"

        desc = f"Executing {curr_node['nodeType'].upper()}: {curr_node['label']}"
        log_msg = f"Step {step_idx + 1}: Data entered node '{curr_node['label']}'."
        if active_edge and active_edge.get("label"):
            log_msg += f" Taking branch '{active_edge['label']}'."

        steps.append(SimulationStep(
            stepIndex=step_idx,
            activeNodeId=curr_id,
            activeEdgeId=active_edge["id"] if active_edge else None,
            stepDescription=desc,
            stateVariables=dict(state_vars),
            log=log_msg,
            isTerminal=is_term
        ))

        visited.add(curr_id)
        if is_term or not next_id or next_id in visited:
            break

        curr_id = next_id
        step_idx += 1

    return FlowSimulateResponse(
        success=True,
        graphNodes=[StateGraphNode(**n) for n in nodes],
        graphEdges=[StateGraphEdge(**e) for e in edges],
        executionSteps=steps,
        totalSteps=len(steps),
        flowSummary=f"Simulated execution trace through {len(steps)} steps from '{start_node['label']}'.",
        aiProvider="simulation-local-heuristic"
    )


async def simulate_flow(req: FlowSimulateRequest) -> FlowSimulateResponse:
    """Behavioral Execution Engine: converts drawn directional shapes into an executable state graph and simulation trace."""
    graph_data = _extract_graph_heuristics(req.elements)
    nodes = graph_data["nodes"]
    edges = graph_data["edges"]

    if not nodes:
        return FlowSimulateResponse(
            success=False,
            flowSummary="No flowchart elements found on canvas. Draw nodes and connecting arrows to simulate."
        )

    groq_key = settings.get_groq_key()
    gemini_key = settings.get_gemini_key()

    prompt = (
        "You are an expert distributed systems execution and state-machine simulation engine.\n"
        "You are given a list of nodes and directional edges from a whiteboard diagram.\n"
        "1. Identify the logical start node.\n"
        "2. Parse the step-by-step state transition graph.\n"
        "3. Simulate data flowing through the flowchart from start to end, evaluating decisions (e.g., condition checks, payload validation).\n"
        "4. Return an ordered array of simulation steps showing which node and edge is active at each step, what state variables mutate, and a log message.\n\n"
        "Return strictly valid JSON with this schema:\n"
        "{\n"
        '  "flowSummary": "<overview of this system flow>",\n'
        '  "executionSteps": [\n'
        '    {\n'
        '      "stepIndex": 0,\n'
        '      "activeNodeId": "<nodeId>",\n'
        '      "activeEdgeId": "<edgeId or null>",\n'
        '      "stepDescription": "<what happens at this step>",\n'
        '      "stateVariables": {"status": "SUCCESS", "latencyMs": 42},\n'
        '      "log": "<runtime log string>",\n'
        '      "isTerminal": false\n'
        '    }\n'
        "  ]\n"
        "}\n\n"
        f"Initial Inputs: {json.dumps(req.initialInputs)}\n"
        f"Nodes:\n{json.dumps([{'id': n['id'], 'label': n['label'], 'type': n['nodeType']} for n in nodes])}\n"
        f"Edges:\n{json.dumps([{'id': e['id'], 'from': e['sourceId'], 'to': e['targetId'], 'label': e['label']} for e in edges])}"
    )

    # 1. Primary: Groq (llama-3.1-70b-versatile)
    if groq_key:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=groq_key)
            completion = await client.chat.completions.create(
                model=settings.groq_model,
                messages=[
                    {"role": "system", "content": "You output strictly valid JSON with no markdown formatting."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            raw = completion.choices[0].message.content
            parsed = json.loads(raw)
            sim_steps = [SimulationStep(**s) for s in parsed.get("executionSteps", [])]

            return FlowSimulateResponse(
                success=True,
                graphNodes=[StateGraphNode(**n) for n in nodes],
                graphEdges=[StateGraphEdge(**e) for e in edges],
                executionSteps=sim_steps,
                totalSteps=len(sim_steps),
                flowSummary=parsed.get("flowSummary", "Simulation executed successfully."),
                aiProvider="groq-llama-3.1-70b-versatile"
            )
        except Exception:
            pass

    # 2. Secondary: Gemini 1.5 Flash
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
                    sim_steps = [SimulationStep(**s) for s in parsed.get("executionSteps", [])]

                    return FlowSimulateResponse(
                        success=True,
                        graphNodes=[StateGraphNode(**n) for n in nodes],
                        graphEdges=[StateGraphEdge(**e) for e in edges],
                        executionSteps=sim_steps,
                        totalSteps=len(sim_steps),
                        flowSummary=parsed.get("flowSummary", "Simulation executed successfully."),
                        aiProvider="gemini-1.5-flash"
                    )
        except Exception:
            pass

    # Fallback to local heuristic topological traversal
    return _simulate_graph_locally(graph_data, req.initialInputs or {})
