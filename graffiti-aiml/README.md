# Graffiti AI/ML Service — Intelligent Canvas Microservice

The asynchronous AI/ML assistance service for Graffiti, built with **Python 3.12** and **FastAPI**. It processes heavy vision, OCR, vector geometry, and multimodal LLM inference workloads decoupled from the core real-time sync engine.

---

## Architecture & Module Structure

```
graffiti-ai/
├── requirements.txt                # Dependencies (FastAPI, uvicorn, numpy, shapely, opencv, pillow)
├── Dockerfile                      # Container definition for AI microservice
└── app/
    ├── main.py                     # FastAPI application entrypoint & CORS middleware
    ├── config.py                   # Environment settings & API keys (OpenAI / Anthropic / Local models)
    ├── api/                        # REST endpoint routers
    │   ├── ocr_router.py           # Handwriting OCR extraction & stroke indexing
    │   ├── beautify_router.py      # Stroke smoothing & geometric shape fitting
    │   ├── gesture_router.py       # "Circle to Ask/Modify" context extraction & prompt execution
    │   └── diagram_router.py       # Natural language text-to-diagram generation
    ├── ocr/                        # Handwriting recognition engine
    │   ├── preprocessor.py         # Stroke-to-raster image rasterization & binarization
    │   └── ocr_engine.py           # TrOCR / PaddleOCR / Vision API extraction pipeline
    ├── beautify/                   # Geometric fitting & spline smoothing
    │   ├── douglas_peucker.py      # Polyline simplification algorithm
    │   ├── shape_classifier.py     # Rectangle, ellipse, diamond, triangle, arrow classifier
    │   └── bezier_fitter.py        # Catmull-Rom & cubic Bezier curve fitting
    ├── gesture/                    # Multimodal gesture-driven interaction
    │   ├── loop_detector.py        # Closed-loop / lasso stroke geometry verification
    │   ├── spatial_indexer.py      # Ray casting / bounding box intersection for enclosed shapes
    │   └── prompt_runner.py        # Multimodal LLM prompt orchestrator (Ask, Restyle, Transform)
    ├── diagram/                    # Structured diagram synthesis
    │   ├── mermaid_parser.py       # Mermaid.js flowchart & sequence diagram parser
    │   ├── layout_engine.py        # Sugiyama hierarchical coordinate layout generator
    │   └── element_builder.py      # Translation of graph nodes/edges into Graffiti Canvas JSON elements
    └── schemas/                    # Pydantic request & response models
        ├── ocr_schema.py           # StrokeBatchRequest, OCRResultResponse
        ├── beautify_schema.py      # StrokePointsRequest, BeautifiedShapeResponse
        ├── gesture_schema.py       # CircleContextRequest, SuggestedModificationsResponse
        └── diagram_schema.py       # DiagramPromptRequest, CanvasElementsResponse
```

---

## Core Capabilities

### 1. Handwriting OCR & Canvas Text Search
- **Stroke Rasterization**: Converts raw vector stroke coordinates (`freedraw` points) into normalized high-contrast image patches.
- **Handwriting Recognition**: Extracts text strings with bounding coordinates, attaching `ocrText` metadata to the canvas element so users can search (`Ctrl+F`) handwritten whiteboard notes.

### 2. Stroke Beautification & Shape Smoothing
- **Jitter Removal**: Applies the Douglas-Peucker point decimation algorithm to eliminate hand tremor.
- **Geometric Primitive Fitting**: Analyzes convex hulls, aspect ratios, circularity, and corner variance to classify whether an irregular stroke represents a rectangle, ellipse, diamond, triangle, or arrow.
- **Curved Spline Fitting**: Fits smooth cubic Bezier and Catmull-Rom splines to freeform irregular contours.

### 3. "Circle to Ask / Modify / Change" Gesture AI
- **Closed-Loop Gesture Recognition**: Detects when a user draws a circle around an arbitrary region of the whiteboard.
- **Spatial Context Extraction**: Collects all enclosed shapes, arrows, typed text, and handwritten notes into a structured scene context.
- **Multimodal Operations**:
  - *Ask & Explain*: Analyzes circled architecture diagrams or calculations, providing instant explanations.
  - *Modify & Restyle*: Standardizes messy boxes, aligns connectors, or converts rough notes into structured tables.
  - *Transform & Expand*: Converts rough wireframe sketches into structured UI components or expands flowcharts with error-handling logic.

### 4. Text-to-Diagram Synthesis
- Converts natural language descriptions (e.g. *"Microservices payment processing workflow with Kafka and Redis"*) into structured Mermaid diagrams.
- Translates Mermaid syntax into styled canvas elements with automated hierarchical (Sugiyama) coordinate positioning.

---

## Getting Started

### Prerequisites
- Python 3.12+
- Virtual environment (recommended)

### Installation & Development
```bash
# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI development server (port 8000)
uvicorn app.main:app --reload --port 8000
```

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/ocr/extract` | Extract text from stroke vector points or image patch |
| `POST` | `/api/v1/beautify/shape` | Snap irregular hand-drawn stroke into smooth vector primitive |
| `POST` | `/api/v1/gesture/circle-action` | Process circled region context and execute LLM prompt |
| `POST` | `/api/v1/diagram/generate` | Generate structured whiteboard diagram from text description |
| `GET` | `/health` | Service liveness and model readiness check |

---

## Environment Variables (`.env`)

```ini
PORT=8000
BACKEND_CALLBACK_URL=http://localhost:8080/internal/rooms
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OCR_ENGINE=trocr  # Options: trocr, paddleocr, vision_api
```
