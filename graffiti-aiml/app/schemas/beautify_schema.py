from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class BeautifyRequest(BaseModel):
    roomId: Optional[str] = None
    shapeId: str
    points: List[Any] = Field(..., description="Array of [x, y] coordinates or {'x': x, 'y': y} objects")


class BeautifiedShapeResponse(BaseModel):
    shapeId: str
    detectedType: str
    payload: Dict[str, Any]
