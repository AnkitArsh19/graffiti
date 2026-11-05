# Graffiti — Real-Time Collaborative Whiteboard and Notebook with AI Assist

[![Java](https://img.shields.io/badge/Java-25-orange.svg)](https://openjdk.org/projects/jdk/25/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-v2%20Desktop-24C8D8.svg)](https://tauri.app/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.12-teal.svg)](https://fastapi.tiangolo.com/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)

Graffiti is a high-performance, horizontally scalable real-time collaborative whiteboard and note-taking application for Web and native Desktop (Windows, macOS, Linux). Multiple distributed users, students, and educators can draw, write, manipulate shapes, organize complex diagrams, and take structured multi-page lecture notes concurrently on an infinite canvas with deterministic CRDT synchronization, ephemeral presence streaming, periodic snapshot compaction, multi-format/Google Drive export, and multimodal AI assistance.

> **Master Blueprint & Architecture Contract:** For low-level JSON schemas, CRDT mathematical merge rules, keyboard shortcut maps, and REST/STOMP protocol specifications, see [**`PROJECT_SPECIFICATION.md`**](file:///e:/graffiti/PROJECT_SPECIFICATION.md). For scalability design decisions, distributed systems trade-offs, and benchmarks (Google Docs OT vs. Figma Spatial CRDT), see [**`ARCHITECTURE_DECISIONS.md`**](file:///e:/graffiti/ARCHITECTURE_DECISIONS.md).

---

## Desktop App & Offline-First (No Servers Required)

Graffiti runs as a **fully self-contained, native desktop application** on Windows, macOS, and Linux.

**Key Architecture Principle**:
- You **do not** need to start Spring Boot, PostgreSQL, Redis, or Docker to run Graffiti on your desktop.
- The desktop app functions **100% offline** out of the box with zero external dependencies.
- All whiteboards, multi-page notebooks, paper background templates, workspaces, and folders are saved directly on your computer in your operating system's local AppData directory (`IndexedDB` / local storage).
- Servers are only necessary when hosting real-time multiplayer collaborative rooms or using cloud AI services.

### Download Desktop Releases

| Platform | Format | Status & Download Link |
| :--- | :--- | :--- |
| **Windows 10 / 11 (x64)** | `.exe` Setup (Recommended) | [Download Graffiti_0.2.0_x64-setup.exe](https://github.com/AnkitArsh19/graffiti/releases/download/v0.2.0/Graffiti_0.2.0_x64-setup.exe) / [Latest Release](https://github.com/AnkitArsh19/graffiti/releases/latest) |
| **macOS (Apple Silicon M-Series)** | `.dmg` Installer / `.app` | [Download macOS ARM64 Release (v0.2.0)](https://github.com/AnkitArsh19/graffiti/releases/latest) |
| **macOS (Intel x64)** | `.dmg` Installer / `.app` | [Download macOS Intel Release (v0.2.0)](https://github.com/AnkitArsh19/graffiti/releases/latest) |
| **Linux (x64)** | `.AppImage` / `.deb` | [Download Linux Release (v0.2.0)](https://github.com/AnkitArsh19/graffiti/releases/latest) |

### Direct Local Execution (From This Repository)

If you have this repository locally, the compiled desktop application executable is ready to run immediately:

- **Windows**: Run [`graffiti-frontend/src-tauri/target/debug/graffiti-desktop.exe`](file:///e:/graffiti/graffiti-frontend/src-tauri/target/debug/graffiti-desktop.exe) directly:
  ```powershell
  .\graffiti-frontend\src-tauri\target\debug\graffiti-desktop.exe
  ```
- **Development Mode** (with hot reloading):
  ```bash
  cd graffiti-frontend
  npm run desktop:dev
  ```
- **Build Standalone Production Package**:
  ```bash
  cd graffiti-frontend
  npm run desktop:build
  ```
  Installers will be generated in `graffiti-frontend/src-tauri/target/release/bundle/`.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│             Cross-Platform Clients (Web Browser & Tauri v2 Desktop)              │
│       (React 19 + Canvas Rendering Engine + Multi-Page Notebook + STOMP)         │
└──────────────┬────────────────────────────────────────────────────┬──────────────┘
               │                                                    │
      REST (Rooms/Auth/Drive/PDF)                          STOMP WebSocket (Ops/Presence)
               │                                                    │
               ▼                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         Spring Boot 4.1.0 Node Cluster                           │
│                          (Java 25 Runtime / Port 8080)                           │
│  ┌───────────────────────┐ ┌─────────────────────────┐ ┌──────────────────────┐  │
│  │ Room, Page & Drive API│ │ STOMP MessageController │ │ Compaction Worker    │  │
│  │ (JWT / Google OAuth2) │ │ (/app/rooms/{slug}/*)   │ │ (Redis Distributed)  │  │
│  └───────────────────────┘ └─────────────────────────┘ └──────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │             CRDT Merge Engine (LWW-Element-Set Reducer)                    │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────┬────────────────────────┬──────────────┘
               │                           │                        │
        Database Ops                 Pub/Sub & Locks       REST (AI Inference)
               │                           │                        │
               ▼                           ▼                        ▼
┌─────────────────────────────┐ ┌──────────────────────┐ ┌─────────────────────────┐
│        PostgreSQL 16        │ │       Redis 7        │ │      AI/ML Service      │
│  - ops (Append-only JSONB)  │ │ - room:{slug}:op     │ │  (FastAPI / Python 3.12)│
│  - snapshots (State JSONB)  │ │ - room:{slug}:pres.. │ │ - Handwriting OCR Search│
│  - rooms, pages, users      │ │ - lock:compact:{id}  │ │ - Stroke Beautification │
│                             │ │                      │ │ - Live Math Solver      │
│                             │ │                      │ │ - Circle-to-Edit Engine │
│                             │ │                      │ │ - Text-to-Diagram (LLM) │
│                             │ │                      │ │ - Mind-Map Auto-Layout  │
│                             │ │                      │ │ - Flow Simulator Engine │
│                             │ │                      │ │ - Notebook AI Briefing  │
│                             │ │                      │ │ - Theme Morphing (LLM)  │
│                             │ │                      │ │ - Flowchart-to-Code     │
│                             │ │                      │ │ - Voice Live Storyboard │
└─────────────────────────────┘ └──────────────────────┘ └─────────────────────────┘
```

---

## Subsystem Overview

| Subsystem | Tech Stack | Directory | Documentation |
| :--- | :--- | :--- | :--- |
| **Backend & Sync Engine** | Java 25, Spring Boot 4.1.0, STOMP, Redis 7, PostgreSQL 16 | [`graffiti-backend/`](file:///e:/graffiti/graffiti-backend/) | [Backend README](file:///e:/graffiti/graffiti-backend/README.md) |
| **Frontend & Desktop App** | React 19, TypeScript, Vite, Tauri v2, Rough vector renderer | [`graffiti-frontend/`](file:///e:/graffiti/graffiti-frontend/) | [Frontend README](file:///e:/graffiti/graffiti-frontend/README.md) |
| **AI/ML Assistance Service** | Python 3.12, FastAPI, Docker, Groq (openai/gpt-oss-120b), SymPy | [`graffiti-aiml/`](file:///e:/graffiti/graffiti-aiml/) | [AI/ML README](file:///e:/graffiti/graffiti-aiml/README.md) |
| **Infrastructure** | Docker, Docker Compose, PostgreSQL 16, Redis 7 | [`docker/`](file:///e:/graffiti/docker/) | [Docker Compose](file:///e:/graffiti/docker/docker-compose.yml) |

---

## Key Highlights

1. **Deterministic CRDT Engine & Sub-16ms Live Streaming**:
   - Last-Writer-Wins Element-Set reducer ensuring commutative and idempotent multi-user convergence without central locks.
   - **Real-Time In-Progress Stroke Streaming**: Pen ink flows and shapes expand continuously across collaborator screens as pointers move, streamed ephemerally over Redis Pub/Sub before permanent durable commit.
   - **Resilient Connection Watchdog**: Dual-layer heartbeats (20s STOMP + 4s presence keepalive) and automated reconnection watchdog with offline operation queuing.
   - **Collaborator Presence & Quick-Join**: Interactive Live status menu with participant count, room code copy, quick-join modal, and graceful leave with automatic owner reassignment.
2. **Multi-Page Notebook & Classroom Presentation**:
   - **Multi-Page Deck (`pages`)**: Bottom page-bar, slide drawer, page reordering, and duplication (`Ctrl+Shift+D`).
   - **Paper Background Templates**: Ruled/Lined (28px handwriting), Grid (20×20 math), Dotted (24px sketch), Cornell notes, and Blank canvas.
   - **Teacher Follow-Me Mode**: Synchronized page flipping (`TEACHER_PAGE_SYNC`) over Redis Pub/Sub.
3. **Cloud Export, Google Drive & Presentation**:
   - Multi-page PDF compilation (`.pdf`), Markdown lecture notes (`.md`), and direct PNG vector exports.
   - **Google Drive Multi-Account Manager**: Connect multiple accounts, browse folders, search files, import slides/docs directly onto the board, and export with instant public share links.
   - **Multi-Format Document Presentation Studio**: Open and annotate PDF (`pdfjs-dist`), Word (`.docx`), PowerPoint (`.pptx`), Markdown, Code, and Images, exporting back to annotated PDF, PPTX, or Images.
4. **Native Cross-Platform Desktop & Screen Overlay (Tauri v2)**:
   - Lightweight (~12MB) hardware-accelerated desktop binary for Windows (10/11), macOS, and Linux.
   - **Transparent Desktop Screen Overlay (`F6` / `Ctrl+Shift+O`)**: Fullscreen transparent annotation mode with Win32 click-through cursor tracking and live STOMP sync for presentations, Zoom, and code walkthroughs.
   - **Deep-linking & Seamless Browser Handoff**: `graffiti://` custom protocol handler and session polling for one-click browser sign-in without token exposure.
   - Native frameless window with macOS traffic lights & vibrancy glassmorphism / Windows 11 Mica material.
   - Native OS system menu bar integration (`File`, `Edit`, `View`, `Tools`, `Help`) and local offline `.graffiti` file associations.
5. **Layout, Navigation & Customization Superpowers**:
   - **Sticky Note Presets (`N`)**: Instant pastel brainstorm notes (`#fff3bf`, `#d0ebff`, `#d3f9d8`, `#ffdeeb`, `#f3d9fa`, `#ffe8cc`) with auto-centered text.
   - **Navigation Minimap (`Alt+M`)**: Scaled overview thumbnail with draggable viewport frame and click-to-pan.
   - **"Tidy Up" Auto-Alignment (`Ctrl+Alt+T`)**: Multi-shape geometry engine organizing scattered selections into clean grids, columns, or rows with 24px spacing.
   - **Customizable Shortcuts Engine**: Configure custom keybindings and mouse buttons (including M4/M5) across whiteboard, overlay, document, and general workflows.
6. **Multimodal AI Whiteboard Assistance**:
   - **Diagram-to-Code / Wireframe-to-Code (`MagicFrame`)**: Multimodal AI vision converting hand-drawn wireframes and sketches into live, interactive HTML/CSS code streamed directly into an embedded iframe.
   - **Conversational Text-to-Diagram (TTD) Streaming**: Multi-turn chat streaming generating structured Mermaid flowchart syntax and real-time previews via Server-Sent Events.
   - **Live Handwritten Math & Equation Solver**: Automatically detects math expressions ending in `=`, evaluates via symbolic Python (`sympy`) or local recursive-descent math evaluator, and places formatted result digitally on canvas.
   - **Voice-Driven Canvas Commands & Live Storyboard (`Alt+V`)**: Browser-native Web Speech API enabling hands-free tool switching, undo/redo, zoom, view reset, shape beautification, and voice math calculation without cloud dependencies. Features **phonetic & fuzzy tolerance** for common browser speech recognition variations (e.g. recognizing `"ando"` / `"and do"` / `"un do"` as Undo, `"wreck tangle"` / `"box"` as Rectangle, `"dimond"` / `"rhombus"` as Diamond), and **automatically dismisses the listening HUD** once a command completes to prevent background eavesdropping. In **Live Storyboard mode**, describe a system architecture out loud; Groq (`openai/gpt-oss-120b`) / Gemini Flash extracts entities and relationships, renders architecture cards directly onto the canvas, speaks an audio confirmation summary via `speechSynthesis`, and cleanly auto-closes.
   - **Handwriting OCR & Search (`Ctrl+F`)**: Non-blocking background OCR indexing using PIL stroke trajectory analysis and geometric character/token classification, automatically annotating `customData.ocrText` for instant canvas search and Markdown note export.
   - **Stroke Beautification & Geometry Fitting**: Instant RDP decimation and shape snapping (circles, ellipses, rectangles, diamonds, straight lines, arrows) on pencil release by default, with on/off toggle and hover-to-revert original stroke.
   - **"Circle to Ask / Modify / Change" Gesture AI**: Drawing a closed loop around any region extracts spatial context for AI queries, restyling, or transformation.
   - **Non-Destructive Ghost Previews**: All AI suggestions render as interactive preview overlays with **Accept (Enter)** and **Dismiss (Esc)** actions.
   - **Dual-Mode AI Architecture & Gateway**: Direct Spring Boot `POST /ai/request` REST gateway paired with resilient offline client fallbacks (`aiClient.ts`, `beautifier.ts`, `mathEvaluator.ts`).
   - **Mind-Map Auto-Layout & Topic Synthesis** (`MindMapPanel`): Dual-mode engine supporting (1) reorganizing messy canvas notes with Markmap-inspired `flextree` dynamic subtree spacing for collision-free branches, and (2) generating full mind-map trees from topic prompts or Markdown outlines (`# / -`) using Groq `openai/gpt-oss-120b` or Gemini Flash.
   - **Behavioral Flow Simulator** (`FlowSimulatorPanel`): Converts directed whiteboard diagrams into an executable state graph. Performs AABB spatial proximity parsing (100 px threshold) to associate floating text labels with shapes, assigns sequential "Step N" fallback labels for unlabeled nodes, and runs a step-by-step execution trace with live element highlighting.
   - **AI Notebook Briefing** (`NotebookBriefingWidget`): Extracts action items (with assignees and priorities), key decisions, and open questions from multi-page lecture or meeting notes via LLM summarization.
   - **Flowchart-to-Code Converter** (`FlowchartToCodePanel`): Captures the canvas as an image, sends it to Gemini 1.5 Flash, and returns Python and Node.js implementations plus a Mermaid diagram — insertable directly as canvas code blocks.
   - **AI Theme Morpher** (`ThemeMorphPanel`): Transforms the visual aesthetic of all canvas elements (stroke color, background, fill style, roughness) using a natural-language theme prompt or curated presets ("Pastel Creative", "Cyberpunk Blueprint", "Retro Paper", "Executive Pitch", "Neon Synthwave", "Minimalist Monochrome") with zero-latency instant preset bypass while strictly preserving all spatial coordinates and dimensions.

---

## Project Structure

```
graffiti/
├── docker/                         # PostgreSQL 16 & Redis 7 container orchestration
│   ├── docker-compose.yml
│   └── .env
├── docs_archive/                   # Reference canvas engine implementation & schemas
├── graffiti-backend/               # Java 25 + Spring Boot 4.1.0 backend service
│   ├── pom.xml
│   ├── README.md
│   └── src/main/java/com/graffiti/
├── graffiti-frontend/              # React 19 + TypeScript + Vite + Tauri v2 desktop client
│   ├── src-tauri/                  # Native desktop windowing & OS menu configuration
│   ├── README.md
│   └── src/
│       ├── components/
│       │   ├── WhiteboardCanvas.tsx           # Core canvas (shape containment, bound text, drag groups)
│       │   ├── canvasRenderer.ts              # Rough.js renderer with shape-clipped text rendering
│       │   ├── FlowSimulatorPanel.tsx         # Behavioral flow execution engine UI
│       │   ├── FlowchartToCodePanel.tsx       # Flowchart → Python/Node.js/Mermaid converter UI
│       │   ├── MindMapPanel.tsx               # AI mind-map auto-layout panel
│       │   ├── NotebookBriefingWidget.tsx     # AI notebook summarization & action items widget
│       │   ├── ThemeMorphPanel.tsx            # AI visual theme transformation panel
│       │   ├── VoiceCommander.tsx             # Voice commands + Live Storyboard HUD
│       │   └── VoiceStoryboardHUD.tsx         # Semantic alias for VoiceCommander storyboard mode
│       └── lib/
│           └── api.ts                         # Typed REST client for backend & AI/ML service
├── graffiti-aiml/                  # Python 3.12 + FastAPI AI assistance microservice
│   ├── README.md
│   └── app/
│       ├── main.py                            # FastAPI entrypoint — 12 routers mounted
│       ├── mindmap/mindmap_agent.py           # Semantic root-scoring + bidirectional tree layout
│       ├── simulation/flow_simulator.py       # AABB spatial graph parser + state machine executor
│       ├── flowchart/flowchart_to_code.py     # Canvas-image → code (Gemini 1.5 Flash)
│       ├── notebook/notebook_summarizer.py    # LLM action-item & decision extraction
│       ├── theme/theme_morpher.py             # LLM aesthetic theme morphing (preserves geometry)
│       └── voice/voice_storyboard.py         # Speech → architecture block generation
├── pytest.ini                      # Root pytest configuration (testpaths, pythonpath)
├── README.md                       # Master project overview & quickstart guide
├── ARCHITECTURE_DECISIONS.md       # ADR matrix & distributed systems trade-offs
└── PROJECT_SPECIFICATION.md        # Authoritative engineering specification & contracts
```

---

## Quick Start

### 1. Launch Infrastructure (PostgreSQL 16 & Redis 7)
```bash
cd docker
docker compose up -d
```
- **PostgreSQL 16**: Port `5432` (`graffiti` / `Ankit@1907`)
- **Redis 7**: Port `6379` (`Ankit@1907`)

### 2. Run Backend Sync Engine
```bash
cd graffiti-backend
./mvnw spring-boot:run
```
Backend runs on `http://localhost:8080` (STOMP WebSocket endpoint: `ws://localhost:8080/ws`).  
Run automated tests: `./mvnw test`

### 3. Run Frontend Web Client & Desktop App
```bash
cd graffiti-frontend
npm install

# Run Web Client (Browser on http://localhost:5173)
npm run dev

# Run Native Desktop App (Connects to running Vite dev server)
npx tauri dev --no-dev-server

# Or Launch Standalone Desktop App Executable (No servers or terminal needed)
.\src-tauri\target\debug\graffiti-desktop.exe
```
Web client runs on `http://localhost:5173`. Desktop launches in a native hardware-accelerated window and functions 100% offline.

### 4. Run AI/ML Microservice (Docker Containerized)
```bash
# Run containerized with zero host Python virtual environments
docker compose up -d aiml
```
AI microservice runs containerized on `http://localhost:8000` with volume-mounted live reloading and automated health checks (`http://localhost:8000/health`).

---

## License

This project is open-source software licensed under the MIT License.
