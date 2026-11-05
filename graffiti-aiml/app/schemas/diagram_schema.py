from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class AnchorPosition(BaseModel):
    x: float = 0.0
    y: float = 0.0


class DiagramSynthesizeRequest(BaseModel):
    roomId: Optional[str] = None
    prompt: str = Field(..., description="Prompt describing the diagram to generate")
    direction: Optional[str] = Field("TD", description="Flowchart direction: 'TD' (top-down) or 'LR' (left-right)")
    mermaid: Optional[str] = Field(None, description="Optional raw Mermaid.js syntax to parse directly")
    anchorPosition: Optional[AnchorPosition] = None
    anchor: Optional[AnchorPosition] = None


class DiagramSynthesizeResponse(BaseModel):
    prompt: str
    mermaid: str
    proposedElements: List[Dict[str, Any]] = Field(default_factory=list)


class LLMMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class TTDChatRequest(BaseModel):
    messages: List[LLMMessage] = Field(..., description="Chat message history")
