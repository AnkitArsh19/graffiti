from fastapi import APIRouter, HTTPException
from app.voice.voice_storyboard import generate_voice_storyboard
from app.schemas.voice_schema import VoiceStoryboardRequest, VoiceStoryboardResponse

router = APIRouter(prefix="/v1/ai/voice", tags=["Voice"])


@router.post("/storyboard", response_model=VoiceStoryboardResponse)
async def voice_storyboard_endpoint(req: VoiceStoryboardRequest):
    """Dynamic AI Voice-to-Canvas Live Storyboarding powered by Gemini 1.5 Flash."""
    try:
        return await generate_voice_storyboard(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice storyboarding failed: {str(e)}")
