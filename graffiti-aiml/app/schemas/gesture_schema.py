from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


class CircleBounds(BaseModel):
    x: float
    y: float
    w: float = 0.0
    h: float = 0.0
    width: Optional[float] = None
    height: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_dimensions(cls, data: Any) -> Any:
        if isinstance(data, dict):
            w = data.get("w") if data.get("w") is not None else data.get("width", 0.0)
            h = data.get("h") if data.get("h") is not None else data.get("height", 0.0)
            data["w"] = float(w or 0.0)
            data["h"] = float(h or 0.0)
            data["width"] = float(w or 0.0)
            data["height"] = float(h or 0.0)
        return data


class CircleQueryRequest(BaseModel):
    roomId: Optional[str] = None
    circleBounds: CircleBounds
    viewport: Optional[Dict[str, float]] = None
    enclosedElements: List[Dict[str, Any]] = Field(default_factory=list)
    userPrompt: str = Field(..., description="Query or prompt to apply to circled elements")
    actionType: Optional[str] = Field(default=None, description="'restyle', 'explain', or 'transform'")


class CircleQueryResponse(BaseModel):
    action: str = Field(..., description="'restyle', 'explain', or 'transform'")
    proposedElements: List[Dict[str, Any]] = Field(default_factory=list)
    explanationText: Optional[str] = None
