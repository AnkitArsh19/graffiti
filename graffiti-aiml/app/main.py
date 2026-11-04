from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.beautify_router import router as beautify_router
from app.api.code_router import router as code_router
from app.api.diagram_router import router as diagram_router
from app.api.gesture_router import router as gesture_router
from app.api.math_router import router as math_router
from app.api.ocr_router import router as ocr_router

# New AI/ML Feature Routers
from app.api.mindmap_router import router as mindmap_router
from app.api.flowchart_router import router as flowchart_router
from app.api.notebook_router import router as notebook_router
from app.api.theme_router import router as theme_router
from app.api.simulation_router import router as simulation_router
from app.api.voice_router import router as voice_router

from app.config import settings

app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description="Graffiti Asynchronous AI/ML Service for intelligent whiteboard and canvas features."
)

# Enable CORS for frontend and backend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all endpoint routers
app.include_router(ocr_router)
app.include_router(beautify_router)
app.include_router(math_router)
app.include_router(gesture_router)
app.include_router(diagram_router)
app.include_router(code_router)

# Mount Feature Routers
app.include_router(mindmap_router)
app.include_router(flowchart_router)
app.include_router(notebook_router)
app.include_router(theme_router)
app.include_router(simulation_router)
app.include_router(voice_router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "UP",
        "service": settings.app_name,
        "environment": settings.environment,
        "free_providers": {
            "gemini_api_key_configured": bool(settings.get_gemini_key()),
            "groq_api_key_configured": bool(settings.get_groq_key())
        }
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Graffiti AI/ML Service is running.",
        "docs": "/docs",
        "health": "/health"
    }
