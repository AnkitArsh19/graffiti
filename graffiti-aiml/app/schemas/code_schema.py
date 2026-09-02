from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class DiagramToCodeRequest(BaseModel):
    texts: List[str] = Field(default_factory=list, description="Extracted text from frame children")
    image: Optional[str] = Field(None, description="Data URL or Base64 representation of exported frame")
    theme: Optional[str] = Field("light", description="'light' or 'dark'")


class StreamChunk(BaseModel):
    type: Literal["content", "done", "error"]
    delta: Optional[str] = None
    finishReason: Optional[str] = None
    error: Optional[Dict[str, Any]] = None
