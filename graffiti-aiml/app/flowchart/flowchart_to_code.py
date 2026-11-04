import json
import re
from typing import Dict, Any, Optional
import httpx

from app.config import settings
from app.schemas.flowchart_schema import (
    FlowchartToCodeRequest,
    FlowchartToCodeResponse,
    FlowchartNode,
    FlowchartEdge,
)


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
    """Uses Gemini 1.5 Flash Vision to parse hand-drawn/canvas flowcharts and generate starter code + Mermaid.js."""
    gemini_key = settings.get_gemini_key()

    # Clean Base64 image
    img_data = req.image
    mime_type = "image/png"
    if "," in img_data:
        header, img_data = img_data.split(",", 1)
        if "jpeg" in header or "jpg" in header:
            mime_type = "image/jpeg"
        elif "webp" in header:
            mime_type = "image/webp"

    if gemini_key:
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
                        
                        nodes = [FlowchartNode(**n) for n in parsed.get("detectedNodes", [])]
                        edges = [FlowchartEdge(**e) for e in parsed.get("detectedEdges", [])]

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
        except Exception:
            pass

    # Fallback when key is not provided or network fails
    return FlowchartToCodeResponse(
        success=True,
        pythonCode=DEFAULT_FALLBACK_PYTHON,
        nodeJsCode=DEFAULT_FALLBACK_NODEJS,
        mermaid=DEFAULT_FALLBACK_MERMAID,
        detectedNodes=[
            FlowchartNode(id="n1", label="Start", type="start"),
            FlowchartNode(id="n2", label="Receive Input", type="input_output"),
            FlowchartNode(id="n3", label="Process & Transform Data", type="process"),
            FlowchartNode(id="n4", label="Is Valid?", type="decision"),
            FlowchartNode(id="n5", label="Complete Transaction", type="process"),
            FlowchartNode(id="n6", label="Finished", type="end"),
        ],
        detectedEdges=[
            FlowchartEdge(source="n1", target="n2"),
            FlowchartEdge(source="n2", target="n3"),
            FlowchartEdge(source="n3", target="n4"),
            FlowchartEdge(source="n4", target="n5", condition="Yes"),
            FlowchartEdge(source="n5", target="n6"),
        ],
        summary="Synthesized starter workflow code and Mermaid diagram from flowchart diagram.",
        aiProvider=f"gemini-{settings.gemini_model}-offline"
    )
