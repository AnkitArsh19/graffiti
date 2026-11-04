# Graffiti AI/ML Service — Intelligent Canvas Microservice

The asynchronous AI/ML assistance service for Graffiti, built with **Python 3.12** and **FastAPI**. It processes heavy vision, OCR, vector geometry, symbolic math evaluation, and multimodal LLM inference workloads decoupled from the core real-time sync engine.

**AI Provider Chain:** Groq (llama-3.1-70b-versatile) → Google Gemini 1.5 Flash → deterministic heuristic fallback. All features work offline via the heuristic fallback; no API key is required to run the service.

---

## Architecture & Module Structure

```
graffiti-aiml/
├── requirements.txt                # Dependencies (FastAPI, uvicorn, groq, httpx, sympy, numpy, shapely)
├── conftest.py                     # pytest asyncio / langsmith plugin suppression
├── pytest.ini                      # Test configuration (testpaths, pythonpath)
├── Dockerfile                      # Container definition for AI microservice
└── app/
    ├── main.py                     # FastAPI entrypoint — 12 routers mounted, CORS middleware
    ├── config.py                   # Environment settings (GEMINI_API_KEY, GROQ_API_KEY, model names)
    ├── api/                        # REST endpoint routers
    │   ├── ocr_router.py           # Handwriting OCR extraction & stroke indexing
    │   ├── beautify_router.py      # Stroke smoothing & geometric shape fitting
    │   ├── math_router.py          # Live handwritten equation & math solver
    │   ├── gesture_router.py       # "Circle to Ask/Modify" context extraction & prompt execution
    │   ├── diagram_router.py       # Natural language text-to-diagram generation & TTD chat streaming
    │   ├── code_router.py          # Diagram-to-code / wireframe-to-code SSE streaming
    │   ├── mindmap_router.py       # POST /v1/ai/mindmap/auto-layout
    │   ├── flowchart_router.py     # POST /v1/ai/flowchart/to-code
    │   ├── notebook_router.py      # POST /v1/ai/notebook/summarize
    │   ├── theme_router.py         # POST /v1/ai/theme/morph
    │   ├── simulation_router.py    # POST /v1/ai/flow/simulate
    │   └── voice_router.py         # POST /v1/ai/voice/storyboard
    ├── ocr/                        # Handwriting recognition engine
    │   ├── preprocessor.py         # Stroke-to-raster image rasterization & binarization
    │   └── ocr_engine.py           # TrOCR / PaddleOCR / Vision API extraction pipeline
    ├── beautify/                   # Geometric fitting & spline smoothing
    │   ├── douglas_peucker.py      # Polyline simplification algorithm (RDP)
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
    ├── mindmap/                    # AI mind-map auto-layout (NEW)
    │   ├── __init__.py
    │   └── mindmap_agent.py        # Semantic root scoring + bidirectional radial tree layout
    ├── flowchart/                  # Flowchart → code converter (NEW)
    │   ├── __init__.py
    │   └── flowchart_to_code.py    # Canvas image → Python + Node.js + Mermaid via Gemini vision
    ├── notebook/                   # AI notebook summarization (NEW)
    │   ├── __init__.py
    │   └── notebook_summarizer.py  # Action items, key decisions & open questions extractor
    ├── theme/                      # AI visual theme morphing (NEW)
    │   ├── __init__.py
    │   └── theme_morpher.py        # LLM aesthetic transformation preserving all spatial coordinates
    ├── simulation/                 # Behavioral flow execution engine (NEW)
    │   ├── __init__.py
    │   └── flow_simulator.py       # AABB spatial graph parser + state machine executor
    ├── voice/                      # Voice live storyboard (NEW)
    │   ├── __init__.py
    │   └── voice_storyboard.py     # Speech transcript → architecture block generator + summary
    └── schemas/                    # Pydantic request & response models
        ├── ocr_schema.py
        ├── beautify_schema.py
        ├── math_schema.py
        ├── gesture_schema.py
        ├── diagram_schema.py
        ├── code_schema.py
        ├── mindmap_schema.py       # MindMapAutoLayoutRequest/Response, MindMapNodeInput
        ├── flowchart_schema.py     # FlowchartToCodeRequest/Response
        ├── notebook_schema.py      # NotebookSummarizeRequest/Response, ActionItem, KeyDecision
        ├── simulation_schema.py    # FlowSimulateRequest/Response, SimulationStep, StateGraphNode/Edge
        ├── theme_schema.py         # ThemeMorphRequest/Response
        └── voice_schema.py         # VoiceStoryboardRequest/Response (includes `summary` field)
```

---

## API Endpoints

### Legacy Endpoints (original service)

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health check with API key status |
| `POST` | `/ocr/extract` | Handwriting OCR from freedraw stroke coordinates |
| `POST` | `/beautify` | Stroke simplification & geometric shape fitting |
| `POST` | `/math/solve` | Symbolic math evaluation via SymPy |
| `POST` | `/circle-query` | Multimodal gesture AI on circled canvas region |
| `POST` | `/diagram/synthesize` | Text-to-diagram: Mermaid flowchart generation |
| `POST` | `/v1/ai/text-to-diagram/chat-streaming` | Conversational TTD via SSE |
| `POST` | `/v1/ai/diagram-to-code/generate-streaming` | Wireframe-to-code via SSE |

### New AI/ML Feature Endpoints (branch: feature/new-aiml-features)

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/v1/ai/mindmap/auto-layout` | Semantic root scoring + symmetric bidirectional tree layout |
| `POST` | `/v1/ai/flowchart/to-code` | Canvas image → Python + Node.js code + Mermaid diagram |
| `POST` | `/v1/ai/notebook/summarize` | Action items, key decisions & open questions from text |
| `POST` | `/v1/ai/theme/morph` | LLM aesthetic theme transformation (preserves geometry) |
| `POST` | `/v1/ai/flow/simulate` | AABB spatial graph parsing + step-by-step state simulation |
| `POST` | `/v1/ai/voice/storyboard` | Speech → architecture cards + audio summary string |

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
- **Multimodal Operations**: Ask & Explain, Modify & Restyle, Transform & Expand.

### 5. Natural Language Diagram Synthesis
- Generates complete architecture diagrams and flowcharts from textual prompts using Mermaid.js layout engines and the Sugiyama hierarchical graph algorithm.

### 6. Diagram-to-Code & Wireframe-to-Code (`/v1/ai/diagram-to-code/generate-streaming`)
- Streams self-contained, responsive HTML/CSS/JS components via Server-Sent Events (SSE) based on wireframe texts, image captures, and theme (`dark` / `light`).

### 7. Conversational Text-to-Diagram Streaming (`/v1/ai/text-to-diagram/chat-streaming`)
- 2D vector canvas engine (in docs_archive)-compatible chat streaming returning Mermaid syntax chunks via SSE with rate-limiting and token management.

### 8. Mind-Map Auto-Layout (`/v1/ai/mindmap/auto-layout`) ✨ NEW
- **Semantic Root Scoring**: `_score_root_candidate()` awards points for domain breadth (`PARENT_DOMAINS`: +300 exact, +200 partial) and hub keywords (+100 each), and penalizes leaf acronyms (`LEAF_ACRONYMS`: −250) and subtopic keywords (−100 each). Multi-word labels receive a breadth bonus (+40).
- **Bidirectional Tree Layout**: Children are distributed symmetrically on the left and right of the locked root node with configurable horizontal/vertical spacing.
- **Curved Connectors**: All connector arrows include `startBinding`, `endBinding`, and `points` arrays compatible with the canvas engine's arrow rendering pipeline.

### 9. Flowchart-to-Code Converter (`/v1/ai/flowchart/to-code`) ✨ NEW
- **Canvas Capture → Vision AI**: The frontend captures the canvas as a base64 PNG and sends it with a `targetLanguage` parameter (`python` | `nodejs` | `both`).
- **Code Generation**: Returns `pythonCode`, `nodeJsCode`, and `mermaid` fields with detected node labels.

### 10. AI Notebook Briefing (`/v1/ai/notebook/summarize`) ✨ NEW
- Extracts structured intelligence from unstructured meeting or lecture notes:
  - `actionItems[]`: task description, assignee, priority (`high`/`medium`/`low`)
  - `keyDecisions[]`: decision text + rationale context
  - `openQuestions[]`: unresolved questions for follow-up
  - `executiveSummary`: concise paragraph overview

### 11. AI Theme Morpher (`/v1/ai/theme/morph`) ✨ NEW
- **Geometry Preservation Contract**: `x`, `y`, `width`, `height`, `points`, `id`, and `type` fields are **never mutated**. Only aesthetic properties (`strokeColor`, `backgroundColor`, `fillStyle`, `roughness`, `strokeWidth`, `fontFamily`) are transformed.
- **Built-in Presets**: Cyberpunk Blueprint, Retro Paper, Executive Pitch, Neon Synthwave, Minimalist Monochrome, Pastel Creative.

### 12. Voice Live Storyboard (`/v1/ai/voice/storyboard`) ✨ NEW
- **Entity Extraction**: Identifies software system components (gateway, service, database, cache, queue, client) from spoken transcripts.
- **Canvas Element Generation**: Creates positioned, color-coded architecture card elements and curved connector arrows that avoid collision with existing canvas elements.
- **Audio Summary**: Returns a `summary` string in the response for client-side `window.speechSynthesis.speak()` playback.
- **Heuristic Fallback**: Keyword-matching offline fallback generates default system blocks without an API key.

---

## Development Setup

```bash
# 1. Create and activate Python 3.12 virtual environment
python -m venv venv
# Windows: venv\Scripts\activate | Linux/Mac: source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure API keys (optional — heuristic fallback works without them)
cp .env.example .env
# Edit .env: set GEMINI_API_KEY and/or GROQ_API_KEY

# 4. Run FastAPI local development server
uvicorn app.main:app --reload --port 8000

# 5. Run test suite (all 22 tests)
pytest -v
```

API runs on `http://localhost:8000`. Interactive Swagger documentation available at `http://localhost:8000/docs`.
