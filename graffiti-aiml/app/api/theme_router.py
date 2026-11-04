from fastapi import APIRouter, HTTPException
from app.theme.theme_morpher import morph_theme
from app.schemas.theme_schema import ThemeMorphRequest, ThemeMorphResponse

router = APIRouter(prefix="/v1/ai/theme", tags=["Theme"])


@router.post("/morph", response_model=ThemeMorphResponse)
async def theme_morph_endpoint(req: ThemeMorphRequest):
    """Generative AI Theme & Aesthetic Morphing utility powered by Gemini 1.5 Flash."""
    try:
        return await morph_theme(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Theme morphing failed: {str(e)}")
