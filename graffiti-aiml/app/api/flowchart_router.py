from fastapi import APIRouter, HTTPException
from app.flowchart.flowchart_to_code import convert_flowchart_to_code
from app.schemas.flowchart_schema import FlowchartToCodeRequest, FlowchartToCodeResponse

router = APIRouter(prefix="/v1/ai/flowchart", tags=["Flowchart"])


@router.post("/to-code", response_model=FlowchartToCodeResponse)
async def flowchart_to_code_endpoint(req: FlowchartToCodeRequest):
    """Multi-Modal Flowchart-to-Code generator powered by Gemini 1.5 Flash Vision."""
    try:
        return await convert_flowchart_to_code(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flowchart conversion failed: {str(e)}")
