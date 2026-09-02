from typing import List, Optional, Tuple
from pydantic import BaseModel, Field


class OCRStrokeRequest(BaseModel):
    roomId: Optional[str] = None
    shapeId: str
    points: List[Tuple[float, float]] = Field(..., description="List of [x, y] coordinates")
    pressures: Optional[List[float]] = None


class OCRResultResponse(BaseModel):
    shapeId: str
    ocrText: str
    confidence: float = 0.95
