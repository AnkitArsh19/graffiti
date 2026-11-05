from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class MindMapNodeInput(BaseModel):
    id: str
    text: Optional[str] = ""
    type: Optional[str] = "text"
    x: float = 0.0
    y: float = 0.0
    width: float = 160.0
    height: float = 80.0
    strokeColor: Optional[str] = None
    backgroundColor: Optional[str] = None
    customData: Optional[Dict[str, Any]] = None


class MindMapAutoLayoutRequest(BaseModel):
    elements: List[MindMapNodeInput] = Field(..., description="Selected canvas text/sticky elements to organize")
    anchorX: Optional[float] = None
    anchorY: Optional[float] = None
    spacingX: Optional[float] = 240.0
    spacingY: Optional[float] = 120.0
    preferredModel: Optional[str] = Field("auto", description="Free model to use: 'groq' or 'gemini'")


class MindMapGenerateRequest(BaseModel):
    prompt: Optional[str] = Field(None, description="Topic or prompt to generate mindmap for (e.g. 'React Architecture')")
    markdown: Optional[str] = Field(None, description="Markdown bullet list hierarchy (# Root, ## Branch, - Sub-branch)")
    anchorX: Optional[float] = 400.0
    anchorY: Optional[float] = 300.0
    preferredModel: Optional[str] = Field("auto", description="Free model to use: 'groq' or 'gemini'")


class MindMapRelationship(BaseModel):
    sourceId: str
    targetId: str
    label: Optional[str] = None
    relationshipType: Optional[str] = "parent-child"


class MindMapAutoLayoutResponse(BaseModel):
    success: bool = True
    rootNodeId: Optional[str] = None
    nodes: List[Dict[str, Any]] = Field(..., description="Updated node elements with calculated coordinates")
    connectors: List[Dict[str, Any]] = Field(default_factory=list, description="Generated connecting arrow elements")
    relationships: List[MindMapRelationship] = Field(default_factory=list)
    aiProvider: str = "heuristic"
    summary: Optional[str] = None
