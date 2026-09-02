from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class AnchorPosition(BaseModel):
    x: float
    y: float


class MathSolveRequest(BaseModel):
    roomId: Optional[str] = None
    equation: str = Field(..., description="Equation or mathematical expression to evaluate")
    anchorPosition: AnchorPosition = Field(
        default_factory=lambda: AnchorPosition(x=100.0, y=100.0)
    )


class MathSolveResponse(BaseModel):
    equation: str
    result: str
    proposedElement: Dict[str, Any]
