from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class FlowchartToCodeRequest(BaseModel):
    image: Optional[str] = Field(None, description="Base64 encoded PNG of the canvas or selection")
    elements: Optional[List[Dict[str, Any]]] = Field(None, description="Structured whiteboard elements (shapes, arrows, text)")
    targetLanguage: Optional[str] = Field("both", description="'python', 'nodejs', or 'both'")
    prompt: Optional[str] = Field(None, description="Optional extra instructions")


class FlowchartNode(BaseModel):
    id: str
    label: str
    type: str = "process"  # start, process, decision, end, input_output


class FlowchartEdge(BaseModel):
    source: str
    target: str
    condition: Optional[str] = None


class FlowchartToCodeResponse(BaseModel):
    success: bool = True
    pythonCode: str = ""
    nodeJsCode: str = ""
    mermaid: str = ""
    detectedNodes: List[FlowchartNode] = Field(default_factory=list)
    detectedEdges: List[FlowchartEdge] = Field(default_factory=list)
    summary: str = ""
    aiProvider: str = "groq-openai/gpt-oss-120b"
