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
    """Extracts nodes and directional connections from raw Graffiti canvas elements."""
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    node_id_set = set()

    # Identify nodes: rectangles, diamonds, ellipses, stickies, cards, text
    for el in elements:
        t = (el.get("type") or "").lower()
        eid = el.get("id") or ""
        txt = el.get("text") or el.get("title") or ""

        if t in ["rectangle", "ellipse", "diamond", "sticky", "card", "text"]:
            node_type = "process"
            if t == "diamond" or "?" in txt or any(k in txt.lower() for k in ["if", "valid", "check", "verify"]):
                node_type = "decision"
            elif any(k in txt.lower() for k in ["start", "begin", "init", "launch"]):
                node_type = "start"
            elif any(k in txt.lower() for k in ["end", "stop", "finish", "complete", "done"]):
                node_type = "end"
            elif t == "ellipse" and not txt:
                node_type = "start"

            label = txt if txt else f"{t.capitalize()} Node"
            nodes.append({"id": eid, "label": label, "nodeType": node_type, "raw": el})
            node_id_set.add(eid)

    # Identify edges: arrows and lines
    for el in elements:
        t = (el.get("type") or "").lower()
        if t in ["arrow", "line"]:
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
                label = el.get("text") or ""
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
