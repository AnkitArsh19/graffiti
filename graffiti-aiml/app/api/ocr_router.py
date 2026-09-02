from fastapi import APIRouter
from app.ocr.ocr_engine import recognize_stroke_text
from app.schemas.ocr_schema import OCRResultResponse, OCRStrokeRequest

router = APIRouter(tags=["OCR"])


@router.post("/ocr/extract", response_model=OCRResultResponse)
async def extract_ocr(req: OCRStrokeRequest):
    ocr_text, conf = recognize_stroke_text(req.shapeId, req.points, req.pressures)
    return OCRResultResponse(
        shapeId=req.shapeId,
        ocrText=ocr_text,
        confidence=conf
    )
