from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class VoiceStoryboardRequest(BaseModel):
    transcript: str = Field(..., description="Spoken transcript stream or complete utterance")
    existingElements: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Existing elements on canvas to prevent overlap")
    anchorPosition: Optional[Dict[str, float]] = Field(default_factory=lambda: {"x": 200.0, "y": 200.0})


class VoiceStoryboardResponse(BaseModel):
    success: bool = True
    newElements: List[Dict[str, Any]] = Field(default_factory=list, description="Canvas elements to append to canvas")
    entitiesDetected: List[str] = Field(default_factory=list)
    relationshipsDetected: List[str] = Field(default_factory=list)
    transcriptSnippet: str = ""
    summary: str = Field(default="", description="Human-readable summary for text-to-speech playback")
    aiProvider: str = "gemini-3.8-flash"
