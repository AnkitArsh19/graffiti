import ast
import json
import re
import textwrap
from typing import Dict, Any, Optional, List, Tuple
import httpx

from app.config import settings
from app.schemas.flowchart_schema import (
    FlowchartToCodeRequest,
    FlowchartToCodeResponse,
    FlowchartNode,
    FlowchartEdge,
)


def clean_code_string(code: str) -> str:
    """Strips markdown fences and unescapes double-escaped newlines."""
    if not code:
        return ""
    text = code.strip()

    # Strip markdown code blocks ```python ... ``` or ```javascript ... ```
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z0-9_\-]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
        text = text.strip()

    # If string contains literal \n characters (double-escaped from JSON)
    if "\\n" in text and "\n" not in text:
        text = text.replace("\\n", "\n").replace("\\t", "    ")

    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text


def format_python_code(code: str) -> str:
    """Produces cleanly indented, PEP 8 compliant Python code with strict 4 spaces."""
    raw = clean_code_string(code)
    if not raw:
        return ""

    # Normalize tabs to 4 spaces
    lines = [line.replace("\t", "    ").rstrip() for line in raw.split("\n")]
    dedented = textwrap.dedent("\n".join(lines)).strip()

    # Try AST unparse for perfect 4-space indentation and formatting
    try:
        tree = ast.parse(dedented)
        formatted = ast.unparse(tree)
        # Add clean spacing around if __name__ == '__main__':
        formatted = re.sub(r"\n(if __name__ == ['\"]__main__['\"]:\s*)", r"\n\n\1", formatted)
        # Add double newline after top-level function / class definitions if missing
        formatted = re.sub(r"(\n    return [^\n]+)\n(def )", r"\1\n\n\2", formatted)
        return formatted.strip() + "\n"
    except Exception:
        # Fallback: line-by-line block indentation normalizer
        pass

    out_lines = []
    indent_level = 0
    indent_str = "    "

    block_starters = re.compile(
        r"^(def\s+|class\s+|if\s+|elif\s+|else\s*:|for\s+|while\s+|try\s*:|except(\s+.*)?:|finally\s*:|with\s+)"
    )
    dedent_starters = re.compile(r"^(elif\s+|else\s*:|except(\s+.*)?:|finally\s*:)")

    for line in dedented.split("\n"):
        stripped = line.strip()
        if not stripped:
            out_lines.append("")
            continue

        if dedent_starters.match(stripped):
            current_indent = max(0, indent_level - 1)
        else:
            current_indent = indent_level

        out_lines.append(f"{indent_str * current_indent}{stripped}")

        if stripped.endswith(":") and block_starters.match(stripped):
            indent_level += 1

    return "\n".join(out_lines).strip() + "\n"


def format_nodejs_code(code: str) -> str:
    """Produces cleanly indented, 2-space formatted JavaScript / Node.js code."""
    raw = clean_code_string(code)
    if not raw:
        return ""

    lines = [line.replace("\t", "  ").rstrip() for line in raw.split("\n")]
    dedented = textwrap.dedent("\n".join(lines)).strip()

    out_lines = []
    indent_level = 0
    indent_str = "  "

    for line in dedented.split("\n"):
        stripped = line.strip()
        if not stripped:
            out_lines.append("")
            continue

        close_count = stripped.count("}") + stripped.count("]")
        open_count = stripped.count("{") + stripped.count("[")

        leading_closes = 0
        for ch in stripped:
            if ch in "}]":
                leading_closes += 1
            elif ch not in " \t":
                break

        actual_indent = max(0, indent_level - leading_closes)
        out_lines.append(f"{indent_str * actual_indent}{stripped}")

        indent_level = max(0, indent_level + (open_count - close_count))

    return "\n".join(out_lines).strip() + "\n"


def clean_label_to_code(label: str, lang: str = "python") -> str:
    """Translates a node label into a clean, direct code statement."""
    lbl = (label or "").strip()
    if not lbl:
        return 'print("Step completed")' if lang == "python" else 'console.log("Step completed");'

    # Check for print statement: print "hello world" or print("hello world")
    print_match = re.match(r'^(?:print|log|echo|output|display)\s*[\("]?([^"\)]+)["\)]?$', lbl, re.IGNORECASE)
    if print_match:
        msg = print_match.group(1).strip()
        return f'print("{msg}")' if lang == "python" else f'console.log("{msg}");'

    # Check if direct quoted string "hello world"
    if (lbl.startswith('"') and lbl.endswith('"')) or (lbl.startswith("'") and lbl.endswith("'")):
        msg = lbl[1:-1]
        return f'print("{msg}")' if lang == "python" else f'console.log("{msg}");'

    # Check for assignment: x = 10
    assign_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$', lbl)
    if assign_match:
        var = assign_match.group(1)
        val = assign_match.group(2)
        return f"{var} = {val}" if lang == "python" else f"const {var} = {val};"

    # Descriptive statement
    safe_func = re.sub(r'[^a-zA-Z0-9_]', '_', lbl.lower()).strip('_')
    safe_func = re.sub(r'_+', '_', safe_func) or "process_step"
    if lang == "python":
        return f"# {lbl}\n{safe_func}()"
    else:
        return f"// {lbl}\n{safe_func}();"


def generate_smart_fallback(
    nodes: List[FlowchartNode],
    edges: List[FlowchartEdge],
) -> Tuple[str, str, str, str]:
    """Generates clean, direct starter code strictly tailored to flowchart complexity."""
    action_nodes = [n for n in nodes if n.type not in ("start", "end")]
    decisions = [n for n in nodes if n.type == "decision"]

    # 1. Simple Sequential Flow (no decisions)
    if not decisions:
        if not action_nodes:
            py_body = '    print("Workflow executed successfully.")'
            js_body = '  console.log("Workflow executed successfully.");'
        else:
            py_lines = []
            js_lines = []
            for n in action_nodes:
                stmt_py = clean_label_to_code(n.label, "python")
                for s in stmt_py.split("\n"):
                    py_lines.append(f"    {s}")
                stmt_js = clean_label_to_code(n.label, "nodejs")
                for s in stmt_js.split("\n"):
                    js_lines.append(f"  {s}")
            py_body = "\n".join(py_lines)
            js_body = "\n".join(js_lines)

        py_code = f"""def main():\n{py_body}\n\nif __name__ == "__main__":\n    main()\n"""
        js_code = f"""function main() {{\n{js_body}\n}}\n\nmain();\n"""
        summary = "Sequential flow without decision branches."
    else:
        # Branching flow
        dec = decisions[0]
        out_edges = [e for e in edges if e.source == dec.id]
        node_map = {n.id: n for n in nodes}

        cond_label = dec.label.rstrip("?")
        cond_slug_py = re.sub(r'[^a-zA-Z0-9_]', '_', cond_label.lower()).strip('_') or "condition"
        cond_slug_js = re.sub(r'[^a-zA-Z0-9_]', '', cond_label.title()) or "Condition"

        py_branches = []
        js_branches = []

        if not out_edges:
            py_branches.append(f"    if is_{cond_slug_py}:\n        print('Branch passed')\n    else:\n        print('Branch failed')")
            js_branches.append(f"  if (is{cond_slug_js}) {{\n    console.log('Branch passed');\n  }} else {{\n    console.log('Branch failed');\n  }}")
        else:
            for idx, edge in enumerate(out_edges):
                target_node = node_map.get(edge.target)
                tgt_label = target_node.label if target_node else "Next Step"
                cond = edge.condition or ("Yes" if idx == 0 else "No")

                py_action = clean_label_to_code(tgt_label, "python")
                js_action = clean_label_to_code(tgt_label, "nodejs")

                if idx == 0:
                    py_branches.append(f"    if is_{cond_slug_py}:\n        {py_action}")
                    js_branches.append(f"  if (is{cond_slug_js}) {{\n    {js_action}\n  }}")
                else:
                    py_branches.append(f"    else:\n        {py_action}")
                    js_branches.append(f"  else {{\n    {js_action}\n  }}")

        py_body = "\n".join(py_branches)
        js_body = "\n".join(js_branches)

        py_code = f"""def run_flow(is_{cond_slug_py}: bool = True):\n{py_body}\n\nif __name__ == "__main__":\n    run_flow()\n"""
        js_code = f"""function runFlow(is{cond_slug_js} = true) {{\n{js_body}\n}}\n\nrunFlow();\n"""
        summary = f"Branching decision workflow based on '{dec.label}'."

    # Build Mermaid
    mermaid_lines = ["flowchart TD"]
    node_id_clean = {}
    for idx, n in enumerate(nodes):
        nid = f"N{idx + 1}"
        node_id_clean[n.id] = nid
        lbl = n.label.replace('"', "'")
        if n.type in ("start", "end"):
            mermaid_lines.append(f"    {nid}([{lbl}])")
        elif n.type == "decision":
            mermaid_lines.append(f"    {nid}{{{lbl}}}")
        else:
            mermaid_lines.append(f"    {nid}[{lbl}]")

    for e in edges:
        src = node_id_clean.get(e.source, e.source)
        tgt = node_id_clean.get(e.target, e.target)
        if e.condition:
            mermaid_lines.append(f"    {src} -->|{e.condition}| {tgt}")
        else:
            mermaid_lines.append(f"    {src} --> {tgt}")

    mermaid_code = "\n".join(mermaid_lines)
    return format_python_code(py_code), format_nodejs_code(js_code), mermaid_code, summary


def extract_flowchart_graph_from_elements(
    elements: Optional[List[Dict[str, Any]]]
) -> Tuple[List[FlowchartNode], List[FlowchartEdge], str]:
    """Extracts node shapes, labels, and arrow connections from canvas elements to construct graph topology."""
    if not elements:
        return [], [], ""

    bound_texts: Dict[str, str] = {}
    for el in elements:
        if el.get("isDeleted"):
            continue
        if el.get("type") == "text" and el.get("containerId"):
            bound_texts[el["containerId"]] = el.get("text", "").strip()

    node_map: Dict[str, FlowchartNode] = {}
    shape_types = {"rectangle", "diamond", "ellipse", "frame"}

    shape_elements = [
        el for el in elements
        if not el.get("isDeleted") and el.get("type") in shape_types
    ]
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

    if not edges and len(shape_elements) > 1:
        for i in range(len(shape_elements) - 1):
            src = shape_elements[i]["id"]
            tgt = shape_elements[i + 1]["id"]
            edges.append(FlowchartEdge(source=src, target=tgt))

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


async def convert_flowchart_to_code(req: FlowchartToCodeRequest) -> FlowchartToCodeResponse:
    """Uses Groq Llama 3.3 70B (or Gemini Vision if configured) to parse flowchart elements/images and generate production code."""
    extracted_nodes, extracted_edges, topology_text = extract_flowchart_graph_from_elements(req.elements)

    gemini_key = settings.get_gemini_key()

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
                "You are provided with an image of a hand-drawn or digital whiteboard flowchart.\n\n"
                "CRITICAL ARCHITECTURAL RULES:\n"
                "1. CODE COMPLEXITY MUST MATCH FLOWCHART COMPLEXITY:\n"
                "   - For simple sequential flows (e.g. Start -> Print 'Hello World' -> End, or 1-4 linear steps):\n"
                "     * Output minimal, direct, idiomatic code (e.g. a simple def main() in Python, function main() in Node.js).\n"
                "     * DO NOT create unnecessary classes, state machines, or complex workflows.\n"
                "     * DO NOT add artificial logging statements like '[Start]...', '[Process]...', '[Success]...'.\n"
                "     * Implement the actual action specified in each node directly.\n"
                "   - For decision flows (branching with 'if/else', conditions):\n"
                "     * Implement clean if/else branching.\n"
                "     * Only create helper functions if needed for readability.\n"
                "     * Do NOT add verbose mock logging.\n"
                "   - For complex multi-step pipelines (>6 nodes with complex loops or state):\n"
                "     * Organize into clean, modular functions or a concise class only if state management is genuinely needed.\n\n"
                "2. INDENTATION AND SYNTAX:\n"
                "   - Python code MUST use strict 4-space indentation for every nested block.\n"
                "   - Node.js code MUST use strict 2-space indentation.\n"
                "   - Never mix tabs and spaces. Return clean code strings without markdown backticks.\n\n"
                "3. MERMAID DIAGRAM:\n"
                "   - Output a clean 'flowchart TD' string representing the exact nodes and directional transitions.\n\n"
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

                        raw_py = parsed.get("pythonCode", "")
                        raw_js = parsed.get("nodeJsCode", "")

                        if not raw_py or not raw_js:
                            fb_py, fb_js, fb_mm, fb_sm = generate_smart_fallback(nodes, edges)
                            raw_py = raw_py or fb_py
                            raw_js = raw_js or fb_js

                        return FlowchartToCodeResponse(
                            success=True,
                            pythonCode=format_python_code(raw_py),
                            nodeJsCode=format_nodejs_code(raw_js),
                            mermaid=parsed.get("mermaid", generate_smart_fallback(nodes, edges)[2]),
                            detectedNodes=nodes,
                            detectedEdges=edges,
                            summary=parsed.get("summary", "Successfully parsed flowchart into clean code."),
                            aiProvider=f"gemini-{settings.gemini_model}"
                        )
        except Exception as e:
            print(f"[FlowchartToCode] Gemini Vision error: {e}", flush=True)

    # Primary: Groq Cloud API with extracted diagram topology
    groq_key = settings.get_groq_key()
    if groq_key:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=groq_key)

            context_str = topology_text if topology_text else "Whiteboard Flowchart"
            code_prompt = (
                "You are an expert software compiler and software engineer.\n"
                "A user has designed the following flowchart on a whiteboard canvas:\n\n"
                f"{context_str}\n\n"
                f"User Instructions: '{req.prompt or 'Translate this flowchart faithfully into clean, working code.'}'\n\n"
                "CRITICAL ARCHITECTURAL RULES:\n"
                "1. CODE COMPLEXITY MUST MATCH FLOWCHART COMPLEXITY:\n"
                "   - For simple sequential flows (e.g. Start -> Print 'Hello World' -> End, or 1-4 linear steps):\n"
                "     * Output minimal, direct, idiomatic code (e.g. a simple def main() in Python, function main() in Node.js).\n"
                "     * DO NOT create unnecessary classes, state machines, or complex workflows.\n"
                "     * DO NOT add artificial logging statements like '[Start]...', '[Process]...', '[Success]...'.\n"
                "     * Implement the actual action specified in each node directly.\n"
                "   - For decision flows (branching with 'if/else', conditions):\n"
                "     * Implement clean if/else branching.\n"
                "     * Only create helper functions if needed for readability.\n"
                "     * Do NOT add verbose mock logging.\n"
                "   - For complex multi-step pipelines (>6 nodes with complex loops or state):\n"
                "     * Organize into clean, modular functions or a concise class only if state management is genuinely needed.\n\n"
                "2. INDENTATION AND SYNTAX:\n"
                "   - Python code MUST use strict 4-space indentation for every nested block.\n"
                "   - Node.js code MUST use strict 2-space indentation.\n"
                "   - Never mix tabs and spaces. Return clean code strings without markdown backticks.\n\n"
                "3. MERMAID DIAGRAM:\n"
                "   - Output a clean 'flowchart TD' string representing the exact nodes and directional transitions.\n\n"
                "Return strictly valid JSON with this schema:\n"
                "{\n"
                '  "pythonCode": "<Clean, perfectly indented Python code string with escaped newlines>",\n'
                '  "nodeJsCode": "<Clean, perfectly indented Node.js code string with escaped newlines>",\n'
                '  "mermaid": "<Mermaid flowchart TD string>",\n'
                '  "summary": "<Concise 1-sentence overview of what this diagram does>",\n'
                '  "detectedNodes": [\n'
                '     {"id": "n1", "label": "Start", "type": "start"}\n'
                '  ],\n'
                '  "detectedEdges": [\n'
                '     {"source": "n1", "target": "n2", "condition": null}\n'
                '  ]\n'
                "}"
            )
            models_to_try = settings.get_groq_models()
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

            raw_py = parsed.get("pythonCode", "")
            raw_js = parsed.get("nodeJsCode", "")

            if not raw_py or not raw_js:
                fb_py, fb_js, fb_mm, fb_sm = generate_smart_fallback(nodes, edges)
                raw_py = raw_py or fb_py
                raw_js = raw_js or fb_js

            return FlowchartToCodeResponse(
                success=True,
                pythonCode=format_python_code(raw_py),
                nodeJsCode=format_nodejs_code(raw_js),
                mermaid=parsed.get("mermaid", generate_smart_fallback(nodes, edges)[2]),
                detectedNodes=nodes,
                detectedEdges=edges,
                summary=parsed.get("summary", f"Synthesized clean code and Mermaid diagram using Groq ({used_model})."),
                aiProvider=f"groq-{used_model}"
            )
        except Exception as e:
            print(f"[FlowchartToCode] Groq call error: {e}", flush=True)

    # Fallback directly tailored to extracted nodes and edges
    fallback_nodes = extracted_nodes if extracted_nodes else [
        FlowchartNode(id="n1", label="Start", type="start"),
        FlowchartNode(id="n2", label="print 'hello world'", type="process"),
        FlowchartNode(id="n3", label="End", type="end"),
    ]
    fallback_edges = extracted_edges if extracted_edges else [
        FlowchartEdge(source="n1", target="n2"),
        FlowchartEdge(source="n2", target="n3"),
    ]

    fb_py, fb_js, fb_mm, fb_sm = generate_smart_fallback(fallback_nodes, fallback_edges)

    return FlowchartToCodeResponse(
        success=True,
        pythonCode=fb_py,
        nodeJsCode=fb_js,
        mermaid=fb_mm,
        detectedNodes=fallback_nodes,
        detectedEdges=fallback_edges,
        summary=fb_sm,
        aiProvider=f"groq-{settings.groq_model}-offline"
    )
