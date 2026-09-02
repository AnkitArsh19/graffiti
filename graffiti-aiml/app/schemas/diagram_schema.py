from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class AnchorPosition(BaseModel):
    x: float = 0.0
    y: float = 0.0


class DiagramSynthesizeRequest(BaseModel):
    roomId: Optional[str] = None
    prompt: str = Field(..., description="Prompt describing the diagram to generate")
    anchorPosition: AnchorPosition = Field(default_factory=AnchorPosition)


class DiagramSynthesizeResponse(BaseModel):
    prompt: str
    mermaid: str
    proposedElements: List[Dict[str, Any]] = Field(default_factory=list)


class LLMMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class TTDChatRequest(BaseModel):
    messages: List[LLMMessage] = Field(..., description="Chat message history")
