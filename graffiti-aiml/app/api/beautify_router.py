from fastapi import APIRouter
from app.beautify.shape_classifier import classify_and_clean_stroke
from app.schemas.beautify_schema import BeautifiedShapeResponse, BeautifyRequest

router = APIRouter(tags=["Beautify"])


@router.post("/beautify", response_model=BeautifiedShapeResponse)
async def beautify_stroke(req: BeautifyRequest):
    detected_type, payload = classify_and_clean_stroke(req.shapeId, req.points)
    return BeautifiedShapeResponse(
        shapeId=req.shapeId,
        detectedType=detected_type,
        payload=payload
    )
