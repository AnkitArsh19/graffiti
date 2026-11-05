from typing import List, Optional, Tuple, Union, Dict, Any
from pydantic import BaseModel, Field


class OCRStrokeRequest(BaseModel):
    roomId: Optional[str] = None
    shapeId: str
    points: Optional[List[Union[Tuple[float, float], List[float], Dict[str, Any]]]] = Field(
        default=None, description="List of [x, y] coordinates or {x, y} objects"
    )
    pressures: Optional[List[float]] = None
    image: Optional[str] = Field(None, description="Optional base64 PNG data URL or raster crop")


class OCRResultResponse(BaseModel):
    shapeId: str
    ocrText: str
    confidence: float = 0.95
