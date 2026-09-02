from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.code.code_generator import stream_diagram_to_code
from app.schemas.code_schema import DiagramToCodeRequest

router = APIRouter(tags=["Code"])


@router.post("/v1/ai/diagram-to-code/generate-streaming")
async def generate_code_streaming(req: DiagramToCodeRequest):
    """Excalidraw-compatible Diagram-to-Code SSE streaming endpoint."""
    return StreamingResponse(
        stream_diagram_to_code(
            texts=req.texts,
            image=req.image,
            theme=req.theme or "light"
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Ratelimit-Limit": "50",
            "X-Ratelimit-Remaining": "49"
        }
    )
