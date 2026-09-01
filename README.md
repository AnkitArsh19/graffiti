# Graffiti — Real-Time Collaborative Whiteboard with AI Assist

[![Java](https://img.shields.io/badge/Java-25-orange.svg)](https://openjdk.org/projects/jdk/25/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.12-teal.svg)](https://fastapi.tiangolo.com/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)

Graffiti is a high-performance, horizontally scalable real-time collaborative whiteboard web application. Multiple distributed users can draw, write, manipulate shapes, and organize complex diagrams concurrently on a shared infinite canvas with deterministic CRDT synchronization, ephemeral presence streaming, periodic snapshot compaction, and multimodal AI assistance.

> 📖 **Master Blueprint & Architecture Contract:** For low-level JSON schemas, CRDT mathematical merge rules, keyboard shortcut maps, and REST/STOMP protocol specifications, see [**`PROJECT_SPECIFICATION.md`**](file:///e:/graffiti/PROJECT_SPECIFICATION.md).

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                Frontend Clients                                  │
│                 (React + Canvas Rendering Engine + STOMP Client)                 │
└──────────────┬────────────────────────────────────────────────────┬──────────────┘
               │                                                    │
      REST (Rooms/Auth/Search)                             STOMP WebSocket (Ops/Presence)
               │                                                    │
               ▼                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         Spring Boot 4.1.0 Node Cluster                           │
│                          (Java 25 Runtime / Port 8080)                           │
│  ┌───────────────────────┐ ┌─────────────────────────┐ ┌──────────────────────┐  │
│  │ Room & Auth REST API  │ │ STOMP MessageController │ │ Compaction Worker    │  │
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
│  - rooms, users, members    │ │ - lock:compact:{id}  │ │ - Stroke Beautification │
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
| **Frontend Canvas UI** | React 19, TypeScript, Vite, Rough vector renderer | [`graffiti-frontend/`](file:///e:/graffiti/graffiti-frontend/) | [Frontend README](file:///e:/graffiti/graffiti-frontend/README.md) |
| **AI/ML Assistance Service** | Python 3.12, FastAPI, SymPy, TrOCR / Vision, Shapely | [`graffiti-aiml/`](file:///e:/graffiti/graffiti-aiml/) | [AI/ML README](file:///e:/graffiti/graffiti-aiml/README.md) |
| **Infrastructure** | Docker, Docker Compose, PostgreSQL 16, Redis 7 | [`docker/`](file:///e:/graffiti/docker/) | [Docker Compose](file:///e:/graffiti/docker/docker-compose.yml) |

---

## Key Highlights

1. **Deterministic CRDT Engine**: Last-Writer-Wins Element-Set reducer ensuring commutative and idempotent multi-user convergence without central locks.
2. **Ephemeral Presence vs. Persistent Ops**: High-frequency cursor coordinates, laser trails, and selection bounds stream over Redis Pub/Sub without database disk I/O.
3. **Snapshot Compaction**: Background worker compacts PostgreSQL operation logs into JSONB snapshots using Redis distributed locks (`SET NX PX`).
4. **Productivity & Layout Superpowers**:
   - **Sticky Note Presets (`N`)**: Instant pastel brainstorm notes (`#fff3bf`, `#d0ebff`, `#d3f9d8`, `#ffdeeb`, `#f3d9fa`, `#ffe8cc`) with auto-focused centered text.
   - **Navigation Minimap (`Alt+M`)**: Scaled overview thumbnail with draggable viewport frame and click-to-pan.
   - **"Tidy Up" Auto-Alignment (`Ctrl+Alt+T`)**: Multi-shape geometry engine organizing scattered selections into clean grids, columns, or rows with 24px spacing.
5. **Multimodal AI Whiteboard Assistance**:
   - **Live Handwritten Math & Equation Solver**: Automatically detects math expressions ending in `=`, evaluates via symbolic Python (`sympy`), and places the result digitally on canvas.
   - **Voice-Driven Canvas Commands**: Browser-native Web Speech API enabling hands-free tool switching, color selection, and export actions.
   - **Handwriting OCR & Search (`Ctrl+F`)**: Unified spatial canvas search across typed text and handwritten notes.
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
├── graffiti-frontend/              # React 19 + TypeScript + Vite canvas application
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

### 3. Run Frontend Web Client
```bash
cd graffiti-frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`.

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
