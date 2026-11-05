from fastapi import APIRouter, HTTPException
from app.mindmap.mindmap_agent import auto_layout_mindmap, generate_mindmap
from app.schemas.mindmap_schema import (
    MindMapAutoLayoutRequest,
    MindMapAutoLayoutResponse,
    MindMapGenerateRequest,
)

router = APIRouter(prefix="/v1/ai/mindmap", tags=["MindMap"])


@router.post("/auto-layout", response_model=MindMapAutoLayoutResponse)
async def layout_mindmap_endpoint(req: MindMapAutoLayoutRequest):
    """Context-Aware 'Infinite Canvas' Mind-Map Auto-Layout Agent powered by Groq / Gemini 1.5 Flash."""
    try:
        return await auto_layout_mindmap(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mind-Map auto-layout failed: {str(e)}")


@router.post("/generate", response_model=MindMapAutoLayoutResponse)
async def generate_mindmap_endpoint(req: MindMapGenerateRequest):
    """Generates a complete mind-map from topic or markdown outline with non-overlapping layout."""
    try:
        return await generate_mindmap(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mind-Map generation failed: {str(e)}")
