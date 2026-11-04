from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class AnchorPosition(BaseModel):
    x: float = 100.0
    y: float = 100.0


class MathSolveRequest(BaseModel):
    roomId: Optional[str] = None
    equation: str = Field(..., description="Equation or mathematical expression to evaluate")
    anchorPosition: Optional[AnchorPosition] = None
    anchor: Optional[AnchorPosition] = None


class MathSolveResponse(BaseModel):
    equation: str
    result: str
    proposedElement: Dict[str, Any]
