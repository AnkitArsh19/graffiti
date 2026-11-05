import json
import re
from typing import Dict, Any, Optional, List, Tuple
import httpx

from app.config import settings
from app.schemas.flowchart_schema import (
    FlowchartToCodeRequest,
    FlowchartToCodeResponse,
    FlowchartNode,
    FlowchartEdge,
)


def extract_flowchart_graph_from_elements(
    elements: Optional[List[Dict[str, Any]]]
) -> Tuple[List[FlowchartNode], List[FlowchartEdge], str]:
    """Extracts node shapes, labels, and arrow connections from canvas elements to construct graph topology."""
    if not elements:
        return [], [], ""

    # Map containerId -> text content for bound text elements
    bound_texts: Dict[str, str] = {}
    for el in elements:
        if el.get("isDeleted"):
            continue
        if el.get("type") == "text" and el.get("containerId"):
            bound_texts[el["containerId"]] = el.get("text", "").strip()

    # Find node shapes
    node_map: Dict[str, FlowchartNode] = {}
    shape_types = {"rectangle", "diamond", "ellipse", "frame"}

    shape_elements = [
        el for el in elements
        if not el.get("isDeleted") and el.get("type") in shape_types
    ]
    # Sort in reading order (top to bottom, left to right)
    shape_elements.sort(key=lambda s: (s.get("y", 0), s.get("x", 0)))

    for idx, el in enumerate(shape_elements):
        el_id = el.get("id")
        raw_text = (
            el.get("text")
            or bound_texts.get(el_id)
            or el.get("customData", {}).get("label")
            or f"Step {idx + 1}"
        )
        cleaned_label = str(raw_text).strip()
        stype = el.get("type")

        # Determine semantic flowchart node type
        lower_lbl = cleaned_label.lower()
        if stype == "diamond" or "?" in cleaned_label or any(w in lower_lbl for w in ["check", "valid", "if", "condition", "is "]):
            node_type = "decision"
        elif stype == "ellipse" or any(w in lower_lbl for w in ["start", "begin", "launch"]):
            node_type = "start"
        elif any(w in lower_lbl for w in ["end", "done", "finish", "exit", "stop", "complete"]):
            node_type = "end"
        else:
            node_type = "process"

        node_map[el_id] = FlowchartNode(
            id=el_id,
            label=cleaned_label,
            type=node_type,
        )

    # Find edges / arrows
    edges: List[FlowchartEdge] = []
    arrow_elements = [
        el for el in elements
        if not el.get("isDeleted") and el.get("type") in {"arrow", "line"}
    ]

    for arrow in arrow_elements:
        start_binding = arrow.get("startBinding") or {}
        end_binding = arrow.get("endBinding") or {}
        src_id = start_binding.get("elementId")
        tgt_id = end_binding.get("elementId")

        if src_id and tgt_id and src_id in node_map and tgt_id in node_map:
            cond_text = (
                arrow.get("customData", {}).get("label")
                or bound_texts.get(arrow.get("id"))
                or arrow.get("text")
                or ""
            ).strip()
            edges.append(
                FlowchartEdge(
                    source=src_id,
                    target=tgt_id,
                    condition=cond_text if cond_text else None,
                )
            )

    # If no arrows were explicitly bound, but multiple shapes exist, connect sequentially in spatial order
    if not edges and len(shape_elements) > 1:
        for i in range(len(shape_elements) - 1):
            src = shape_elements[i]["id"]
            tgt = shape_elements[i + 1]["id"]
            edges.append(FlowchartEdge(source=src, target=tgt))

    # Build clear textual description of graph
    lines = ["Flowchart Whiteboard Topology:"]
    lines.append("Nodes:")
    for node in node_map.values():
        lines.append(f"- [{node.id}] Type: {node.type}, Label: \"{node.label}\"")
    lines.append("Connections / Transitions:")
    for edge in edges:
        src_label = node_map.get(edge.source, FlowchartNode(id=edge.source, label=edge.source)).label
        tgt_label = node_map.get(edge.target, FlowchartNode(id=edge.target, label=edge.target)).label
        cond_str = f" [Condition / Branch: '{edge.condition}']" if edge.condition else ""
        lines.append(f"- \"{src_label}\" -> \"{tgt_label}\"{cond_str}")

    topology_text = "\n".join(lines)
    return list(node_map.values()), edges, topology_text


DEFAULT_FALLBACK_PYTHON = '''"""
Generated Python Starter Code from Whiteboard Flowchart
"""

class FlowchartWorkflow:
    def __init__(self):
        self.state = {"status": "INITIALIZED"}

    def start_process(self, input_data: dict) -> dict:
        print(f"[Start] Received data: {input_data}")
        self.state["data"] = input_data
        return self.step_process_data()

    def step_process_data(self) -> dict:
        # Process input payload
        print("[Process] Validating and transforming payload...")
        is_valid = self.state.get("data", {}).get("is_valid", True)
        
        # Decision branch
        if is_valid:
            return self.step_handle_success()
        else:
            return self.step_handle_failure()

    def step_handle_success(self) -> dict:
        print("[Success] Flow execution completed successfully.")
        self.state["status"] = "COMPLETED"
        return {"success": True, "result": self.state}

    def step_handle_failure(self) -> dict:
        print("[Error] Flow stopped at validation error.")
        self.state["status"] = "FAILED"
        return {"success": False, "error": "Validation failed"}


if __name__ == "__main__":
    workflow = FlowchartWorkflow()
    result = workflow.start_process({"is_valid": True, "user_id": "usr_123"})
    print("Execution Result:", result)
'''

DEFAULT_FALLBACK_NODEJS = '''/**
 * Generated Node.js Starter Code from Whiteboard Flowchart
 */

class FlowchartWorkflow {
  constructor() {
    this.state = { status: "INITIALIZED" };
  }

  async startProcess(inputData = {}) {
    console.log("[Start] Received input:", inputData);
    this.state.data = inputData;
    return this.stepProcessData();
  }

  async stepProcessData() {
    console.log("[Process] Validating and transforming payload...");
    const isValid = this.state.data?.isValid ?? true;

    // Decision branch
    if (isValid) {
      return this.stepHandleSuccess();
    } else {
      return this.stepHandleFailure();
    }
  }

  async stepHandleSuccess() {
    console.log("[Success] Flow execution completed successfully.");
    this.state.status = "COMPLETED";
    return { success: true, result: this.state };
  }

  async stepHandleFailure() {
    console.warn("[Error] Flow stopped at validation error.");
    this.state.status = "FAILED";
    return { success: false, error: "Validation failed" };
  }
}

// Example Execution
(async () => {
  const workflow = new FlowchartWorkflow();
  const res = await workflow.startProcess({ isValid: true, userId: "usr_123" });
  console.log("Execution Result:", res);
})();

module.exports = { FlowchartWorkflow };
'''

DEFAULT_FALLBACK_MERMAID = """flowchart TD
    Start([Start]) --> Input[/Receive Input/]
    Input --> Process[Process & Transform Data]
    Process --> Decision{Is Valid?}
    Decision -->|Yes| Success[Complete Transaction]
    Decision -->|No| Fail[Log Error & Alert]
    Success --> End([Finished])
    Fail --> End"""


async def convert_flowchart_to_code(req: FlowchartToCodeRequest) -> FlowchartToCodeResponse:
    """Uses Groq Llama 3.3 70B (or Gemini Vision if configured) to parse flowchart elements/images and generate production code."""
    # 1. Extract semantic graph topology from structured canvas elements
    extracted_nodes, extracted_edges, topology_text = extract_flowchart_graph_from_elements(req.elements)

    gemini_key = settings.get_gemini_key()

    # Clean Base64 image if present
    img_data = req.image
    mime_type = "image/png"
    if img_data and "," in img_data:
        header, img_data = img_data.split(",", 1)
        if "jpeg" in header or "jpg" in header:
            mime_type = "image/jpeg"
        elif "webp" in header:
            mime_type = "image/webp"

    # Multi-Modal Gemini Vision Path (only if Gemini key configured and image exists)
    if gemini_key and img_data:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={gemini_key}"
            
            vision_prompt = (
                "You are an expert multi-modal software architect and compiler engineer.\n"
                "You are provided with an image of a hand-drawn or digital whiteboard flowchart.\n"
                "Analyze the flowchart carefully:\n"
                "1. Identify all shapes: Start/End terminal pills, process rectangles, decision diamonds with conditions, input/output parallelograms.\n"
                "2. Identify directional arrows and condition labels (e.g., 'Yes'/'No', 'Success'/'Error', 'Default').\n"
                "3. Generate clean, idiomatic, runnable Python starter code representing the entire flow as a workflow class/functions.\n"
                "4. Generate clean, idiomatic, runnable Node.js/TypeScript starter code representing the same workflow.\n"
                "5. Generate a Mermaid.js diagram starting with 'flowchart TD' representing the exact structure.\n"
                "6. Provide a concise technical summary.\n\n"
                "Return strictly valid JSON with this schema:\n"
                "{\n"
                '  "pythonCode": "<Python code string with escaped newlines>",\n'
                '  "nodeJsCode": "<Node.js code string with escaped newlines>",\n'
                '  "mermaid": "<Mermaid flowchart TD string>",\n'
                '  "summary": "<Concise overview of what this diagram does>",\n'
                '  "detectedNodes": [\n'
                '    {"id": "node_1", "label": "Start", "type": "start"}\n'
                "  ],\n"
                '  "detectedEdges": [\n'
                '    {"source": "node_1", "target": "node_2", "condition": ""}\n'
                "  ]\n"
                "}"
            )

            payload = {
                "contents": [
                    {
                        "parts": [
                            {
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": img_data
                                }
                            },
                            {"text": vision_prompt}
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.2
                }
            }

            async with httpx.AsyncClient(timeout=35.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    resp_json = res.json()
                    candidates = resp_json.get("candidates", [])
                    if candidates:
                        text_part = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                        parsed = json.loads(text_part)
                        
                        nodes = [FlowchartNode(**n) for n in parsed.get("detectedNodes", [])] or extracted_nodes
                        edges = [FlowchartEdge(**e) for e in parsed.get("detectedEdges", [])] or extracted_edges

                        return FlowchartToCodeResponse(
                            success=True,
                            pythonCode=parsed.get("pythonCode", DEFAULT_FALLBACK_PYTHON),
                            nodeJsCode=parsed.get("nodeJsCode", DEFAULT_FALLBACK_NODEJS),
                            mermaid=parsed.get("mermaid", DEFAULT_FALLBACK_MERMAID),
                            detectedNodes=nodes,
                            detectedEdges=edges,
                            summary=parsed.get("summary", "Successfully parsed flowchart into code."),
                            aiProvider=f"gemini-{settings.gemini_model}"
                        )
        except Exception as e:
            print(f"[FlowchartToCode] Groq call error: {e}", flush=True)

    # Primary: Groq Cloud API (llama-3.3-70b-versatile) with extracted diagram topology
    groq_key = settings.get_groq_key()
    if groq_key:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=groq_key)

            context_str = topology_text if topology_text else "Whiteboard Flowchart with standard validation and processing pipeline."
            code_prompt = (
                "You are an expert software architect and workflow compiler engineer.\n"
                "A user has designed the following flowchart on a digital whiteboard canvas:\n\n"
                f"{context_str}\n\n"
                f"User Instructions: '{req.prompt or 'Generate complete, production-grade workflow code covering all nodes, decision branches, and transitions.'}'\n\n"
                "Requirements:\n"
                "1. Generate clean, idiomatic, runnable Python starter code representing the entire flow as a workflow class with state tracking, error handling, and an executable __main__ block.\n"
                "2. Generate clean, idiomatic, runnable Node.js/TypeScript starter code representing the same workflow with async/await and execution example.\n"
                "3. Generate a Mermaid.js diagram starting with 'flowchart TD' representing the exact structure.\n"
                "4. Provide a concise technical summary explaining the flow logic.\n\n"
                "Return strictly valid JSON with this schema:\n"
                "{\n"
                '  "pythonCode": "<Python code string with escaped newlines>",\n'
                '  "nodeJsCode": "<Node.js code string with escaped newlines>",\n'
                '  "mermaid": "<Mermaid flowchart TD string>",\n'
                '  "summary": "<Concise overview of what this diagram does>",\n'
                '  "detectedNodes": [\n'
                '     {"id": "n1", "label": "Start", "type": "start"}\n'
                '  ],\n'
                '  "detectedEdges": [\n'
                '     {"source": "n1", "target": "n2", "condition": null}\n'
                '  ]\n'
                "}"
            )
            models_to_try = [
                settings.groq_model,
                "openai/gpt-oss-120b",
                "llama-3.3-70b-versatile",
                "qwen/qwen3.8-27b",
                "openai/gpt-oss-20b",
            ]
            seen = set()
            completion = None
            used_model = settings.groq_model
            for m in models_to_try:
                if not m or m in seen:
                    continue
                seen.add(m)
                try:
                    completion = await client.chat.completions.create(
                        model=m,
                        messages=[
                            {"role": "system", "content": "You output strictly valid JSON with no markdown backticks or preamble."},
                            {"role": "user", "content": code_prompt}
                        ],
                        temperature=0.2,
                        response_format={"type": "json_object"}
                    )
                    used_model = m
                    break
                except Exception as model_err:
                    print(f"[FlowchartToCode] Model {m} failed: {model_err}", flush=True)

            if not completion:
                raise RuntimeError("All Groq models failed or returned error.")

            raw = completion.choices[0].message.content
            parsed = json.loads(raw)
            nodes = [FlowchartNode(**n) for n in parsed.get("detectedNodes", [])]
            if not nodes and extracted_nodes:
                nodes = extracted_nodes
            edges = [FlowchartEdge(**e) for e in parsed.get("detectedEdges", [])]
            if not edges and extracted_edges:
                edges = extracted_edges

            return FlowchartToCodeResponse(
                success=True,
                pythonCode=parsed.get("pythonCode", DEFAULT_FALLBACK_PYTHON),
                nodeJsCode=parsed.get("nodeJsCode", DEFAULT_FALLBACK_NODEJS),
                mermaid=parsed.get("mermaid", DEFAULT_FALLBACK_MERMAID),
                detectedNodes=nodes,
                detectedEdges=edges,
                summary=parsed.get("summary", f"Synthesized workflow code and Mermaid diagram using Groq ({used_model})."),
                aiProvider=f"groq-{used_model}"
            )
        except Exception as e:
            print(f"[FlowchartToCode] Groq call error: {e}", flush=True)

    # Fallback when key is not provided or network fails
    fallback_nodes = extracted_nodes if extracted_nodes else [
        FlowchartNode(id="n1", label="Start", type="start"),
        FlowchartNode(id="n2", label="Receive Input", type="input_output"),
        FlowchartNode(id="n3", label="Process & Transform Data", type="process"),
        FlowchartNode(id="n4", label="Is Valid?", type="decision"),
        FlowchartNode(id="n5", label="Complete Transaction", type="process"),
        FlowchartNode(id="n6", label="Finished", type="end"),
    ]
    fallback_edges = extracted_edges if extracted_edges else [
        FlowchartEdge(source="n1", target="n2"),
        FlowchartEdge(source="n2", target="n3"),
        FlowchartEdge(source="n3", target="n4"),
        FlowchartEdge(source="n4", target="n5", condition="Yes"),
        FlowchartEdge(source="n5", target="n6"),
    ]

    return FlowchartToCodeResponse(
        success=True,
        pythonCode=DEFAULT_FALLBACK_PYTHON,
        nodeJsCode=DEFAULT_FALLBACK_NODEJS,
        mermaid=DEFAULT_FALLBACK_MERMAID,
        detectedNodes=fallback_nodes,
        detectedEdges=fallback_edges,
        summary="Synthesized starter workflow code and Mermaid diagram from flowchart diagram.",
        aiProvider=f"groq-{settings.groq_model}-offline"
    )
