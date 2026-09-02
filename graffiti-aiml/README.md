# Graffiti AI/ML Service — Intelligent Canvas Microservice

The asynchronous AI/ML assistance service for Graffiti, built with **Python 3.12** and **FastAPI**. It processes heavy vision, OCR, vector geometry, symbolic math evaluation, and multimodal LLM inference workloads decoupled from the core real-time sync engine.

---

## Architecture & Module Structure

```
graffiti-aiml/
├── requirements.txt                # Dependencies (FastAPI, uvicorn, numpy, shapely, opencv, pillow, sympy)
├── Dockerfile                      # Container definition for AI microservice
└── app/
    ├── main.py                     # FastAPI application entrypoint & CORS middleware
    ├── config.py                   # Environment settings & API keys (OpenAI / Anthropic / Local models)
    ├── api/                        # REST endpoint routers
    │   ├── ocr_router.py           # Handwriting OCR extraction & stroke indexing
    │   ├── beautify_router.py      # Stroke smoothing & geometric shape fitting
    │   ├── math_router.py          # Live handwritten equation & math solver
    │   ├── gesture_router.py       # "Circle to Ask/Modify" context extraction & prompt execution
    │   ├── diagram_router.py       # Natural language text-to-diagram generation & TTD chat streaming
    │   └── code_router.py          # Diagram-to-code / wireframe-to-code SSE streaming
    ├── ocr/                        # Handwriting recognition engine
    │   ├── preprocessor.py         # Stroke-to-raster image rasterization & binarization
    │   └── ocr_engine.py           # TrOCR / PaddleOCR / Vision API extraction pipeline
    ├── beautify/                   # Geometric fitting & spline smoothing
    │   ├── douglas_peucker.py      # Polyline simplification algorithm (cv2.approxPolyDP / RDP)
    │   ├── shape_classifier.py     # Rectangle, ellipse, diamond, triangle, arrow classifier
    │   └── bezier_fitter.py        # Catmull-Rom & cubic Bezier curve fitting
    ├── math/                       # Symbolic math & equation solver
    │   ├── equation_parser.py      # Arithmetic, algebra, and LaTeX expression extraction
    │   └── sympy_solver.py         # Sandboxed SymPy evaluation & result string formatting
    ├── gesture/                    # Multimodal gesture-driven interaction
    │   ├── loop_detector.py        # Closed-loop / lasso stroke geometry verification
    │   ├── spatial_indexer.py      # Ray casting / bounding box intersection for enclosed shapes
    │   └── prompt_runner.py        # Multimodal LLM prompt orchestrator (Ask, Restyle, Transform)
    ├── diagram/                    # Structured diagram synthesis
    │   ├── mermaid_parser.py       # Mermaid.js flowchart & sequence diagram parser
    │   ├── layout_engine.py        # Sugiyama hierarchical coordinate layout generator
    │   └── element_builder.py      # Translation of graph nodes/edges into Graffiti Canvas JSON elements
    ├── code/                       # Wireframe-to-code synthesis
    │   └── code_generator.py       # Intelligent UI code generator and SSE streaming engine
    └── schemas/                    # Pydantic request & response models
        ├── ocr_schema.py           # StrokeBatchRequest, OCRResultResponse
        ├── beautify_schema.py      # StrokePointsRequest, BeautifiedShapeResponse
        ├── math_schema.py          # MathSolveRequest, MathSolveResponse
        ├── gesture_schema.py       # CircleContextRequest, SuggestedModificationsResponse
        ├── diagram_schema.py       # DiagramPromptRequest, CanvasElementsResponse, TTDChatRequest
        └── code_schema.py          # DiagramToCodeRequest, StreamChunk
```

### 6. Diagram-to-Code & Wireframe-to-Code (`/v1/ai/diagram-to-code/generate-streaming`)
- Streams self-contained, responsive HTML/CSS/JS components via Server-Sent Events (SSE) based on wireframe texts, image captures, and theme (`dark` / `light`).

### 7. Conversational Text-to-Diagram Streaming (`/v1/ai/text-to-diagram/chat-streaming`)
- Excalidraw-compatible chat streaming returning Mermaid syntax chunks via SSE with rate-limiting and token management.

---

## Core Capabilities

### 1. Handwriting OCR & Canvas Text Search
- **Stroke Rasterization**: Converts raw vector stroke coordinates (`freedraw` points) into normalized high-contrast image patches.
- **Handwriting Recognition**: Extracts text strings with bounding coordinates, attaching `ocrText` metadata to the canvas element so users can search (`Ctrl+F`) handwritten whiteboard notes.

### 2. Stroke Beautification & Shape Smoothing
- **Jitter Removal**: Applies the Douglas-Peucker point decimation algorithm to eliminate hand tremor.
- **Geometric Primitive Fitting**: Analyzes convex hulls, aspect ratios, circularity, and corner variance to classify whether an irregular stroke represents a rectangle, ellipse, diamond, triangle, or arrow.
- **Curved Spline Fitting**: Fits smooth cubic Bezier and Catmull-Rom splines to freeform irregular contours.

### 3. Live Handwritten Math & Equation Solver
- **Equation Extraction**: Detects when a handwritten stroke sequence ends with an `=` symbol, extracting arithmetic and algebra formulas.
- **SymPy Symbolic Evaluation**: Solves expressions in a secure sandbox (arithmetic `45 * 2 + 10 =`, percentages, algebraic equations `2x + 5 = 15`).
- **Canvas Result Generation**: Formats and returns the solution text element positioned adjacent to the `=` sign.

### 4. "Circle to Ask / Modify / Change" Gesture AI
- **Closed-Loop Gesture Recognition**: Detects when a user draws a circle around an arbitrary region of the whiteboard.
- **Spatial Context Extraction**: Collects all enclosed shapes, sticky notes, arrows, typed text, and handwritten notes into a structured scene context.
- **Multimodal Operations**:
  - *Ask & Explain*: Analyzes circled architecture diagrams or calculations, providing instant explanations.
  - *Modify & Restyle*: Standardizes alignment, color-coding, or formats messy brainstorm notes into clean tables.
  - *Transform & Expand*: Converts rough wireframe sketches into structured UI components or adds error-handling paths to flowcharts.

### 5. Natural Language Diagram Synthesis
- Generates complete architecture diagrams and flowcharts from textual prompts using Mermaid.js layout engines and the Sugiyama hierarchical graph algorithm.

---

## Development Setup

```bash
# 1. Create and activate Python 3.12 virtual environment
python -m venv venv
# Windows: venv\Scripts\activate | Linux/Mac: source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run FastAPI local development server
uvicorn app.main:app --reload --port 8000

# 4. Run test suite
pytest -v tests/test_aiml.py
```
API runs on `http://localhost:8000`. Interactive Swagger documentation available at `http://localhost:8000/docs`.
