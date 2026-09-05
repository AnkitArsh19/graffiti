# Graffiti — Real-Time Collaborative Whiteboard & Notebook with AI Assist

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
| **Windows 10 / 11 (x64)** | `.exe` Setup / Portable `.exe` | [Download Windows Release (v0.1.0)](https://github.com/AnkitArsh19/graffiti/releases/latest) |
| **macOS (Apple Silicon M-Series)** | `.dmg` Installer / `.app` | [Download macOS ARM64 Release (v0.1.0)](https://github.com/AnkitArsh19/graffiti/releases/latest) |
| **macOS (Intel x64)** | `.dmg` Installer / `.app` | [Download macOS Intel Release (v0.1.0)](https://github.com/AnkitArsh19/graffiti/releases/latest) |
| **Linux (x64)** | `.AppImage` / `.deb` | [Download Linux Release (v0.1.0)](https://github.com/AnkitArsh19/graffiti/releases/latest) |

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
        Database Ops                 Pub/Sub & Locks          Internal Callback
               │                           │                        │
               ▼                           ▼                        ▼
┌─────────────────────────────┐ ┌──────────────────────┐ ┌─────────────────────────┐
│        PostgreSQL 16        │ │       Redis 7        │ │      AI/ML Service      │
│  - ops (Append-only JSONB)  │ │ - room:{slug}:op     │ │    (FastAPI / Python)   │
│  - snapshots (State JSONB)  │ │ - room:{slug}:pres.. │ │ - Handwriting OCR Search│
│  - rooms, pages, users      │ │ - lock:compact:{id}  │ │ - Stroke Beautification │
│                             │ │                      │ │ - Live Math Solver      │
│                             │ │                      │ │ - Circle-to-Edit Engine │
│                             │ │                      │ │ - Text-to-Diagram (LLM) │
└─────────────────────────────┘ └──────────────────────┘ └─────────────────────────┘
```

---

## Subsystem Overview

| Subsystem | Tech Stack | Directory | Documentation |
| :--- | :--- | :--- | :--- |
| **Backend & Sync Engine** | Java 25, Spring Boot 4.1.0, STOMP, Redis 7, PostgreSQL 16 | [`graffiti-backend/`](file:///e:/graffiti/graffiti-backend/) | [Backend README](file:///e:/graffiti/graffiti-backend/README.md) |
| **Frontend & Desktop App** | React 19, TypeScript, Vite, Tauri v2, Rough vector renderer | [`graffiti-frontend/`](file:///e:/graffiti/graffiti-frontend/) | [Frontend README](file:///e:/graffiti/graffiti-frontend/README.md) |
| **AI/ML Assistance Service** | Python 3.12, FastAPI, SymPy, TrOCR / Vision, Shapely | [`graffiti-aiml/`](file:///e:/graffiti/graffiti-aiml/) | [AI/ML README](file:///e:/graffiti/graffiti-aiml/README.md) |
| **Infrastructure** | Docker, Docker Compose, PostgreSQL 16, Redis 7 | [`docker/`](file:///e:/graffiti/docker/) | [Docker Compose](file:///e:/graffiti/docker/docker-compose.yml) |

---

## Key Highlights

1. **Deterministic CRDT Engine**: Last-Writer-Wins Element-Set reducer ensuring commutative and idempotent multi-user convergence without central locks.
2. **Multi-Page Notebook & Classroom Presentation**:
   - **Multi-Page Deck (`pages`)**: Bottom page-bar, slide drawer, page reordering, and duplication (`Ctrl+Shift+D`).
   - **Paper Background Templates**: Ruled/Lined (28px handwriting), Grid (20×20 math), Dotted (24px sketch), Cornell notes, and Blank canvas.
   - **Teacher Follow-Me Mode**: Synchronized page flipping (`TEACHER_PAGE_SYNC`) over Redis Pub/Sub.
3. **Cloud Export & Sharing**: Multi-page PDF compilation (`.pdf`), Markdown lecture notes (`.md`), and 1-click Google Drive upload with instant public share link.
4. **Native Cross-Platform Desktop (Tauri v2)**:
   - Lightweight (~12MB) hardware-accelerated desktop binary for Windows (10/11), macOS, and Linux.
   - Native frameless window with macOS traffic lights & vibrancy glassmorphism / Windows 11 Mica material.
   - Native OS system menu bar integration (`File`, `Edit`, `View`, `Tools`, `Help`) and local offline `.graffiti` file associations.
5. **Layout & Productivity Superpowers**:
   - **Sticky Note Presets (`N`)**: Instant pastel brainstorm notes (`#fff3bf`, `#d0ebff`, `#d3f9d8`, `#ffdeeb`, `#f3d9fa`, `#ffe8cc`) with auto-centered text.
   - **Navigation Minimap (`Alt+M`)**: Scaled overview thumbnail with draggable viewport frame and click-to-pan.
   - **"Tidy Up" Auto-Alignment (`Ctrl+Alt+T`)**: Multi-shape geometry engine organizing scattered selections into clean grids, columns, or rows with 24px spacing.
6. **Multimodal AI Whiteboard Assistance**:
   - **Diagram-to-Code / Wireframe-to-Code (`MagicFrame`)**: Multimodal AI vision converting hand-drawn wireframes and sketches into live, interactive HTML/CSS code streamed directly into an embedded iframe.
   - **Conversational Text-to-Diagram (TTD) Streaming**: Multi-turn chat streaming generating structured Mermaid flowchart syntax and real-time previews via Server-Sent Events.
   - **Live Handwritten Math & Equation Solver**: Automatically detects math expressions ending in `=`, evaluates via symbolic Python (`sympy`), and places the result digitally on canvas.
   - **Voice-Driven Canvas Commands**: Browser-native Web Speech API enabling hands-free tool switching, color selection, and page navigation.
   - **Handwriting OCR & Search (`Ctrl+F`)**: Unified spatial canvas search across typed text and handwritten notes across all pages.
   - **Stroke Beautification**: Douglas-Peucker point decimation and geometric primitive snapping (Auto-Snap on Hold).
   - **"Circle to Ask / Modify / Change" Gesture AI**: Drawing a closed loop around any region extracts spatial context for AI queries, restyling, or transformation.
   - **Non-Destructive Ghost Previews**: AI suggestions render as interactive preview overlays with **Accept (Enter)** and **Dismiss (Esc)** actions.

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
├── graffiti-aiml/                  # Python 3.12 + FastAPI AI assistance service
│   ├── README.md
│   └── app/
├── README.md                       # Master project overview & quickstart guide
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

### 4. Run AI/ML Microservice
```bash
cd graffiti-aiml
python -m venv venv
# Windows: venv\Scripts\activate | Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
AI microservice runs on `http://localhost:8000`.

---

## License

This project is open-source software licensed under the MIT License.
