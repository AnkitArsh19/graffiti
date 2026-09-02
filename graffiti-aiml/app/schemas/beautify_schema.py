from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field


class BeautifyRequest(BaseModel):
    roomId: Optional[str] = None
    shapeId: str
    points: List[Tuple[float, float]] = Field(..., description="Array of [x, y] coordinates")


class BeautifiedShapeResponse(BaseModel):
    shapeId: str
    detectedType: str
    payload: Dict[str, Any]
