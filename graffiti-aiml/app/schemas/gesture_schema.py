from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CircleBounds(BaseModel):
    x: float
    y: float
    w: float
    h: float


class CircleQueryRequest(BaseModel):
    roomId: Optional[str] = None
    circleBounds: CircleBounds
    enclosedElements: List[Dict[str, Any]] = Field(default_factory=list)
    userPrompt: str = Field(..., description="Query or prompt to apply to circled elements")


class CircleQueryResponse(BaseModel):
    action: str = Field(..., description="'restyle', 'explain', or 'transform'")
    proposedElements: List[Dict[str, Any]] = Field(default_factory=list)
    explanationText: Optional[str] = None
