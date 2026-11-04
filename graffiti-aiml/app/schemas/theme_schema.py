from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ThemeElementMeta(BaseModel):
    id: str
    type: str
    strokeColor: Optional[str] = None
    backgroundColor: Optional[str] = None
    strokeWidth: Optional[float] = None
    strokeStyle: Optional[str] = None
    fillStyle: Optional[str] = None
    roughness: Optional[float] = None
    fontFamily: Optional[str] = None
    fontSize: Optional[str] = None
    opacity: Optional[float] = None
    roundness: Optional[str] = None
    arrowType: Optional[str] = None
    cardTheme: Optional[str] = None
    # Spatial coordinates must be passed so returned elements remain intact, but MUST NOT be altered
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    points: Optional[List[Dict[str, Any]]] = None
    text: Optional[str] = None
    customData: Optional[Dict[str, Any]] = None


class ThemeMorphRequest(BaseModel):
    themePrompt: str = Field(..., description="Theme prompt, e.g. 'Cyberpunk Blueprint', 'Retro Paper', 'Executive Pitch'")
    elements: List[ThemeElementMeta] = Field(..., description="Canvas elements to morph aesthetically")
    preserveCoordinates: bool = True


class ThemePalette(BaseModel):
    primaryStroke: str
    secondaryStroke: str
    primaryBackground: str
    secondaryBackground: str
    accentColor: str
    canvasBackground: str
    fontFamily: str
    roughness: float
    strokeWidth: float
    fillStyle: str


class ThemeMorphResponse(BaseModel):
    success: bool = True
    themeName: str
    canvasBackground: str
    palette: Optional[ThemePalette] = None
    updatedElements: List[Dict[str, Any]] = Field(..., description="Elements with updated aesthetic attributes, exact coordinates preserved")
    aiProvider: str = "gemini-1.5-flash"
