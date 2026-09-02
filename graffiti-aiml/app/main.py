from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.beautify_router import router as beautify_router
from app.api.code_router import router as code_router
from app.api.diagram_router import router as diagram_router
from app.api.gesture_router import router as gesture_router
from app.api.math_router import router as math_router
from app.api.ocr_router import router as ocr_router
from app.config import settings

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Graffiti Asynchronous AI/ML Service for intelligent whiteboard features."
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


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "UP",
        "service": settings.app_name,
        "environment": settings.environment
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Graffiti AI/ML Service is running.",
        "docs": "/docs",
        "health": "/health"
    }
